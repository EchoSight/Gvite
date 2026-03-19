export type AbilityName = 'STR' | 'DEX' | 'CON' | 'INT' | 'WIS' | 'CHA';

export interface AbilityScore {
  name: AbilityName;
  score: number;
}

export type DndClass =
  | 'Barbarian' | 'Bard' | 'Cleric' | 'Druid'
  | 'Fighter' | 'Monk' | 'Paladin' | 'Ranger'
  | 'Rogue' | 'Sorcerer' | 'Warlock' | 'Wizard';

export type DndRace =
  | 'Human' | 'Elf' | 'Dwarf' | 'Halfling'
  | 'Gnome' | 'Half-Elf' | 'Half-Orc' | 'Tiefling' | 'Dragonborn';

export type EquipmentCategory = 'weapon' | 'armor' | 'gear' | 'consumable';
export type ArmorType = 'light' | 'medium' | 'heavy' | 'shield';

export interface EquipmentItem {
  id: string;
  name: string;
  weight: number;
  quantity: number;
  equipped: boolean;
  category: EquipmentCategory;
  attackBonus?: number;
  damageBonus?: number;
  damageDie?: number;
  damageDiceCount?: number;
  acBonus?: number;
  armorType?: ArmorType;
  range?: {
    normal: number;
    long?: number;
  };
  properties?: string[];
}

export interface Character {
  id: string;
  name: string;
  race: DndRace;
  class: DndClass;
  level: number;
  xp: number;
  hp: number;
  maxHp: number;
  ac: number;
  speed: number;
  abilities: AbilityScore[];
  equipment: EquipmentItem[];
  icon?: string;
  createdAt: string;
}

export interface CampaignResource {
  id: string;
  title: string;
  description: string;
  tags: string[];
  type: 'map' | 'lore' | 'rules' | 'handout';
  content: string;
  createdAt: string;
}

export interface WeaponAttackProfile {
  attackAbility: AbilityName;
  attackModifier: number;
  damageModifier: number;
  attackBonus: number;
  damageBonus: number;
  damageDiceCount: number;
  damageDie: number;
  range?: EquipmentItem['range'];
  rangeLabel: string;
}

export const DND_CLASSES: DndClass[] = [
  'Barbarian', 'Bard', 'Cleric', 'Druid', 'Fighter', 'Monk',
  'Paladin', 'Ranger', 'Rogue', 'Sorcerer', 'Warlock', 'Wizard',
];

export const DND_RACES: DndRace[] = [
  'Human', 'Elf', 'Dwarf', 'Halfling', 'Gnome', 'Half-Elf', 'Half-Orc', 'Tiefling', 'Dragonborn',
];

export const ABILITY_NAMES: AbilityName[] = ['STR', 'DEX', 'CON', 'INT', 'WIS', 'CHA'];

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(score: number): string {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function formatSignedNumber(value: number): string {
  return value >= 0 ? `+${value}` : `${value}`;
}

export function xpForLevel(level: number): number {
  const table = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
  return table[Math.min(level, 20)] ?? 355000;
}

export const CLASS_HIT_DIE: Record<DndClass, number> = {
  Barbarian: 12,
  Bard: 8,
  Cleric: 8,
  Druid: 8,
  Fighter: 10,
  Monk: 8,
  Paladin: 10,
  Ranger: 10,
  Rogue: 8,
  Sorcerer: 6,
  Warlock: 8,
  Wizard: 6,
};

export function getAbilityScore(character: Character, abilityName: AbilityName): number {
  return character.abilities.find(ability => ability.name === abilityName)?.score ?? 10;
}

export function getAbilityModifier(character: Character, abilityName: AbilityName): number {
  return getModifier(getAbilityScore(character, abilityName));
}

export function getProficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function formatDamageRoll(item: EquipmentItem): string {
  const count = item.damageDiceCount ?? 1;
  const die = item.damageDie ?? 1;
  const bonus = item.damageBonus ?? 0;
  return `${count}d${die}${bonus > 0 ? `+${bonus}` : bonus < 0 ? bonus : ''}`;
}

export function formatRange(item: EquipmentItem): string {
  if (!item.range) return 'Melee';
  return item.range.long ? `${item.range.normal}/${item.range.long} ft` : `${item.range.normal} ft`;
}

export function getEquippedArmor(character: Character): EquipmentItem[] {
  return character.equipment.filter(item => item.equipped && item.category === 'armor');
}

export function getEquippedAC(character: Character): number {
  const dexMod = getAbilityModifier(character, 'DEX');
  const equippedArmor = getEquippedArmor(character);
  const bodyArmor = equippedArmor.find(item => item.armorType && item.armorType !== 'shield');
  const shieldBonus = equippedArmor
    .filter(item => item.armorType === 'shield')
    .reduce((total, item) => total + (item.acBonus ?? 0), 0);

  let baseAC = 10 + dexMod;

  if (bodyArmor) {
    const armorBonus = bodyArmor.acBonus ?? 0;
    switch (bodyArmor.armorType) {
      case 'light':
        baseAC = 10 + armorBonus + dexMod;
        break;
      case 'medium':
        baseAC = 10 + armorBonus + Math.min(dexMod, 2);
        break;
      case 'heavy':
        baseAC = 10 + armorBonus;
        break;
      default:
        baseAC = 10 + dexMod + armorBonus;
    }
  }

  return baseAC + shieldBonus;
}

export function getEquippedWeapons(char: Character): EquipmentItem[] {
  return char.equipment.filter(item => item.equipped && item.category === 'weapon');
}

export function getWeaponAttackProfile(character: Character, weapon: EquipmentItem): WeaponAttackProfile {
  const isFinesse = weapon.properties?.includes('finesse') ?? false;
  const isRanged = weapon.properties?.includes('ranged') ?? false;
  const isThrown = weapon.properties?.includes('thrown') ?? false;

  const strengthMod = getAbilityModifier(character, 'STR');
  const dexterityMod = getAbilityModifier(character, 'DEX');

  let attackAbility: AbilityName = 'STR';
  let abilityModifier = strengthMod;

  if (isRanged) {
    attackAbility = 'DEX';
    abilityModifier = dexterityMod;
  } else if (isFinesse) {
    attackAbility = dexterityMod >= strengthMod ? 'DEX' : 'STR';
    abilityModifier = Math.max(strengthMod, dexterityMod);
  } else if (isThrown) {
    attackAbility = 'STR';
    abilityModifier = strengthMod;
  }

  const proficiencyBonus = getProficiencyBonus(character.level);
  const attackBonus = abilityModifier + proficiencyBonus + (weapon.attackBonus ?? 0);
  const damageBonus = abilityModifier + (weapon.damageBonus ?? 0);

  return {
    attackAbility,
    attackModifier: abilityModifier,
    damageModifier: abilityModifier,
    attackBonus,
    damageBonus,
    damageDiceCount: weapon.damageDiceCount ?? 1,
    damageDie: weapon.damageDie ?? 1,
    range: weapon.range,
    rangeLabel: formatRange(weapon),
  };
}

export function isWeaponInRange(distanceFt: number, weapon: EquipmentItem): boolean {
  if (!weapon.range) return distanceFt <= 5;
  const maxRange = weapon.range.long ?? weapon.range.normal;
  return distanceFt <= maxRange;
}

export function getDistanceBetweenPointsInFeet(
  source: { x: number; y: number },
  target: { x: number; y: number },
  gridSize: number,
  ftPerCell: number,
): number {
  const deltaX = source.x - target.x;
  const deltaY = source.y - target.y;
  const distanceInPixels = Math.hypot(deltaX, deltaY);
  const cells = distanceInPixels / gridSize;
  return Math.round(cells * ftPerCell);
}

export const EQUIPMENT_CATALOG: Omit<EquipmentItem, 'id' | 'equipped'>[] = [
  { name: 'Longsword', weight: 3, quantity: 1, category: 'weapon', damageDie: 8, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, properties: ['versatile'] },
  { name: 'Shortbow', weight: 2, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, range: { normal: 80, long: 320 }, properties: ['ranged', 'two-handed'] },
  { name: 'Dagger', weight: 1, quantity: 1, category: 'weapon', damageDie: 4, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, range: { normal: 20, long: 60 }, properties: ['finesse', 'light', 'thrown'] },
  { name: 'Greataxe', weight: 7, quantity: 1, category: 'weapon', damageDie: 12, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, properties: ['heavy', 'two-handed'] },
  { name: 'Handaxe', weight: 2, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, range: { normal: 20, long: 60 }, properties: ['light', 'thrown'] },
  { name: 'Javelin', weight: 2, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, range: { normal: 30, long: 120 }, properties: ['thrown'] },
  { name: 'Mace', weight: 4, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 1, attackBonus: 0, damageBonus: 0 },
  { name: 'Quarterstaff', weight: 4, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, properties: ['versatile'] },
  { name: 'Rapier', weight: 2, quantity: 1, category: 'weapon', damageDie: 8, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, properties: ['finesse'] },
  { name: 'Greatsword', weight: 6, quantity: 1, category: 'weapon', damageDie: 6, damageDiceCount: 2, attackBonus: 0, damageBonus: 0, properties: ['heavy', 'two-handed'] },
  { name: 'Light Crossbow', weight: 5, quantity: 1, category: 'weapon', damageDie: 8, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, range: { normal: 80, long: 320 }, properties: ['ranged', 'two-handed'] },
  { name: 'Warhammer', weight: 2, quantity: 1, category: 'weapon', damageDie: 8, damageDiceCount: 1, attackBonus: 0, damageBonus: 0, properties: ['versatile'] },

  { name: 'Chain Mail', weight: 55, quantity: 1, category: 'armor', acBonus: 6, armorType: 'heavy', properties: ['heavy'] },
  { name: 'Leather Armor', weight: 10, quantity: 1, category: 'armor', acBonus: 1, armorType: 'light', properties: ['light'] },
  { name: 'Scale Mail', weight: 45, quantity: 1, category: 'armor', acBonus: 4, armorType: 'medium', properties: ['medium'] },
  { name: 'Shield', weight: 6, quantity: 1, category: 'armor', acBonus: 2, armorType: 'shield' },
  { name: 'Studded Leather', weight: 13, quantity: 1, category: 'armor', acBonus: 2, armorType: 'light', properties: ['light'] },
  { name: 'Half Plate', weight: 40, quantity: 1, category: 'armor', acBonus: 5, armorType: 'medium', properties: ['medium'] },
  { name: 'Plate', weight: 65, quantity: 1, category: 'armor', acBonus: 8, armorType: 'heavy', properties: ['heavy'] },

  { name: 'Backpack', weight: 5, quantity: 1, category: 'gear' },
  { name: 'Rope (50 ft)', weight: 10, quantity: 1, category: 'gear' },
  { name: 'Torch', weight: 1, quantity: 5, category: 'gear' },
  { name: 'Tinderbox', weight: 1, quantity: 1, category: 'gear' },

  { name: 'Rations (1 day)', weight: 2, quantity: 5, category: 'consumable' },
  { name: 'Healing Potion', weight: 0.5, quantity: 1, category: 'consumable', damageDie: 4, damageDiceCount: 2, damageBonus: 2, properties: ['healing'] },
  { name: 'Antitoxin', weight: 0, quantity: 1, category: 'consumable' },
];
