import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  Character, DND_CLASSES, DND_RACES, ABILITY_NAMES,
  AbilityScore, EquipmentItem, CLASS_HIT_DIE, getModifier
} from '@/lib/types';
import { addCharacter } from '@/lib/store';
import { StatBlock } from '@/components/StatBlock';
import { EquipmentDrawer } from '@/components/EquipmentDrawer';
import { EquipmentRow } from '@/components/EquipmentRow';
import { Plus } from 'lucide-react';

export default function CreateCharacter() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [race, setRace] = useState(DND_RACES[0]);
  const [dndClass, setDndClass] = useState(DND_CLASSES[0]);
  const [level, setLevel] = useState(1);
  const [abilities, setAbilities] = useState<AbilityScore[]>(
    ABILITY_NAMES.map(n => ({ name: n, score: 10 }))
  );
  const [equipment, setEquipment] = useState<EquipmentItem[]>([]);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const conMod = getModifier(abilities.find(a => a.name === 'CON')?.score ?? 10);
  const hitDie = CLASS_HIT_DIE[dndClass];
  const maxHp = hitDie + conMod + (level - 1) * (Math.floor(hitDie / 2) + 1 + conMod);
  const baseAc = 10 + getModifier(abilities.find(a => a.name === 'DEX')?.score ?? 10);

  const handleCreate = () => {
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
      abilities,
      equipment,
      createdAt: new Date().toISOString(),
    };
    addCharacter(char);
    navigate(`/character/${char.id}`);
  };

  const updateAbility = (name: string, score: number) => {
    setAbilities(prev => prev.map(a => a.name === name ? { ...a, score } : a));
  };

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <h1 className="font-display text-base md:text-lg mb-4 md:mb-6 text-foreground">INITIATE CHARACTER BUILD.</h1>

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
              onChange={e => setRace(e.target.value as any)}
              className="w-full bg-transparent font-mono text-sm text-foreground outline-none"
            >
              {DND_RACES.map(r => <option key={r} value={r} className="bg-card">{r}</option>)}
            </select>
          </div>
          <div className="lg:col-span-2 tactical-card">
            <label className="stat-label block mb-2">CLASS</label>
            <select
              value={dndClass}
              onChange={e => setDndClass(e.target.value as any)}
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
          {abilities.map(ab => (
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
