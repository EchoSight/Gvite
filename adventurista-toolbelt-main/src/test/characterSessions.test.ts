import { describe, expect, it } from 'vitest';
import { characterCollectionSnapshotFromCampaign } from '@/hooks/useCharacterSessions';
import type { Character } from '@/lib/types';

const character: Character = {
  id: 'char-1',
  name: 'Aria',
  race: 'Human',
  class: 'Fighter',
  level: 2,
  xp: 300,
  hp: 16,
  maxHp: 16,
  ac: 0,
  speed: 30,
  abilities: [
    { name: 'STR', score: 16 },
    { name: 'DEX', score: 14 },
    { name: 'CON', score: 14 },
    { name: 'INT', score: 10 },
    { name: 'WIS', score: 12 },
    { name: 'CHA', score: 8 },
  ],
  equipment: [
    { id: 'armor-1', name: 'Chain Mail', category: 'armor', weight: 55, quantity: 1, equipped: true, armorClass: 16 },
  ],
  createdAt: '2026-03-19T00:00:00.000Z',
};

describe('character sessions', () => {
  it('derives hosted character snapshots from campaign snapshots', () => {
    const snapshot = characterCollectionSnapshotFromCampaign({
      campaign: {
        version: 7,
      },
      characters: [character],
    });

    expect(snapshot).toEqual({
      version: 7,
      characters: [expect.objectContaining({ id: 'char-1', ac: 12 })],
    });
  });
});
