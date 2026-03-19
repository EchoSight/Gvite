/** @vitest-environment node */
import { mkdtempSync, readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { SqliteCampaignRepository } from '@/server/sqliteCampaignRepository';

const map = { id: 'map-1', name: 'Dungeon', image: 'asset://map-1', createdAt: '2026-03-19T00:00:00.000Z' };
const character = {
  id: 'char-1',
  name: 'Aria',
  race: 'Elf',
  class: 'Wizard',
  level: 3,
  xp: 900,
  hp: 18,
  maxHp: 18,
  ac: 13,
  speed: 30,
  abilities: [],
  equipment: [],
  createdAt: '2026-03-19T00:00:00.000Z',
};

describe('SqliteCampaignRepository', () => {
  it('persists campaign snapshots and assets on disk', () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'adventurista-repo-'));
    const repository = new SqliteCampaignRepository({ rootDir });

    repository.ensureCampaign({ id: 'camp-1', name: 'The Vale' });
    repository.appendEvent('camp-1', { type: 'character:created', source: 'local-ui', payload: { character } });
    repository.appendEvent('camp-1', { type: 'map:created', source: 'local-ui', payload: { map } });
    repository.appendEvent('camp-1', {
      type: 'map:tokens_updated',
      source: 'local-ui',
      payload: { mapId: 'map-1', tokens: [{ id: 'token-1', label: 'Aria', x: 10, y: 12, color: '#fff', type: 'character' }] },
    });

    const storedAsset = repository.storeAsset('camp-1', {
      kind: 'maps',
      filename: 'dungeon-map.txt',
      mimeType: 'text/plain',
      content: 'secret room',
    });

    const snapshot = repository.getSnapshot('camp-1');

    expect(snapshot.campaign.name).toBe('The Vale');
    expect(snapshot.characters).toHaveLength(1);
    expect(snapshot.maps).toEqual([map]);
    expect(snapshot.mapStates['map-1'].tokens[0].label).toBe('Aria');
    expect(snapshot.events).toHaveLength(3);

    const assetPath = join(rootDir, storedAsset.relativePath);
    expect(readFileSync(assetPath, 'utf8')).toBe('secret room');
  });
});
