import type { MapToken } from './types';
import type { GridSettings, MapEntry } from './repositories';
import type { Obstacle } from './obstacles';
import type { CampaignEvent, CampaignEventInput } from './campaignEvents';
import type { CampaignSyncAdapter } from './campaignSync';
import type { KeyValueStore } from './storage';
import type { CampaignSnapshot, MapStateSnapshot } from './campaignState';
import { getCellCenter, type GridCell } from './gridCoordinates';
import { campaignSync } from './campaignSync';
import {
  createMap,
  removeMap,
  replaceMapObstacles,
  replaceMapTokens,
  saveMapGridSettings,
} from './campaignMutations';
import {
  getMaps,
  loadGridSettings,
  loadMapTokens,
  loadObstacles,
} from './repositories';

export interface MapCollectionSnapshot {
  maps: MapEntry[];
  version: number;
}

export interface MapSnapshot {
  mapId: string;
  tokens: MapToken[];
  gridSettings: GridSettings;
  obstacles: Obstacle[];
  version: number;
}

export type MapIntent =
  | { type: 'map:tokens_replace'; tokens: MapToken[] }
  | { type: 'map:token_move'; tokenId: string; x: number; y: number }
  | { type: 'map:token_move_cell'; tokenId: string; cell: GridCell }
  | { type: 'map:token_damage'; tokenId: string; damage: number }
  | { type: 'map:token_upsert'; token: MapToken }
  | { type: 'map:token_remove'; tokenId: string }
  | { type: 'map:grid_update'; gridSettings: GridSettings }
  | { type: 'map:obstacles_replace'; obstacles: Obstacle[] };

interface SessionOptions {
  store?: KeyValueStore;
  sync?: CampaignSyncAdapter;
}

type MapCollectionListener = (snapshot: MapCollectionSnapshot) => void;
type MapListener = (snapshot: MapSnapshot) => void;

function isMapCollectionEvent(event: CampaignEvent): boolean {
  return event.type === 'map:created' || event.type === 'map:deleted';
}

function isMapEventFor(event: CampaignEvent, mapId: string): boolean {
  if ('mapId' in event.payload && event.payload.mapId === mapId) {
    return true;
  }

  return event.type === 'map:created' && event.payload.map.id === mapId;
}

function buildMovedTokenSnapshot(snapshot: MapSnapshot, tokenId: string, x: number, y: number): MapToken[] {
  return snapshot.tokens.map(token =>
    token.id === tokenId ? { ...token, x, y } : token,
  );
}

export function resolveMapIntent(snapshot: MapSnapshot, intent: MapIntent): CampaignEventInput {
  switch (intent.type) {
    case 'map:tokens_replace':
      return { type: 'map:tokens_updated', source: 'local-ui', payload: { mapId: snapshot.mapId, tokens: intent.tokens } };
    case 'map:token_move':
      return {
        type: 'map:tokens_updated',
        source: 'local-ui',
        payload: { mapId: snapshot.mapId, tokens: buildMovedTokenSnapshot(snapshot, intent.tokenId, intent.x, intent.y) },
      };
    case 'map:token_move_cell': {
      const nextPosition = getCellCenter(intent.cell, snapshot.gridSettings);
      return {
        type: 'map:tokens_updated',
        source: 'local-ui',
        payload: { mapId: snapshot.mapId, tokens: buildMovedTokenSnapshot(snapshot, intent.tokenId, nextPosition.x, nextPosition.y) },
      };
    }
    case 'map:token_damage':
      return {
        type: 'map:tokens_updated',
        source: 'local-ui',
        payload: {
          mapId: snapshot.mapId,
          tokens: snapshot.tokens.map(token => {
            if (token.id !== intent.tokenId) return token;
            const currentHp = token.hp ?? token.maxHp ?? 10;
            return { ...token, hp: Math.max(0, currentHp - intent.damage) };
          }),
        },
      };
    case 'map:token_upsert': {
      const existing = snapshot.tokens.some(token => token.id === intent.token.id);
      return {
        type: 'map:tokens_updated',
        source: 'local-ui',
        payload: {
          mapId: snapshot.mapId,
          tokens: existing
            ? snapshot.tokens.map(token => token.id === intent.token.id ? intent.token : token)
            : [...snapshot.tokens, intent.token],
        },
      };
    }
    case 'map:token_remove':
      return {
        type: 'map:tokens_updated',
        source: 'local-ui',
        payload: {
          mapId: snapshot.mapId,
          tokens: snapshot.tokens.filter(token => token.id !== intent.tokenId),
        },
      };
    case 'map:grid_update':
      return { type: 'map:grid_updated', source: 'local-ui', payload: { mapId: snapshot.mapId, gridSettings: intent.gridSettings } };
    case 'map:obstacles_replace':
      return { type: 'map:obstacles_updated', source: 'local-ui', payload: { mapId: snapshot.mapId, obstacles: intent.obstacles } };
  }
}

export function mapCollectionSnapshotFromCampaign(snapshot: CampaignSnapshot): MapCollectionSnapshot {
  return {
    maps: snapshot.maps,
    version: snapshot.campaign.version,
  };
}

export function mapSnapshotFromCampaign(
  snapshot: CampaignSnapshot,
  mapId: string,
  fallbackGridSettings: GridSettings,
): MapSnapshot {
  const mapState: MapStateSnapshot | undefined = snapshot.mapStates[mapId];

  return {
    mapId,
    tokens: mapState?.tokens ?? [],
    gridSettings: mapState?.gridSettings ?? fallbackGridSettings,
    obstacles: mapState?.obstacles ?? [],
    version: snapshot.campaign.version,
  };
}

export class MapCollectionSession {
  private version = 0;
  private readonly listeners = new Set<MapCollectionListener>();
  private readonly unsubscribeSync: () => void;

  constructor(private readonly options: SessionOptions = {}) {
    this.unsubscribeSync = (this.options.sync ?? campaignSync).subscribe(event => {
      if (!isMapCollectionEvent(event)) return;
      this.version += 1;
      this.emit();
    });
  }

  getSnapshot(): MapCollectionSnapshot {
    return {
      maps: getMaps(this.options.store),
      version: this.version,
    };
  }

  subscribe(listener: MapCollectionListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeSync();
      }
    };
  }

  createMap(map: MapEntry): MapEntry[] {
    return createMap(map, this.options);
  }

  removeMap(mapId: string): MapEntry[] {
    return removeMap(mapId, this.options);
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}

export class MapSession {
  private version = 0;
  private readonly listeners = new Set<MapListener>();
  private readonly unsubscribeSync: () => void;

  constructor(
    private readonly mapId: string,
    private readonly fallbackGridSettings: GridSettings,
    private readonly options: SessionOptions = {},
  ) {
    this.unsubscribeSync = (this.options.sync ?? campaignSync).subscribe(event => {
      if (!isMapEventFor(event, this.mapId)) return;
      this.version += 1;
      this.emit();
    });
  }

  getSnapshot(): MapSnapshot {
    return {
      mapId: this.mapId,
      tokens: loadMapTokens(this.mapId, this.options.store),
      gridSettings: loadGridSettings(this.mapId, this.fallbackGridSettings, this.options.store),
      obstacles: loadObstacles(this.mapId, this.options.store),
      version: this.version,
    };
  }

  subscribe(listener: MapListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
      if (this.listeners.size === 0) {
        this.unsubscribeSync();
      }
    };
  }

  dispatch(intent: MapIntent): void {
    const event = resolveMapIntent(this.getSnapshot(), intent);

    switch (event.type) {
      case 'map:tokens_updated':
        replaceMapTokens(this.mapId, event.payload.tokens, this.options);
        return;
      case 'map:grid_updated':
        saveMapGridSettings(this.mapId, event.payload.gridSettings, this.options);
        return;
      case 'map:obstacles_updated':
        replaceMapObstacles(this.mapId, event.payload.obstacles, this.options);
        return;
    }
  }

  private emit(): void {
    const snapshot = this.getSnapshot();
    this.listeners.forEach(listener => listener(snapshot));
  }
}
