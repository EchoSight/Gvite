import { motion } from 'framer-motion';
import { Character, formatModifier, getModifier } from '@/lib/types';
import { Link } from 'react-router-dom';
import { HpBar } from './HpBar';

interface CharacterCardProps {
  character: Character;
}

export function CharacterCard({ character }: CharacterCardProps) {
  const strMod = getModifier(character.abilities.find(a => a.name === 'STR')?.score ?? 10);
  const dexMod = getModifier(character.abilities.find(a => a.name === 'DEX')?.score ?? 10);

  return (
    <Link to={`/character/${character.id}`}>
      <motion.div
        className="tactical-card cursor-pointer"
        whileHover={{ borderColor: 'rgba(255,255,255,0.15)' }}
        whileTap={{ scale: 0.98 }}
        transition={{ duration: 0.15 }}
      >
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-3">
            {character.icon ? (
              <img src={character.icon} className="w-10 h-10 rounded-full object-cover border border-border shrink-0" alt="" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center shrink-0">
                <span className="font-mono text-sm text-muted-foreground">{character.name[0]}</span>
              </div>
            )}
            <div>
              <h3 className="font-display text-base text-foreground">{character.name}</h3>
              <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
                LVL {character.level} {character.race} {character.class}
              </p>
            </div>
          </div>
          <div className="text-right">
            <span className="font-mono text-2xl tabular-nums text-foreground">{character.ac}</span>
            <p className="stat-label">AC</p>
          </div>
        </div>
        <HpBar current={character.hp} max={character.maxHp} />
        <div className="flex gap-4 mt-3">
          <div className="text-center">
            <span className="font-mono text-sm tabular-nums">{formatModifier(character.abilities.find(a => a.name === 'STR')?.score ?? 10)}</span>
            <p className="stat-label">STR</p>
          </div>
          <div className="text-center">
            <span className="font-mono text-sm tabular-nums">{formatModifier(character.abilities.find(a => a.name === 'DEX')?.score ?? 10)}</span>
            <p className="stat-label">DEX</p>
          </div>
          <div className="text-center">
            <span className="font-mono text-sm tabular-nums">{character.speed} ft</span>
            <p className="stat-label">SPD</p>
          </div>
          <div className="text-center">
            <span className="font-mono text-sm tabular-nums">{character.equipment.length}</span>
            <p className="stat-label">ITEMS</p>
          </div>
        </div>
      </motion.div>
    </Link>
  );
}
