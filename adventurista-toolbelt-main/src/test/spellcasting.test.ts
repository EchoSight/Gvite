import { describe, expect, it } from 'vitest';
import type { Character } from '@/lib/types';
import {
  clearConcentration,
  createSpellcastingState,
  markConcentrationSpell,
  normalizeCharacterSpellcasting,
  resetSpellcastingForLongRest,
  resetSpellcastingForShortRest,
  spendSpellSlot,
} from '@/lib/spellcasting';

function makeWizard(overrides: Partial<Character> = {}): Character {
  return {
    id: 'char-1',
    name: 'Aria',
    race: 'Elf',
    class: 'Wizard',
    level: 5,
    xp: 6500,
    hp: 24,
    maxHp: 24,
    ac: 13,
    speed: 30,
    abilities: [
      { name: 'STR', score: 8 },
      { name: 'DEX', score: 14 },
      { name: 'CON', score: 14 },
      { name: 'INT', score: 16 },
      { name: 'WIS', score: 12 },
      { name: 'CHA', score: 10 },
    ],
    equipment: [],
    createdAt: '2026-03-19T00:00:00.000Z',
    spellcasting: createSpellcastingState('Wizard', 5),
    ...overrides,
  };
}

describe('spellcasting helpers', () => {
  it('creates and normalizes class spellcasting stats', () => {
    const character = normalizeCharacterSpellcasting(makeWizard());

    expect(character.spellcasting?.spellSaveDc).toBe(14);
    expect(character.spellcasting?.spellAttackBonus).toBe(6);
    expect(character.spellcasting?.slots.find(slot => slot.level === 3)).toEqual({ level: 3, max: 2, used: 0 });
  });

  it('spends slots and clears them on long rest', () => {
    const spent = spendSpellSlot(makeWizard(), 1);
    expect(spent.spellcasting?.slots.find(slot => slot.level === 1)?.used).toBe(1);

    const concentrating = markConcentrationSpell(spent, 'fireball');
    expect(concentrating.spellcasting?.concentrationSpellName).toBe('Fireball');

    const restored = resetSpellcastingForLongRest(concentrating);
    expect(restored.spellcasting?.slots.find(slot => slot.level === 1)?.used).toBe(0);
    expect(restored.spellcasting?.concentrationSpellId).toBeNull();
  });

  it('restores pact slots on short rest and clears concentration manually', () => {
    const warlock = {
      ...makeWizard({ class: 'Warlock', level: 5, spellcasting: createSpellcastingState('Warlock', 5) }),
      abilities: makeWizard().abilities.map(ability => ability.name === 'CHA' ? { ...ability, score: 16 } : ability),
    };
    const spent = spendSpellSlot(warlock, 3, true);
    expect(spent.spellcasting?.pactSlots?.used).toBe(1);

    const rested = resetSpellcastingForShortRest(spent);
    expect(rested.spellcasting?.pactSlots?.used).toBe(0);

    const focused = markConcentrationSpell(rested, 'spirit-guardians');
    expect(clearConcentration(focused).spellcasting?.concentrationSpellId).toBeNull();
  });
});
