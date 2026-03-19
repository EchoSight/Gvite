import { describe, expect, it } from 'vitest';
import {
  addCharacter,
  deleteMap,
  getCharacters,
  getGameRole,
  getMaps,
  loadGridSettings,
  loadMapTokens,
  saveGridSettings,
  saveMaps,
  saveMapTokens,
  setGameRole,
} from '@/lib/repositories';
import { MemoryStore } from '@/lib/storage';
import type { Character } from '@/lib/types';

function makeCharacter(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Aria',
    race: 'Human',
    class: 'Fighter',
    level: 1,
    xp: 0,
    hp: 12,
    maxHp: 12,
    ac: 10,
    speed: 30,
    abilities: [
      { name: 'STR', score: 16 },
      { name: 'DEX', score: 14 },
      { name: 'CON', score: 12 },
      { name: 'INT', score: 10 },
      { name: 'WIS', score: 10 },
      { name: 'CHA', score: 8 },
    ],
    equipment: [],
    createdAt: '2026-03-19T00:00:00.000Z',
    ...overrides,
  };
}

describe('repositories', () => {
  it('stores role and falls back to player', () => {
    const store = new MemoryStore();

    expect(getGameRole(store)).toBe('player');

    setGameRole('dm', store);

    expect(getGameRole(store)).toBe('dm');
  });

  it('recomputes character AC when loading stored characters', () => {
    const store = new MemoryStore();
    addCharacter(makeCharacter(), store);

    const [character] = getCharacters(store);

    expect(character.ac).toBe(12);
  });

  it('stores map state and removes related map records on delete', () => {
    const store = new MemoryStore();
    const fallback = {
      showGrid: true,
      gridSize: 40,
      ftPerCell: 5,
      offsetX: 0,
      offsetY: 0,
    };

    saveMaps([
      { id: 'map-1', name: 'Dungeon', image: 'image-data', createdAt: '2026-03-19T00:00:00.000Z' },
    ], store);
    saveMapTokens('map-1', [{ id: 'token-1', label: 'Aria', x: 10, y: 10, color: 'blue', type: 'character' }], store);
    saveGridSettings('map-1', { ...fallback, offsetX: 5 }, store);

    expect(getMaps(store)).toHaveLength(1);
    expect(loadMapTokens('map-1', store)).toHaveLength(1);
    expect(loadGridSettings('map-1', fallback, store).offsetX).toBe(5);

    const remainingMaps = deleteMap('map-1', store);

    expect(remainingMaps).toHaveLength(0);
    expect(getMaps(store)).toHaveLength(0);
    expect(loadMapTokens('map-1', store)).toEqual([]);
    expect(loadGridSettings('map-1', fallback, store)).toEqual(fallback);
  });
});
