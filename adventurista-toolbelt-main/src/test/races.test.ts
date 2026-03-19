import { describe, expect, it } from 'vitest';
import { applyRaceAbilityBonuses, getRaceAbilityBonuses, getRaceProfile, type AbilityScore } from '@/lib/types';

const baseAbilities: AbilityScore[] = [
  { name: 'STR', score: 10 },
  { name: 'DEX', score: 10 },
  { name: 'CON', score: 10 },
  { name: 'INT', score: 10 },
  { name: 'WIS', score: 10 },
  { name: 'CHA', score: 10 },
];

describe('race ability modifiers', () => {
  it('applies static racial bonuses for subraces', () => {
    const result = applyRaceAbilityBonuses(baseAbilities, 'Mountain Dwarf');

    expect(result.find(ability => ability.name === 'STR')?.score).toBe(12);
    expect(result.find(ability => ability.name === 'CON')?.score).toBe(12);
    expect(result.find(ability => ability.name === 'DEX')?.score).toBe(10);
  });

  it('supports Half-Elf flexible bonuses without duplicating choices', () => {
    const bonuses = getRaceAbilityBonuses('Half-Elf', ['STR', 'STR', 'CHA']);

    expect(bonuses).toEqual({ CHA: 2, STR: 1 });
  });

  it('exposes the requested racial traits', () => {
    expect(getRaceProfile('Tiefling').traits).toContain('Fire resist');
    expect(getRaceProfile('Elf').traits).toEqual(['Darkvision', 'Keen Senses']);
  });
});
