import { describe, expect, it } from 'vitest';
import {
  Character,
  EquipmentItem,
  getEquippedAC,
  getWeaponAttackAbility,
  getWeaponAttackModifier,
  getWeaponDamageModifier,
  isWeaponInRange,
} from '@/lib/types';

function buildCharacter(overrides?: Partial<Character>): Character {
  return {
    id: 'char-test',
    name: 'Test Hero',
    race: 'Human',
    class: 'Fighter',
    level: 1,
    xp: 0,
    hp: 10,
    maxHp: 10,
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
    createdAt: new Date().toISOString(),
    ...overrides,
  };
}

describe('equipment combat helpers', () => {
  it('calculates AC from armor rules and shields', () => {
    const leather: EquipmentItem = {
      id: 'armor-1',
      name: 'Leather Armor',
      weight: 10,
      quantity: 1,
      equipped: true,
      category: 'armor',
      armorType: 'light',
      armorBaseAC: 11,
    };
    const shield: EquipmentItem = {
      id: 'armor-2',
      name: 'Shield',
      weight: 6,
      quantity: 1,
      equipped: true,
      category: 'armor',
      armorType: 'shield',
      acBonus: 2,
    };

    expect(getEquippedAC(buildCharacter({ equipment: [leather, shield] }))).toBe(15);
  });

  it('uses dexterity for finesse weapons when it is better', () => {
    const rapier: EquipmentItem = {
      id: 'weapon-1',
      name: 'Rapier',
      weight: 2,
      quantity: 1,
      equipped: true,
      category: 'weapon',
      damageDie: 8,
      properties: ['finesse'],
    };

    const agileHero = buildCharacter({
      abilities: buildCharacter().abilities.map(ability =>
        ability.name === 'STR'
          ? { ...ability, score: 10 }
          : ability.name === 'DEX'
            ? { ...ability, score: 18 }
            : ability
      ),
    });

    expect(getWeaponAttackAbility(agileHero, rapier)).toBe('DEX');
    expect(getWeaponAttackModifier(agileHero, rapier)).toBe(4);
    expect(getWeaponDamageModifier(agileHero, rapier)).toBe(4);
  });

  it('checks weapon range against the target distance', () => {
    const shortbow: EquipmentItem = {
      id: 'weapon-2',
      name: 'Shortbow',
      weight: 2,
      quantity: 1,
      equipped: true,
      category: 'weapon',
      damageDie: 6,
      range: { normal: 80, long: 320 },
      properties: ['ranged'],
    };

    expect(isWeaponInRange(shortbow, 75)).toBe(true);
    expect(isWeaponInRange(shortbow, 250)).toBe(true);
    expect(isWeaponInRange(shortbow, 400)).toBe(false);
  });
});
