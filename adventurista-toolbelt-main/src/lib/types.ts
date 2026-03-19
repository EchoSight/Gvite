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

export interface EquipmentItem {
  id: string;
  name: string;
  weight: number;
  quantity: number;
  equipped: boolean;
  category: 'weapon' | 'armor' | 'gear' | 'consumable';
  // Combat stats
  attackBonus?: number;    // bonus to attack roll
  damageBonus?: number;    // bonus to damage roll
  damageDiceCount?: number; // number of dice rolled for damage
  damageDie?: number;      // e.g. 8 = 1d8
  acBonus?: number;        // bonus to AC when equipped
  armorType?: 'light' | 'medium' | 'heavy' | 'shield';
  armorBaseAC?: number;
  range?: {
    normal: number;
    long?: number;
  };
  properties?: string[];   // e.g. ['finesse', 'light', 'two-handed']
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
  icon?: string; // base64 data URL for character portrait
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

export const DND_CLASSES: DndClass[] = [
  'Barbarian','Bard','Cleric','Druid','Fighter','Monk',
  'Paladin','Ranger','Rogue','Sorcerer','Warlock','Wizard'
];

export const DND_RACES: DndRace[] = [
  'Human','Elf','Dwarf','Halfling','Gnome','Half-Elf','Half-Orc','Tiefling','Dragonborn'
];

export const ABILITY_NAMES: AbilityName[] = ['STR','DEX','CON','INT','WIS','CHA'];

export function getModifier(score: number): number {
  return Math.floor((score - 10) / 2);
}

export function formatModifier(score: number): string {
  const mod = getModifier(score);
  return mod >= 0 ? `+${mod}` : `${mod}`;
}

export function xpForLevel(level: number): number {
  const table = [0,0,300,900,2700,6500,14000,23000,34000,48000,64000,85000,100000,120000,140000,165000,195000,225000,265000,305000,355000];
  return table[Math.min(level, 20)] ?? 355000;
}

export const CLASS_HIT_DIE: Record<DndClass, number> = {
  Barbarian: 12, Bard: 8, Cleric: 8, Druid: 8,
  Fighter: 10, Monk: 8, Paladin: 10, Ranger: 10,
  Rogue: 8, Sorcerer: 6, Warlock: 8, Wizard: 6,
};

export function getEquippedAC(char: Character): number {
  const dex = char.abilities.find(a => a.name === 'DEX');
  const dexMod = dex ? getModifier(dex.score) : 0;
  const equippedArmor = char.equipment.filter(e => e.equipped && e.category === 'armor');
  const shields = equippedArmor.filter(item => item.armorType === 'shield' || item.name === 'Shield');
  const bodyArmor = equippedArmor
    .filter(item => item.armorType !== 'shield' && item.name !== 'Shield')
    .sort((a, b) => (b.armorBaseAC ?? 0) - (a.armorBaseAC ?? 0))[0];

  const shieldBonus = shields.reduce((total, item) => total + (item.acBonus ?? 0), 0);

  if (!bodyArmor) {
    return 10 + dexMod + shieldBonus;
  }

  let dexContribution = dexMod;
  if (bodyArmor.armorType === 'heavy') {
    dexContribution = 0;
  } else if (bodyArmor.armorType === 'medium') {
    dexContribution = Math.min(dexMod, 2);
  }

  return (bodyArmor.armorBaseAC ?? 10) + dexContribution + shieldBonus;
}

export function getEquippedWeapons(char: Character): EquipmentItem[] {
  return char.equipment.filter(e => e.equipped && e.category === 'weapon');
}

export function getAbilityModifier(char: Character, abilityName: AbilityName): number {
  const ability = char.abilities.find(item => item.name === abilityName);
  return getModifier(ability?.score ?? 10);
}

export function getWeaponAttackAbility(char: Character, weapon: EquipmentItem): AbilityName {
  const strMod = getAbilityModifier(char, 'STR');
  const dexMod = getAbilityModifier(char, 'DEX');
  const isRanged = weapon.properties?.includes('ranged');
  const isFinesse = weapon.properties?.includes('finesse');

  if (isRanged) return 'DEX';
  if (isFinesse) return dexMod >= strMod ? 'DEX' : 'STR';
  return 'STR';
}

export function getWeaponAttackModifier(char: Character, weapon: EquipmentItem): number {
  return getAbilityModifier(char, getWeaponAttackAbility(char, weapon)) + (weapon.attackBonus ?? 0);
}

export function getWeaponDamageModifier(char: Character, weapon: EquipmentItem): number {
  return getAbilityModifier(char, getWeaponAttackAbility(char, weapon)) + (weapon.damageBonus ?? 0);
}

export function getWeaponRangeLabel(weapon: EquipmentItem): string {
  if (!weapon.range) return '5 ft';
  const { normal, long } = weapon.range;
  return long ? `${normal}/${long} ft` : `${normal} ft`;
}

export function getWeaponDamageLabel(weapon: EquipmentItem, char?: Character): string {
  const diceCount = weapon.damageDiceCount ?? 1;
  const damageModifier = char ? getWeaponDamageModifier(char, weapon) : (weapon.damageBonus ?? 0);
  const modifierLabel = damageModifier > 0 ? `+${damageModifier}` : damageModifier < 0 ? `${damageModifier}` : '';
  return `${diceCount}d${weapon.damageDie ?? 4}${modifierLabel}`;
}

export function isWeaponInRange(weapon: EquipmentItem, distanceFt: number): boolean {
  const maxRange = weapon.range?.long ?? weapon.range?.normal ?? 5;
  return distanceFt <= maxRange;
}

export const EQUIPMENT_CATALOG: Omit<EquipmentItem, 'id' | 'equipped'>[] = [
  // Weapons — damageDie is the die sides, attackBonus/damageBonus default to 0
  { name: 'Longsword', weight: 3, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 8, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['versatile'] },
  { name: 'Shortbow', weight: 2, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 80, long: 320 }, properties: ['ranged', 'two-handed'] },
  { name: 'Dagger', weight: 1, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 4, attackBonus: 0, damageBonus: 0, range: { normal: 20, long: 60 }, properties: ['finesse', 'light', 'thrown'] },
  { name: 'Greataxe', weight: 7, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 12, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['heavy', 'two-handed'] },
  { name: 'Handaxe', weight: 2, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 20, long: 60 }, properties: ['light', 'thrown'] },
  { name: 'Javelin', weight: 2, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 30, long: 120 }, properties: ['thrown'] },
  { name: 'Mace', weight: 4, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 5 } },
  { name: 'Quarterstaff', weight: 4, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['versatile'] },
  { name: 'Rapier', weight: 2, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 8, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['finesse'] },
  { name: 'Greatsword', weight: 6, quantity: 1, category: 'weapon', damageDiceCount: 2, damageDie: 6, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['heavy', 'two-handed'] },
  { name: 'Light Crossbow', weight: 5, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 8, attackBonus: 0, damageBonus: 0, range: { normal: 80, long: 320 }, properties: ['ranged', 'two-handed'] },
  { name: 'Warhammer', weight: 2, quantity: 1, category: 'weapon', damageDiceCount: 1, damageDie: 8, attackBonus: 0, damageBonus: 0, range: { normal: 5 }, properties: ['versatile'] },

  // Armor — uses D&D base AC rules plus shield bonus
  { name: 'Chain Mail', weight: 55, quantity: 1, category: 'armor', armorType: 'heavy', armorBaseAC: 16, properties: ['heavy'] },
  { name: 'Leather Armor', weight: 10, quantity: 1, category: 'armor', armorType: 'light', armorBaseAC: 11, properties: ['light'] },
  { name: 'Scale Mail', weight: 45, quantity: 1, category: 'armor', armorType: 'medium', armorBaseAC: 14, properties: ['medium'] },
  { name: 'Shield', weight: 6, quantity: 1, category: 'armor', armorType: 'shield', acBonus: 2, properties: ['shield'] },
  { name: 'Studded Leather', weight: 13, quantity: 1, category: 'armor', armorType: 'light', armorBaseAC: 12, properties: ['light'] },
  { name: 'Half Plate', weight: 40, quantity: 1, category: 'armor', armorType: 'medium', armorBaseAC: 15, properties: ['medium'] },
  { name: 'Plate', weight: 65, quantity: 1, category: 'armor', armorType: 'heavy', armorBaseAC: 18, properties: ['heavy'] },

  // Gear
  { name: 'Backpack', weight: 5, quantity: 1, category: 'gear' },
  { name: 'Rope (50 ft)', weight: 10, quantity: 1, category: 'gear' },
  { name: 'Torch', weight: 1, quantity: 5, category: 'gear' },
  { name: 'Tinderbox', weight: 1, quantity: 1, category: 'gear' },

  // Consumables
  { name: 'Rations (1 day)', weight: 2, quantity: 5, category: 'consumable' },
  { name: 'Healing Potion', weight: 0.5, quantity: 1, category: 'consumable', damageDiceCount: 2, damageDie: 4, damageBonus: 2, properties: ['healing'] },
  { name: 'Antitoxin', weight: 0, quantity: 1, category: 'consumable' },
];
