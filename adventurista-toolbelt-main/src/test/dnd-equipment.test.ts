import { describe, expect, it } from 'vitest';
import {
  Character,
  EquipmentItem,
  getEquippedAC,
  getWeaponAttackProfile,
  isWeaponInRange,
} from '@/lib/types';

const buildCharacter = (overrides: Partial<Character> = {}): Character => ({
  id: 'char-1',
  name: 'Aria',
  race: 'Human',
  class: 'Fighter',
  level: 5,
  xp: 0,
  hp: 38,
  maxHp: 38,
  ac: 10,
  speed: 30,
  abilities: [
    { name: 'STR', score: 16 },
    { name: 'DEX', score: 14 },
    { name: 'CON', score: 14 },
    { name: 'INT', score: 10 },
    { name: 'WIS', score: 10 },
    { name: 'CHA', score: 8 },
  ],
  equipment: [],
  createdAt: new Date(0).toISOString(),
  ...overrides,
});

describe('D&D equipment helpers', () => {
  it('applies equipped armor and shield bonuses to AC using armor class rules', () => {
    const armor: EquipmentItem = {
      id: 'armor-1',
      name: 'Scale Mail',
      weight: 45,
      quantity: 1,
      equipped: true,
      category: 'armor',
      acBonus: 4,
      armorType: 'medium',
    };
    const shield: EquipmentItem = {
      id: 'shield-1',
      name: 'Shield',
      weight: 6,
      quantity: 1,
      equipped: true,
      category: 'armor',
      acBonus: 2,
      armorType: 'shield',
    };

    const character = buildCharacter({ equipment: [armor, shield] });

    expect(getEquippedAC(character)).toBe(18);
  });

  it('uses dexterity for ranged attacks and adds proficiency to hit', () => {
    const character = buildCharacter({
      abilities: [
        { name: 'STR', score: 10 },
        { name: 'DEX', score: 18 },
        { name: 'CON', score: 14 },
        { name: 'INT', score: 10 },
        { name: 'WIS', score: 10 },
        { name: 'CHA', score: 8 },
      ],
    });

    const shortbow: EquipmentItem = {
      id: 'weapon-1',
      name: 'Shortbow',
      weight: 2,
      quantity: 1,
      equipped: true,
      category: 'weapon',
      damageDie: 6,
      damageDiceCount: 1,
      range: { normal: 80, long: 320 },
      properties: ['ranged', 'two-handed'],
    };

    const profile = getWeaponAttackProfile(character, shortbow);

    expect(profile.attackAbility).toBe('DEX');
    expect(profile.attackBonus).toBe(7);
    expect(profile.damageBonus).toBe(4);
  });

  it('enforces melee and ranged weapon distance limits', () => {
    const sword: EquipmentItem = {
      id: 'weapon-2',
      name: 'Longsword',
      weight: 3,
      quantity: 1,
      equipped: true,
      category: 'weapon',
      damageDie: 8,
      damageDiceCount: 1,
    };
    const javelin: EquipmentItem = {
      id: 'weapon-3',
      name: 'Javelin',
      weight: 2,
      quantity: 1,
      equipped: true,
      category: 'weapon',
      damageDie: 6,
      damageDiceCount: 1,
      range: { normal: 30, long: 120 },
      properties: ['thrown'],
    };

    expect(isWeaponInRange(5, sword)).toBe(true);
    expect(isWeaponInRange(10, sword)).toBe(false);
    expect(isWeaponInRange(100, javelin)).toBe(true);
    expect(isWeaponInRange(130, javelin)).toBe(false);
  });
});
