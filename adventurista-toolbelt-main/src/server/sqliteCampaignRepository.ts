import { mkdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCampaignEvent, type CampaignEvent, type CampaignEventInput } from '@/lib/campaignEvents';
import type { CampaignRepository, CreateCampaignInput } from '@/lib/campaignRepository';
import type { AssetInput, CampaignMetadata, CampaignSnapshot, StoredAsset } from '@/lib/campaignState';
import type { Character, CampaignResource, MapToken, SpellTemplate } from '@/lib/types';
import type { GridSettings, MapEntry } from '@/lib/repositories';
import type { Obstacle } from '@/lib/obstacles';
import { FilesystemAssetStorage } from './fileAssetStorage';
import { SqliteCliDatabase } from './sqliteCli';

interface RepositoryOptions {
  rootDir: string;
  defaultCampaignName?: string;
}

interface JsonRow<T> {
  data: string;
  version?: number;
}

interface EventRow {
  id: string;
  type: string;
  occurredAt: string;
  source: string;
  payload: string;
  version: number;
}

function parseJson<T>(value: string): T {
  return JSON.parse(value) as T;
}

function sql(value: unknown): string {
  return SqliteCliDatabase.literal(value);
}

function nowIso(): string {
  return new Date().toISOString();
}

export class SqliteCampaignRepository implements CampaignRepository {
  private readonly db: SqliteCliDatabase;
  private readonly assets: FilesystemAssetStorage;

  constructor(private readonly options: RepositoryOptions) {
    mkdirSync(join(options.rootDir, 'campaigns'), { recursive: true });
    this.db = new SqliteCliDatabase(join(options.rootDir, 'campaign-host.db'));
    this.assets = new FilesystemAssetStorage(options.rootDir);
    this.initializeSchema();
  }

  ensureCampaign(input: CreateCampaignInput): CampaignMetadata {
    const existing = this.getCampaign(input.id);
    if (existing) return existing;

    const createdAt = input.createdAt ?? nowIso();
    this.db.exec(`
      INSERT INTO campaigns (id, name, created_at, updated_at, version)
      VALUES (${sql(input.id)}, ${sql(input.name)}, ${sql(createdAt)}, ${sql(createdAt)}, 0);
    `);

    return this.getCampaign(input.id)!;
  }

  listCampaigns(): CampaignMetadata[] {
    return this.db.query<{ id: string; name: string; created_at: string; updated_at: string; version: number }>(`
      SELECT id, name, created_at, updated_at, version
      FROM campaigns
      ORDER BY updated_at DESC;
    `).map(row => ({
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    }));
  }

  getCampaign(campaignId: string): CampaignMetadata | null {
    const row = this.db.query<{ id: string; name: string; created_at: string; updated_at: string; version: number }>(`
      SELECT id, name, created_at, updated_at, version
      FROM campaigns
      WHERE id = ${sql(campaignId)}
      LIMIT 1;
    `)[0];

    if (!row) return null;

    return {
      id: row.id,
      name: row.name,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      version: row.version,
    };
  }

  getSnapshot(campaignId: string): CampaignSnapshot {
    const campaign = this.getCampaign(campaignId) ?? this.ensureCampaign({
      id: campaignId,
      name: this.options.defaultCampaignName ?? 'Campaign',
    });

    const characters = this.db.query<JsonRow<Character>>(`
      SELECT data FROM characters WHERE campaign_id = ${sql(campaignId)} ORDER BY id;
    `).map(row => parseJson<Character>(row.data));

    const resources = this.db.query<JsonRow<CampaignResource>>(`
      SELECT data FROM resources WHERE campaign_id = ${sql(campaignId)} ORDER BY id;
    `).map(row => parseJson<CampaignResource>(row.data));

    const maps = this.db.query<JsonRow<MapEntry>>(`
      SELECT data FROM maps WHERE campaign_id = ${sql(campaignId)} ORDER BY id;
    `).map(row => parseJson<MapEntry>(row.data));

    const states = this.db.query<{ map_id: string; tokens_json: string | null; grid_json: string | null; obstacles_json: string | null; spell_templates_json: string | null }>(`
      SELECT map_id, tokens_json, grid_json, obstacles_json, spell_templates_json
      FROM map_states
      WHERE campaign_id = ${sql(campaignId)};
    `);

    const events = this.getEvents(campaignId);

    return {
      campaign,
      characters,
      resources,
      maps,
      mapStates: Object.fromEntries(states.map(row => [row.map_id, {
        mapId: row.map_id,
        tokens: row.tokens_json ? parseJson<MapToken[]>(row.tokens_json) : [],
        gridSettings: row.grid_json ? parseJson<GridSettings>(row.grid_json) : null,
        obstacles: row.obstacles_json ? parseJson<Obstacle[]>(row.obstacles_json) : [],
        spellTemplates: row.spell_templates_json ? parseJson<SpellTemplate[]>(row.spell_templates_json) : [],
      }])),
      events,
    };
  }

  appendEvent(campaignId: string, eventInput: CampaignEventInput): CampaignEvent {
    this.ensureCampaign({ id: campaignId, name: this.options.defaultCampaignName ?? 'Campaign' });
    const event = createCampaignEvent(eventInput);

    this.db.exec(`
      INSERT INTO events (campaign_id, id, type, occurred_at, source, payload, version)
      VALUES (
        ${sql(campaignId)},
        ${sql(event.id)},
        ${sql(event.type)},
        ${sql(event.occurredAt)},
        ${sql(event.source)},
        ${sql(event.payload)},
        (SELECT COALESCE(MAX(version), 0) + 1 FROM events WHERE campaign_id = ${sql(campaignId)})
      );
    `);

    this.applyEvent(campaignId, event);

    this.db.exec(`
      UPDATE campaigns
      SET updated_at = ${sql(event.occurredAt)},
          version = (SELECT COALESCE(MAX(version), 0) FROM events WHERE campaign_id = ${sql(campaignId)})
      WHERE id = ${sql(campaignId)};
    `);

    return event;
  }

  getEvents(campaignId: string, afterVersion = 0): CampaignEvent[] {
    return this.db.query<EventRow>(`
      SELECT id, type, occurred_at as occurredAt, source, payload, version
      FROM events
      WHERE campaign_id = ${sql(campaignId)} AND version > ${sql(afterVersion)}
      ORDER BY version ASC;
    `).map(row => ({
      id: row.id,
      type: row.type as CampaignEvent['type'],
      occurredAt: row.occurredAt,
      source: row.source as CampaignEvent['source'],
      payload: parseJson(row.payload),
    } as CampaignEvent));
  }

  storeAsset(campaignId: string, asset: AssetInput): StoredAsset {
    this.ensureCampaign({ id: campaignId, name: this.options.defaultCampaignName ?? 'Campaign' });
    const stored = this.assets.store(campaignId, asset);

    this.db.exec(`
      INSERT INTO assets (id, campaign_id, kind, filename, mime_type, relative_path, size, created_at)
      VALUES (
        ${sql(stored.id)},
        ${sql(campaignId)},
        ${sql(stored.kind)},
        ${sql(stored.filename)},
        ${sql(stored.mimeType)},
        ${sql(stored.relativePath)},
        ${sql(stored.size)},
        ${sql(stored.createdAt)}
      );
    `);

    return stored;
  }

  getAsset(campaignId: string, assetId: string): StoredAsset | null {
    const row = this.db.query<{
      id: string;
      campaign_id: string;
      kind: StoredAsset['kind'];
      filename: string;
      mime_type: string;
      relative_path: string;
      size: number;
      created_at: string;
    }>(`
      SELECT id, campaign_id, kind, filename, mime_type, relative_path, size, created_at
      FROM assets
      WHERE campaign_id = ${sql(campaignId)} AND id = ${sql(assetId)}
      LIMIT 1;
    `)[0];

    if (!row) return null;

    return {
      id: row.id,
      campaignId: row.campaign_id,
      kind: row.kind,
      filename: row.filename,
      mimeType: row.mime_type,
      relativePath: row.relative_path,
      size: row.size,
      createdAt: row.created_at,
    };
  }

  readAssetContent(campaignId: string, assetId: string): { asset: StoredAsset; content: Buffer } | null {
    const asset = this.getAsset(campaignId, assetId);
    if (!asset) return null;

    return {
      asset,
      content: readFileSync(join(this.options.rootDir, asset.relativePath)),
    };
  }

  private initializeSchema(): void {
    this.db.exec(`
      PRAGMA journal_mode = WAL;
      CREATE TABLE IF NOT EXISTS campaigns (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        version INTEGER NOT NULL DEFAULT 0
      );
      CREATE TABLE IF NOT EXISTS characters (
        campaign_id TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (campaign_id, id)
      );
      CREATE TABLE IF NOT EXISTS resources (
        campaign_id TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (campaign_id, id)
      );
      CREATE TABLE IF NOT EXISTS maps (
        campaign_id TEXT NOT NULL,
        id TEXT NOT NULL,
        data TEXT NOT NULL,
        PRIMARY KEY (campaign_id, id)
      );
      CREATE TABLE IF NOT EXISTS map_states (
        campaign_id TEXT NOT NULL,
        map_id TEXT NOT NULL,
        tokens_json TEXT,
        grid_json TEXT,
        obstacles_json TEXT,
        spell_templates_json TEXT,
        PRIMARY KEY (campaign_id, map_id)
      );
      CREATE TABLE IF NOT EXISTS events (
        campaign_id TEXT NOT NULL,
        id TEXT NOT NULL,
        type TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        source TEXT NOT NULL,
        payload TEXT NOT NULL,
        version INTEGER NOT NULL,
        PRIMARY KEY (campaign_id, id)
      );
      CREATE TABLE IF NOT EXISTS assets (
        id TEXT PRIMARY KEY,
        campaign_id TEXT NOT NULL,
        kind TEXT NOT NULL,
        filename TEXT NOT NULL,
        mime_type TEXT NOT NULL,
        relative_path TEXT NOT NULL,
        size INTEGER NOT NULL,
        created_at TEXT NOT NULL
      );
    `);

    const mapStateColumns = this.db.query<{ name: string }>(`PRAGMA table_info(map_states);`).map(row => row.name);
    if (!mapStateColumns.includes('spell_templates_json')) {
      this.db.exec(`ALTER TABLE map_states ADD COLUMN spell_templates_json TEXT;`);
    }
  }

  private applyEvent(campaignId: string, event: CampaignEvent): void {
    switch (event.type) {
      case 'character:created':
      case 'character:updated': {
        const character = event.payload.character;
        this.upsertJsonRecord('characters', campaignId, character.id, character);
        return;
      }
      case 'character:deleted': {
        this.deleteJsonRecord('characters', campaignId, event.payload.characterId);
        return;
      }
      case 'resource:created': {
        const resource = event.payload.resource;
        this.upsertJsonRecord('resources', campaignId, resource.id, resource);
        return;
      }
      case 'resource:deleted': {
        this.deleteJsonRecord('resources', campaignId, event.payload.resourceId);
        return;
      }
      case 'map:created': {
        const map = event.payload.map;
        this.upsertJsonRecord('maps', campaignId, map.id, map);
        this.db.exec(`
          INSERT INTO map_states (campaign_id, map_id, tokens_json, grid_json, obstacles_json, spell_templates_json)
          VALUES (${sql(campaignId)}, ${sql(map.id)}, '[]', NULL, '[]', '[]')
          ON CONFLICT(campaign_id, map_id) DO NOTHING;
        `);
        return;
      }
      case 'map:deleted': {
        this.deleteJsonRecord('maps', campaignId, event.payload.mapId);
        this.db.exec(`DELETE FROM map_states WHERE campaign_id = ${sql(campaignId)} AND map_id = ${sql(event.payload.mapId)};`);
        return;
      }
      case 'map:tokens_updated': {
        this.updateMapStateField(campaignId, event.payload.mapId, 'tokens_json', event.payload.tokens);
        return;
      }
      case 'map:token_move_intent': {
        this.moveMapToken(campaignId, event.payload.mapId, event.payload.tokenId, event.payload.x, event.payload.y);
        return;
      }
      case 'map:grid_updated': {
        this.updateMapStateField(campaignId, event.payload.mapId, 'grid_json', event.payload.gridSettings);
        return;
      }
      case 'map:obstacles_updated': {
        this.updateMapStateField(campaignId, event.payload.mapId, 'obstacles_json', event.payload.obstacles);
        return;
      }
      case 'map:spell_templates_updated': {
        this.updateMapStateField(campaignId, event.payload.mapId, 'spell_templates_json', event.payload.spellTemplates);
        return;
      }
      case 'role:set': {
        return;
      }
    }
  }

  private upsertJsonRecord(table: 'characters' | 'resources' | 'maps', campaignId: string, id: string, data: Character | CampaignResource | MapEntry): void {
    this.db.exec(`
      INSERT INTO ${table} (campaign_id, id, data)
      VALUES (${sql(campaignId)}, ${sql(id)}, ${sql(data)})
      ON CONFLICT(campaign_id, id) DO UPDATE SET data = excluded.data;
    `);
  }

  private deleteJsonRecord(table: 'characters' | 'resources' | 'maps', campaignId: string, id: string): void {
    this.db.exec(`DELETE FROM ${table} WHERE campaign_id = ${sql(campaignId)} AND id = ${sql(id)};`);
  }

  private updateMapStateField(campaignId: string, mapId: string, column: 'tokens_json' | 'grid_json' | 'obstacles_json' | 'spell_templates_json', value: MapToken[] | GridSettings | Obstacle[] | SpellTemplate[]): void {
    this.db.exec(`
      INSERT INTO map_states (campaign_id, map_id, ${column})
      VALUES (${sql(campaignId)}, ${sql(mapId)}, ${sql(value)})
      ON CONFLICT(campaign_id, map_id) DO UPDATE SET ${column} = excluded.${column};
    `);
  }

  private moveMapToken(campaignId: string, mapId: string, tokenId: string, x: number, y: number): void {
    const row = this.db.query<{ tokens_json: string | null }>(`
      SELECT tokens_json
      FROM map_states
      WHERE campaign_id = ${sql(campaignId)} AND map_id = ${sql(mapId)}
      LIMIT 1;
    `)[0];
    const currentTokens = row?.tokens_json ? parseJson<MapToken[]>(row.tokens_json) : [];
    const updatedTokens = currentTokens.map(token => token.id === tokenId ? { ...token, x, y } : token);
    this.updateMapStateField(campaignId, mapId, 'tokens_json', updatedTokens);
  }
}
