import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Character, DND_CLASSES, DND_RACES, ABILITY_NAMES,
  DndClass, DndRace, AbilityName,
  AbilityScore, EquipmentItem, CLASS_HIT_DIE, applyRaceAbilityBonuses, getEquippedAC, getModifier, getRaceAbilityBonuses, getRaceProfile
} from '@/lib/types';
import { useCharacterCollectionSession } from '@/hooks/useCharacterSessions';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';
import { StatBlock } from '@/components/StatBlock';
import { EquipmentDrawer } from '@/components/EquipmentDrawer';
import { EquipmentRow } from '@/components/EquipmentRow';
import { Plus } from 'lucide-react';

const HALF_ELF_ABILITY_OPTIONS = ABILITY_NAMES.filter(name => name !== 'CHA');

export default function CreateCharacter() {
  const navigate = useNavigate();
  const { createCharacter, status } = useCharacterCollectionSession();
  const { playerName } = useMultiplayerSession();
  const [name, setName] = useState('');
  const [race, setRace] = useState(DND_RACES[0]);
  const [dndClass, setDndClass] = useState(DND_CLASSES[0]);
  const [level, setLevel] = useState(1);
  const [abilities, setAbilities] = useState<AbilityScore[]>(
    ABILITY_NAMES.map(n => ({ name: n, score: 10 }))
  );
  const [halfElfChoices, setHalfElfChoices] = useState<AbilityName[]>(['STR', 'DEX']);
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const raceProfile = getRaceProfile(race);

  useEffect(() => {
    if (race !== 'Half-Elf') return;

    setHalfElfChoices(prev => {
      const next = [...new Set(prev.filter(choice => choice !== 'CHA'))].slice(0, 2);
      for (const ability of HALF_ELF_ABILITY_OPTIONS) {
        if (next.length >= 2) break;
        if (!next.includes(ability)) next.push(ability);
      }
      return next;
    });
  }, [race]);

  const raceBonuses = useMemo(
    () => getRaceAbilityBonuses(race, halfElfChoices),
    [race, halfElfChoices],
  );
  const finalAbilities = useMemo(
    () => applyRaceAbilityBonuses(abilities, race, halfElfChoices),
    [abilities, race, halfElfChoices],
  );

  const conMod = getModifier(finalAbilities.find(a => a.name === 'CON')?.score ?? 10);
  const hitDie = CLASS_HIT_DIE[dndClass];
  const maxHp = hitDie + conMod + (level - 1) * (Math.floor(hitDie / 2) + 1 + conMod);
  const baseAc = getEquippedAC({
    id: 'preview',
    name: 'Preview',
    race,
    class: dndClass,
    level,
    xp: 0,
    hp: Math.max(1, maxHp),
    maxHp: Math.max(1, maxHp),
    ac: 10,
    speed: 30,
    abilities: finalAbilities,
    equipment,
    createdAt: new Date().toISOString(),
  });

  const handleCreate = async () => {
    if (!name.trim()) return;
    const char: Character = {
      id: `char-${Date.now()}`,
      name: name.trim(),
      race,
      class: dndClass,
      level,
      xp: 0,
      hp: Math.max(1, maxHp),
      maxHp: Math.max(1, maxHp),
      ac: baseAc,
      speed: 30,
      abilities: finalAbilities,
      equipment,
      createdAt: new Date().toISOString(),
    };
    await createCharacter(char);
    navigate(`/character/${char.id}`);
  };

  const updateAbility = (name: AbilityName, score: number) => {
    const racialBonus = raceBonuses[name] ?? 0;
    const baseScore = Math.max(1, score - racialBonus);
    setAbilities(prev => prev.map(a => a.name === name ? { ...a, score: baseScore } : a));
  };

  const updateHalfElfChoice = (index: number, selected: AbilityName) => {
    setHalfElfChoices(prev => {
      const next = [...prev];
      const otherIndex = index === 0 ? 1 : 0;
      if (next[otherIndex] === selected) {
        next[otherIndex] = next[index];
      }
      next[index] = selected;
      return next;
    });
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <h1 className="font-display text-base md:text-lg mb-2 text-foreground">INITIATE CHARACTER BUILD.</h1>
      <p className="text-[10px] uppercase tracking-widest text-muted-foreground mb-4 md:mb-6">{status.mode === 'hosted' ? `HOSTED CHARACTER SYNC · ${status.state}` : 'LOCAL CHARACTER STORAGE'}</p>
      {status.mode === 'hosted' && (
        <p className="text-xs text-muted-foreground mb-4">
          New hosted characters are automatically linked to <span className="font-mono text-foreground">{playerName}</span>.
        </p>
      )}

      {/* Identity */}
      <section className="mb-4 md:mb-6">
        <p className="tactical-header mb-3">IDENTITY</p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-12 gap-1">
          <div className="lg:col-span-6 tactical-card">
            <label className="stat-label block mb-2">NAME</label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="Enter character name..."
              className="w-full bg-transparent font-display text-base md:text-lg text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
            />
          </div>
          <div className="lg:col-span-2 tactical-card">
            <label className="stat-label block mb-2">RACE</label>
            <select
              value={race}
              onChange={e => setRace(e.target.value as DndRace)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none"
            >
              {DND_RACES.map(r => <option key={r} value={r} className="bg-card">{r}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2 tactical-card">
            <label className="stat-label block mb-2">CLASS</label>
            <select
              value={dndClass}
              onChange={e => setDndClass(e.target.value as DndClass)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none"
            >
              {DND_CLASSES.map(c => <option key={c} value={c} className="bg-card">{c}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2 tactical-card">
            <label className="stat-label block mb-2">LEVEL</label>
            <div className="flex items-center gap-2">
              <button onClick={() => setLevel(Math.max(1, level - 1))} className="text-muted-foreground hover:text-foreground font-mono">−</button>
              <span className="font-mono text-lg tabular-nums text-foreground">{level}</span>
              <button onClick={() => setLevel(Math.min(20, level + 1))} className="text-muted-foreground hover:text-foreground font-mono">+</button>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-4 md:mb-6">
        <p className="tactical-header mb-3">RACIAL MODIFIERS</p>
        <div className="tactical-card space-y-3">
          <div className="flex flex-wrap gap-2 text-xs font-mono text-foreground">
            {ABILITY_NAMES.map(ability => raceBonuses[ability] ? (
              <span key={ability} className="rounded border border-border px-2 py-1">
                {ability} +{raceBonuses[ability]}
              </span>
            ) : null)}
          </div>
          {race === 'Half-Elf' && raceProfile.flexibleBonuses && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[0, 1].map(index => (
                <label key={index} className="block">
                  <span className="stat-label block mb-2">HALF-ELF BONUS {index + 1}</span>
                  <select
                    value={halfElfChoices[index]}
                    onChange={e => updateHalfElfChoice(index, e.target.value as AbilityName)}
                    className="w-full bg-transparent font-mono text-sm text-foreground outline-none border border-border rounded-sm px-2 py-2"
                  >
                    {HALF_ELF_ABILITY_OPTIONS.map(option => (
                      <option key={option} value={option} className="bg-card">{option}</option>
                    ))}
                  </select>
                </label>
              ))}
            </div>
          )}
          <div>
            <p className="stat-label mb-2">TRAITS</p>
            <div className="flex flex-wrap gap-2 text-xs font-mono text-muted-foreground">
              {raceProfile.traits.map(trait => (
                <span key={trait} className="rounded border border-border px-2 py-1">{trait}</span>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Computed Stats */}
      <section className="mb-4 md:mb-6">
        <p className="tactical-header mb-3">COMPUTED</p>
        <div className="grid grid-cols-3 gap-1">
          <div className="tactical-card flex items-center justify-between">
            <span className="stat-label">MAX HP</span>
            <span className="font-mono text-lg md:text-xl tabular-nums text-foreground">{Math.max(1, maxHp)}</span>
          </div>
          <div className="tactical-card flex items-center justify-between">
            <span className="stat-label">AC</span>
            <span className="font-mono text-lg md:text-xl tabular-nums text-foreground">{baseAc}</span>
          </div>
          <div className="tactical-card flex items-center justify-between">
            <span className="stat-label">HIT DIE</span>
            <span className="font-mono text-lg md:text-xl tabular-nums text-foreground">d{hitDie}</span>
          </div>
        </div>
      </section>

      {/* Ability Scores */}
      <section className="mb-4 md:mb-6">
        <p className="tactical-header mb-3">ABILITY SCORES</p>
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-1">
          {finalAbilities.map(ab => (
            <StatBlock
              key={ab.name}
              ability={ab}
              editable
              onScoreChange={score => updateAbility(ab.name, score)}
            />
          ))}
        </div>
      </section>

      {/* Equipment */}
      <section className="mb-4 md:mb-6">
        <div className="flex items-center justify-between mb-3">
          <p className="tactical-header">EQUIPMENT</p>
          <motion.button
            onClick={() => setDrawerOpen(true)}
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest font-bold text-muted-foreground hover:text-foreground transition-colors"
            whileTap={{ scale: 0.98 }}
          >
            <Plus className="w-3 h-3" /> ADD ITEM
          </motion.button>
        </div>
        <div className="tactical-card p-0 overflow-hidden">
          {equipment.length === 0 ? (
            <p className="p-4 text-sm text-muted-foreground font-mono">No equipment. Click ADD ITEM to browse catalog.</p>
          ) : (
            equipment.map(item => (
              <EquipmentRow
                key={item.id}
                item={item}
                editable
                onToggleEquip={id => setEquipment(prev => prev.map(i => i.id === id ? { ...i, equipped: !i.equipped } : i))}
                onRemove={id => setEquipment(prev => prev.filter(i => i.id !== id))}
              />
            ))
          )}
        </div>
      </section>

      {/* Create */}
      <motion.button
        onClick={handleCreate}
        disabled={!name.trim()}
        className="w-full tactical-card text-center font-display text-sm tracking-widest uppercase border-foreground/20 hover:bg-foreground hover:text-background transition-colors disabled:opacity-30 disabled:cursor-not-allowed py-3"
        whileTap={{ scale: 0.98 }}
      >
        FINALIZE BUILD
      </motion.button>

      <EquipmentDrawer
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        onAdd={item => {
          setEquipment(prev => [...prev, item]);
        }}
        existingIds={equipment.map(e => e.id)}
      />
    </div>
  );
}
