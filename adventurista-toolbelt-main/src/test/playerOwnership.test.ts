import { describe, expect, it } from 'vitest';
import {
  assignCharacterOwner,
  canControlToken,
  canLinkCharacter,
  canManageCharacter,
  clearCharacterOwner,
  getCharacterOwnerLabel,
} from '@/lib/playerOwnership';
import type { Character, MapToken } from '@/lib/types';

const character: Character = {
  id: 'char-1',
  name: 'Aria',
  race: 'Human',
  class: 'Fighter',
  level: 2,
  xp: 300,
  hp: 16,
  maxHp: 16,
  ac: 16,
  speed: 30,
  abilities: [
    { name: 'STR', score: 16 },
    { name: 'DEX', score: 14 },
    { name: 'CON', score: 14 },
    { name: 'INT', score: 10 },
    { name: 'WIS', score: 12 },
    { name: 'CHA', score: 8 },
  ],
  equipment: [],
  createdAt: '2026-03-19T00:00:00.000Z',
};

describe('player ownership', () => {
  it('assigns and clears character ownership metadata', () => {
    const linked = assignCharacterOwner(character, { id: 'player-1', name: 'Ari Tablet' });

    expect(linked.ownerPlayerId).toBe('player-1');
    expect(getCharacterOwnerLabel(linked)).toBe('Ari Tablet');
    expect(clearCharacterOwner(linked).ownerPlayerId).toBeUndefined();
  });

  it('restricts character management to the owner or DM', () => {
    const linked = assignCharacterOwner(character, { id: 'player-1', name: 'Ari Tablet' });

    expect(canManageCharacter(linked, false, 'player-1')).toBe(true);
    expect(canManageCharacter(linked, false, 'player-2')).toBe(false);
    expect(canManageCharacter(linked, true, 'player-2')).toBe(true);
    expect(canLinkCharacter(linked, false, 'player-2')).toBe(false);
  });

  it('restricts token control to the owning player or DM', () => {
    const token: MapToken = {
      id: 'token-1',
      label: 'Aria',
      x: 100,
      y: 100,
      color: 'blue',
      type: 'character',
      ownerPlayerId: 'player-1',
    };

    expect(canControlToken(token, false, 'player-1')).toBe(true);
    expect(canControlToken(token, false, 'player-2')).toBe(false);
    expect(canControlToken(token, true, 'player-2')).toBe(true);
    expect(canControlToken({ ...token, type: 'monster' }, false, 'player-1')).toBe(false);
  });
});
