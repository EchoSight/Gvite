import { describe, expect, it } from 'vitest';
import { createMap, createResource, removeMap, replaceMapTokens, saveMapGridSettings, setRole } from '@/lib/campaignMutations';
import { LocalCampaignSync } from '@/lib/campaignSync';
import { getGameRole, getMaps, getResources, loadGridSettings, loadMapTokens } from '@/lib/repositories';
import { MemoryStore } from '@/lib/storage';

const defaultGridSettings = {
  showGrid: true,
  gridSize: 40,
  ftPerCell: 5,
  offsetX: 0,
  offsetY: 0,
};

describe('campaign mutations', () => {
  it('persists role changes and emits a role event', () => {
    const store = new MemoryStore();
    const sync = new LocalCampaignSync();

    setRole('dm', { store, sync });

    expect(getGameRole(store)).toBe('dm');
    expect(sync.getEventLog()).toEqual([
      expect.objectContaining({
        type: 'role:set',
        source: 'local-ui',
        payload: { role: 'dm' },
      }),
    ]);
  });

  it('creates map state mutations and emits map events', () => {
    const store = new MemoryStore();
    const sync = new LocalCampaignSync();
    const map = { id: 'map-1', name: 'Dungeon', image: 'img', createdAt: '2026-03-19T00:00:00.000Z' };
    const tokens = [{ id: 'token-1', label: 'Aria', x: 15, y: 20, color: 'blue', type: 'character' as const }];

    createMap(map, { store, sync });
    replaceMapTokens('map-1', tokens, { store, sync });
    saveMapGridSettings('map-1', { ...defaultGridSettings, offsetX: 8 }, { store, sync });
    const remainingMaps = removeMap('map-1', { store, sync });

    expect(getMaps(store)).toEqual([]);
    expect(remainingMaps).toEqual([]);
    expect(loadMapTokens('map-1', store)).toEqual([]);
    expect(loadGridSettings('map-1', defaultGridSettings, store)).toEqual(defaultGridSettings);
    expect(sync.getEventLog().map(event => event.type)).toEqual([
      'map:created',
      'map:tokens_updated',
      'map:grid_updated',
      'map:deleted',
    ]);
  });

  it('creates resources and emits resource events', () => {
    const store = new MemoryStore();
    const sync = new LocalCampaignSync();
    const resource = {
      id: 'res-custom',
      title: 'Town Notes',
      description: 'Session prep',
      tags: ['lore'],
      type: 'lore' as const,
      content: 'A hidden cellar lies beneath the inn.',
      createdAt: '2026-03-19T00:00:00.000Z',
    };

    createResource(resource, { store, sync });

    expect(getResources(store)).toContainEqual(resource);
    expect(sync.getEventLog()).toEqual([
      expect.objectContaining({
        type: 'resource:created',
        payload: { resource },
      }),
    ]);
  });
});
