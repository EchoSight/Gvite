import { describe, expect, it } from 'vitest';
import { createMap } from '@/lib/campaignMutations';
import { LocalCampaignSync } from '@/lib/campaignSync';
import { getCellCenter, getCellFromPoint, getCellLabel, getCellLabelFromPoint } from '@/lib/gridCoordinates';
import {
  MapCollectionSession,
  MapSession,
  mapCollectionSnapshotFromCampaign,
  mapSnapshotFromCampaign,
  resolveMapIntent,
} from '@/lib/mapSessions';
import { MemoryStore } from '@/lib/storage';

const defaultGridSettings = {
  showGrid: true,
  gridSize: 40,
  ftPerCell: 5,
  offsetX: 0,
  offsetY: 0,
};

describe('map sessions', () => {
  it('converts map positions to spreadsheet-style grid coordinates', () => {
    const cell = getCellFromPoint(85, 125, defaultGridSettings);
    const center = getCellCenter(cell, defaultGridSettings);

    expect(cell).toEqual({ col: 2, row: 3 });
    expect(center).toEqual({ x: 100, y: 140 });
    expect(getCellLabel(cell)).toBe('C4');
    expect(getCellLabelFromPoint(85, 125, defaultGridSettings)).toBe('C4');
  });

  it('exposes authoritative map snapshots and applies dispatched intents', () => {
    const store = new MemoryStore();
    const sync = new LocalCampaignSync();
    createMap({ id: 'map-1', name: 'Dungeon', image: 'img', createdAt: '2026-03-19T00:00:00.000Z' }, { store, sync });

    const session = new MapSession('map-1', defaultGridSettings, { store, sync });
    const observedVersions: number[] = [];
    const unsubscribe = session.subscribe(snapshot => observedVersions.push(snapshot.version));

    session.dispatch({
      type: 'map:token_upsert',
      token: { id: 'token-1', label: 'Aria', x: 10, y: 15, color: 'blue', type: 'character', hp: 20, maxHp: 20 },
    });
    session.dispatch({ type: 'map:token_move_cell', tokenId: 'token-1', cell: { col: 1, row: 5 } });
    session.dispatch({ type: 'map:token_damage', tokenId: 'token-1', damage: 7 });
    session.dispatch({ type: 'map:grid_update', gridSettings: { ...defaultGridSettings, offsetX: 12 } });
    session.dispatch({
      type: 'map:obstacles_replace',
      obstacles: [{ id: 'obs-1', type: 'line', x1: 0, y1: 0, x2: 20, y2: 20, blocksVision: true, blocksMovement: false }],
    });
    session.dispatch({
      type: 'map:spell_template_upsert',
      spellTemplate: {
        id: 'spell-1',
        label: 'Fireball',
        shape: 'circle',
        origin: { x: 120, y: 160 },
        sizeFt: 20,
        color: 'orange',
        opacity: 0.2,
        createdAt: '2026-03-19T00:00:00.000Z',
      },
    });

    const snapshot = session.getSnapshot();
    unsubscribe();

    expect(snapshot.version).toBe(6);
    expect(observedVersions).toEqual([1, 2, 3, 4, 5, 6]);
    expect(snapshot.tokens).toEqual([
      expect.objectContaining({ id: 'token-1', x: 60, y: 220, hp: 13, maxHp: 20 }),
    ]);
    expect(snapshot.gridSettings.offsetX).toBe(12);
    expect(snapshot.obstacles).toEqual([
      expect.objectContaining({ id: 'obs-1', type: 'line' }),
    ]);
    expect(snapshot.spellTemplates).toEqual([
      expect.objectContaining({ id: 'spell-1', label: 'Fireball', shape: 'circle' }),
    ]);
  });

  it('keeps the map collection snapshot in sync with create and delete events', () => {
    const store = new MemoryStore();
    const sync = new LocalCampaignSync();
    const session = new MapCollectionSession({ store, sync });
    const versions: number[] = [];
    const unsubscribe = session.subscribe(snapshot => versions.push(snapshot.version));

    session.createMap({ id: 'map-1', name: 'Dungeon', image: 'img', createdAt: '2026-03-19T00:00:00.000Z' });
    session.removeMap('map-1');

    const snapshot = session.getSnapshot();
    unsubscribe();

    expect(snapshot.maps).toEqual([]);
    expect(snapshot.version).toBe(2);
    expect(versions).toEqual([1, 2]);
  });

  it('derives hosted map events and snapshots from campaign snapshots', () => {
    const campaignSnapshot = {
      campaign: {
        id: 'camp-1',
        name: 'The Vale',
        createdAt: '2026-03-19T00:00:00.000Z',
        updatedAt: '2026-03-19T00:00:00.000Z',
        version: 7,
      },
      characters: [],
      resources: [],
      maps: [{ id: 'map-1', name: 'Dungeon', image: '/map.png', createdAt: '2026-03-19T00:00:00.000Z' }],
      mapStates: {
        'map-1': {
          mapId: 'map-1',
          tokens: [{ id: 'token-1', label: 'Aria', x: 40, y: 80, color: 'blue', type: 'character', hp: 10, maxHp: 12 }],
          gridSettings: { ...defaultGridSettings, offsetX: 8 },
          obstacles: [],
          spellTemplates: [],
        },
      },
      events: [],
    };

    expect(mapCollectionSnapshotFromCampaign(campaignSnapshot).version).toBe(7);
    expect(mapSnapshotFromCampaign(campaignSnapshot, 'map-1', defaultGridSettings)).toEqual({
      mapId: 'map-1',
      tokens: [expect.objectContaining({ id: 'token-1', x: 40, y: 80 })],
      gridSettings: expect.objectContaining({ offsetX: 8 }),
      obstacles: [],
      spellTemplates: [],
      version: 7,
    });

    const derivedEvent = resolveMapIntent(
      mapSnapshotFromCampaign(campaignSnapshot, 'map-1', defaultGridSettings),
      { type: 'map:token_move', tokenId: 'token-1', x: 120, y: 140 },
    );
    expect(derivedEvent).toEqual({
      type: 'map:token_move_intent',
      source: 'local-ui',
      payload: {
        mapId: 'map-1',
        tokenId: 'token-1',
        x: 120,
        y: 140,
      },
    });
  });
});
