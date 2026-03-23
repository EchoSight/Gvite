import type {
  AbilityName,
  Character,
  CharacterSpell,
  CharacterSpellcasting,
  DndClass,
  SpellCastingAbility,
  SpellDefinition,
  SpellSlotTrack,
} from './types';
import { getAbilityModifier } from './types';

const SPELLCASTING_CLASSES: Record<DndClass, SpellCastingAbility | null> = {
  Barbarian: null,
  Bard: 'CHA',
  Cleric: 'WIS',
  Druid: 'WIS',
  Fighter: null,
  Monk: null,
  Paladin: 'CHA',
  Ranger: 'WIS',
  Rogue: null,
  Sorcerer: 'CHA',
  Warlock: 'CHA',
  Wizard: 'INT',
};

const PREPARED_CASTER_CLASSES = new Set<DndClass>(['Cleric', 'Druid', 'Paladin', 'Wizard']);
const RITUAL_CASTER_CLASSES = new Set<DndClass>(['Bard', 'Cleric', 'Druid', 'Wizard']);

const FULL_CASTER_SLOTS: Record<number, number[]> = {
  1: [2],
  2: [3],
  3: [4, 2],
  4: [4, 3],
  5: [4, 3, 2],
  6: [4, 3, 3],
  7: [4, 3, 3, 1],
  8: [4, 3, 3, 2],
  9: [4, 3, 3, 3, 1],
  10: [4, 3, 3, 3, 2],
  11: [4, 3, 3, 3, 2, 1],
  12: [4, 3, 3, 3, 2, 1],
  13: [4, 3, 3, 3, 2, 1, 1],
  14: [4, 3, 3, 3, 2, 1, 1],
  15: [4, 3, 3, 3, 2, 1, 1, 1],
  16: [4, 3, 3, 3, 2, 1, 1, 1],
  17: [4, 3, 3, 3, 2, 1, 1, 1, 1],
  18: [4, 3, 3, 3, 3, 1, 1, 1, 1],
  19: [4, 3, 3, 3, 3, 2, 1, 1, 1],
  20: [4, 3, 3, 3, 3, 2, 2, 1, 1],
};

const HALF_CASTER_SLOTS: Record<number, number[]> = {
  1: [],
  2: [2],
  3: [3],
  4: [3],
  5: [4, 2],
  6: [4, 2],
  7: [4, 3],
  8: [4, 3],
  9: [4, 3, 2],
  10: [4, 3, 2],
  11: [4, 3, 3],
  12: [4, 3, 3],
  13: [4, 3, 3, 1],
  14: [4, 3, 3, 1],
  15: [4, 3, 3, 2],
  16: [4, 3, 3, 2],
  17: [4, 3, 3, 3, 1],
  18: [4, 3, 3, 3, 1],
  19: [4, 3, 3, 3, 2],
  20: [4, 3, 3, 3, 2],
};

const WARLOCK_PACT_SLOTS: Record<number, { level: number; max: number }> = {
  1: { level: 1, max: 1 },
  2: { level: 1, max: 2 },
  3: { level: 2, max: 2 },
  4: { level: 2, max: 2 },
  5: { level: 3, max: 2 },
  6: { level: 3, max: 2 },
  7: { level: 4, max: 2 },
  8: { level: 4, max: 2 },
  9: { level: 5, max: 2 },
  10: { level: 5, max: 2 },
  11: { level: 5, max: 3 },
  12: { level: 5, max: 3 },
  13: { level: 5, max: 3 },
  14: { level: 5, max: 3 },
  15: { level: 5, max: 3 },
  16: { level: 5, max: 3 },
  17: { level: 5, max: 4 },
  18: { level: 5, max: 4 },
  19: { level: 5, max: 4 },
  20: { level: 5, max: 4 },
};

export const SPELL_CATALOG: SpellDefinition[] = [
  { id: 'fire-bolt', name: 'Fire Bolt', level: 0, school: 'Evocation', castingTime: 'action', rangeText: '120 ft', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['damage', 'cantrip'] },
  { id: 'ray-of-frost', name: 'Ray of Frost', level: 0, school: 'Evocation', castingTime: 'action', rangeText: '60 ft', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['damage', 'cantrip'] },
  { id: 'sacred-flame', name: 'Sacred Flame', level: 0, school: 'Evocation', castingTime: 'action', rangeText: '60 ft', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['damage', 'cantrip'] },
  { id: 'guidance', name: 'Guidance', level: 0, school: 'Divination', castingTime: 'action', rangeText: 'Touch', durationText: '1 minute', concentration: true, ritual: false, tags: ['buff', 'cantrip'] },
  { id: 'mage-hand', name: 'Mage Hand', level: 0, school: 'Conjuration', castingTime: 'action', rangeText: '30 ft', durationText: '1 minute', concentration: false, ritual: false, tags: ['utility', 'cantrip'] },
  { id: 'shield', name: 'Shield', level: 1, school: 'Abjuration', castingTime: 'reaction', rangeText: 'Self', durationText: '1 round', concentration: false, ritual: false, tags: ['defense'] },
  { id: 'magic-missile', name: 'Magic Missile', level: 1, school: 'Evocation', castingTime: 'action', rangeText: '120 ft', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['damage'] },
  { id: 'burning-hands', name: 'Burning Hands', level: 1, school: 'Evocation', castingTime: 'action', rangeText: 'Self', durationText: 'Instantaneous', concentration: false, ritual: false, area: { shape: 'cone', sizeFt: 15 }, tags: ['damage', 'aoe'] },
  { id: 'thunderwave', name: 'Thunderwave', level: 1, school: 'Evocation', castingTime: 'action', rangeText: 'Self', durationText: 'Instantaneous', concentration: false, ritual: false, area: { shape: 'square', sizeFt: 15 }, tags: ['damage', 'aoe'] },
  { id: 'cure-wounds', name: 'Cure Wounds', level: 1, school: 'Evocation', castingTime: 'action', rangeText: 'Touch', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['healing'] },
  { id: 'healing-word', name: 'Healing Word', level: 1, school: 'Evocation', castingTime: 'bonus', rangeText: '60 ft', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['healing'] },
  { id: 'bless', name: 'Bless', level: 1, school: 'Enchantment', castingTime: 'action', rangeText: '30 ft', durationText: '1 minute', concentration: true, ritual: false, tags: ['buff'] },
  { id: 'guiding-bolt', name: 'Guiding Bolt', level: 1, school: 'Evocation', castingTime: 'action', rangeText: '120 ft', durationText: '1 round', concentration: false, ritual: false, tags: ['damage'] },
  { id: 'spiritual-weapon', name: 'Spiritual Weapon', level: 2, school: 'Evocation', castingTime: 'bonus', rangeText: '60 ft', durationText: '1 minute', concentration: false, ritual: false, tags: ['summon'] },
  { id: 'misty-step', name: 'Misty Step', level: 2, school: 'Conjuration', castingTime: 'bonus', rangeText: 'Self', durationText: 'Instantaneous', concentration: false, ritual: false, tags: ['mobility'] },
  { id: 'flaming-sphere', name: 'Flaming Sphere', level: 2, school: 'Conjuration', castingTime: 'action', rangeText: '60 ft', durationText: '1 minute', concentration: true, ritual: false, area: { shape: 'circle', sizeFt: 5 }, tags: ['damage', 'aoe'] },
  { id: 'fireball', name: 'Fireball', level: 3, school: 'Evocation', castingTime: 'action', rangeText: '150 ft', durationText: 'Instantaneous', concentration: false, ritual: false, area: { shape: 'circle', sizeFt: 20 }, tags: ['damage', 'aoe'] },
  { id: 'lightning-bolt', name: 'Lightning Bolt', level: 3, school: 'Evocation', castingTime: 'action', rangeText: 'Self', durationText: 'Instantaneous', concentration: false, ritual: false, area: { shape: 'line', sizeFt: 100, widthFt: 5 }, tags: ['damage', 'aoe'] },
  { id: 'spirit-guardians', name: 'Spirit Guardians', level: 3, school: 'Conjuration', castingTime: 'action', rangeText: 'Self', durationText: '10 minutes', concentration: true, ritual: false, area: { shape: 'circle', sizeFt: 15 }, tags: ['damage', 'aura', 'aoe'] },
];

const DEFAULT_CLASS_SPELLS: Partial<Record<DndClass, string[]>> = {
  Bard: ['healing-word', 'thunderwave', 'guidance'],
  Cleric: ['guidance', 'sacred-flame', 'bless', 'cure-wounds', 'guiding-bolt', 'spiritual-weapon', 'spirit-guardians'],
  Druid: ['guidance', 'flaming-sphere', 'cure-wounds', 'thunderwave'],
  Paladin: ['bless', 'cure-wounds'],
  Ranger: ['cure-wounds'],
  Sorcerer: ['fire-bolt', 'ray-of-frost', 'magic-missile', 'burning-hands', 'misty-step', 'fireball'],
  Warlock: ['mage-hand', 'fire-bolt', 'shield', 'burning-hands'],
  Wizard: ['fire-bolt', 'mage-hand', 'shield', 'magic-missile', 'burning-hands', 'misty-step', 'fireball', 'lightning-bolt'],
};

function createEmptySlots(): SpellSlotTrack[] {
  return [1, 2, 3, 4, 5, 6, 7, 8, 9].map(level => ({ level: level as SpellSlotTrack['level'], max: 0, used: 0 }));
}

export function getSpellDefinition(spellId: string): SpellDefinition | undefined {
  return SPELL_CATALOG.find(spell => spell.id === spellId);
}

export function listAvailableSpellsForClass(dndClass: DndClass): SpellDefinition[] {
  const spellIds = DEFAULT_CLASS_SPELLS[dndClass] ?? [];
  return spellIds
    .map(getSpellDefinition)
    .filter((spell): spell is SpellDefinition => Boolean(spell));
}

export function isSpellcastingClass(dndClass: DndClass): boolean {
  return Boolean(SPELLCASTING_CLASSES[dndClass]);
}

export function getSpellcastingAbilityForClass(dndClass: DndClass): SpellCastingAbility | undefined {
  return SPELLCASTING_CLASSES[dndClass] ?? undefined;
}

function getProficiencyBonus(level: number): number {
  if (level >= 17) return 6;
  if (level >= 13) return 5;
  if (level >= 9) return 4;
  if (level >= 5) return 3;
  return 2;
}

function getSlotProgression(dndClass: DndClass, level: number): number[] {
  if (dndClass === 'Warlock') return [];
  if (dndClass === 'Paladin' || dndClass === 'Ranger') return HALF_CASTER_SLOTS[level] ?? [];
  if (SPELLCASTING_CLASSES[dndClass]) return FULL_CASTER_SLOTS[level] ?? [];
  return [];
}

function createClassSpells(dndClass: DndClass, level: number): CharacterSpell[] {
  return listAvailableSpellsForClass(dndClass)
    .filter(spell => spell.level <= Math.min(9, Math.ceil(level / 2) + 1))
    .map(spell => ({
      spellId: spell.id,
      source: 'class',
      known: true,
      prepared: PREPARED_CASTER_CLASSES.has(dndClass) ? spell.level <= 1 : true,
    }));
}

export function createSpellcastingState(dndClass: DndClass, level: number): CharacterSpellcasting | undefined {
  const ability = getSpellcastingAbilityForClass(dndClass);
  if (!ability) return undefined;

  const slots = createEmptySlots();
  const progression = getSlotProgression(dndClass, level);
  progression.forEach((max, index) => {
    slots[index] = { level: (index + 1) as SpellSlotTrack['level'], max, used: 0 };
  });

  return {
    enabled: true,
    spellcastingAbility: ability,
    ritualCasting: RITUAL_CASTER_CLASSES.has(dndClass),
    concentrationSpellId: null,
    concentrationSpellName: null,
    slots,
    pactSlots: dndClass === 'Warlock' ? { ...WARLOCK_PACT_SLOTS[level], used: 0 } : null,
    spells: createClassSpells(dndClass, level),
  };
}

export function normalizeSpellcasting(spellcasting: CharacterSpellcasting | undefined, dndClass: DndClass, level: number): CharacterSpellcasting | undefined {
  const defaults = createSpellcastingState(dndClass, level);
  if (!defaults) return undefined;
  if (!spellcasting) return defaults;

  const slots = createEmptySlots().map(slot => {
    const existing = spellcasting.slots.find(entry => entry.level === slot.level);
    const fallback = defaults.slots.find(entry => entry.level === slot.level) ?? slot;
    return {
      level: slot.level,
      max: existing?.max ?? fallback.max,
      used: Math.min(existing?.used ?? 0, existing?.max ?? fallback.max),
    };
  });

  const pactSlots = spellcasting.pactSlots
    ? {
        level: spellcasting.pactSlots.level,
        max: spellcasting.pactSlots.max,
        used: Math.min(spellcasting.pactSlots.used, spellcasting.pactSlots.max),
      }
    : defaults.pactSlots;

  return {
    enabled: spellcasting.enabled ?? defaults.enabled,
    spellcastingAbility: spellcasting.spellcastingAbility ?? defaults.spellcastingAbility,
    spellSaveDc: spellcasting.spellSaveDc,
    spellAttackBonus: spellcasting.spellAttackBonus,
    ritualCasting: spellcasting.ritualCasting ?? defaults.ritualCasting,
    concentrationSpellId: spellcasting.concentrationSpellId ?? null,
    concentrationSpellName: spellcasting.concentrationSpellName ?? null,
    slots,
    pactSlots,
    spells: spellcasting.spells.length > 0 ? spellcasting.spells : defaults.spells,
  };
}

export function computeSpellcastingStats(character: Character): Pick<CharacterSpellcasting, 'spellSaveDc' | 'spellAttackBonus'> {
  const spellcastingAbility = character.spellcasting?.spellcastingAbility;
  if (!spellcastingAbility) {
    return { spellSaveDc: undefined, spellAttackBonus: undefined };
  }

  const abilityModifier = getAbilityModifier(character, spellcastingAbility as AbilityName);
  const proficiencyBonus = getProficiencyBonus(character.level);

  return {
    spellSaveDc: 8 + proficiencyBonus + abilityModifier,
    spellAttackBonus: proficiencyBonus + abilityModifier,
  };
}

export function normalizeCharacterSpellcasting(character: Character): Character {
  const normalizedSpellcasting = normalizeSpellcasting(character.spellcasting, character.class, character.level);
  if (!normalizedSpellcasting) {
    return { ...character, spellcasting: undefined };
  }

  const computed = computeSpellcastingStats({ ...character, spellcasting: normalizedSpellcasting });
  return {
    ...character,
    spellcasting: {
      ...normalizedSpellcasting,
      ...computed,
    },
  };
}

export function spendSpellSlot(character: Character, slotLevel: number, usePactSlot = false): Character {
  if (!character.spellcasting) return character;

  if (usePactSlot && character.spellcasting.pactSlots && character.spellcasting.pactSlots.max > character.spellcasting.pactSlots.used) {
    return {
      ...character,
      spellcasting: {
        ...character.spellcasting,
        pactSlots: {
          ...character.spellcasting.pactSlots,
          used: character.spellcasting.pactSlots.used + 1,
        },
      },
    };
  }

  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      slots: character.spellcasting.slots.map(slot =>
        slot.level === slotLevel && slot.used < slot.max
          ? { ...slot, used: slot.used + 1 }
          : slot,
      ),
    },
  };
}

export function resetSpellcastingForShortRest(character: Character): Character {
  if (!character.spellcasting) return character;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      pactSlots: character.spellcasting.pactSlots
        ? { ...character.spellcasting.pactSlots, used: 0 }
        : null,
    },
  };
}

export function resetSpellcastingForLongRest(character: Character): Character {
  if (!character.spellcasting) return character;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      concentrationSpellId: null,
      concentrationSpellName: null,
      slots: character.spellcasting.slots.map(slot => ({ ...slot, used: 0 })),
      pactSlots: character.spellcasting.pactSlots
        ? { ...character.spellcasting.pactSlots, used: 0 }
        : null,
    },
  };
}

export function clearConcentration(character: Character): Character {
  if (!character.spellcasting) return character;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      concentrationSpellId: null,
      concentrationSpellName: null,
    },
  };
}

export function updatePreparedSpell(character: Character, spellId: string, prepared: boolean): Character {
  if (!character.spellcasting) return character;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      spells: character.spellcasting.spells.map(spell =>
        spell.spellId === spellId ? { ...spell, prepared } : spell,
      ),
    },
  };
}

export function updateSpellKnownState(character: Character, spellId: string, known: boolean): Character {
  if (!character.spellcasting) return character;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      spells: character.spellcasting.spells.map(spell =>
        spell.spellId === spellId ? { ...spell, known, prepared: known ? spell.prepared : false } : spell,
      ),
    },
  };
}

export function markConcentrationSpell(character: Character, spellId: string | null): Character {
  if (!character.spellcasting) return character;
  const spell = spellId ? getSpellDefinition(spellId) : null;
  return {
    ...character,
    spellcasting: {
      ...character.spellcasting,
      concentrationSpellId: spellId,
      concentrationSpellName: spell?.name ?? null,
    },
  };
}
