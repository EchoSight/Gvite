import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, SkipForward, RotateCcw, Swords } from 'lucide-react';
import { MapToken } from './MapCanvas';
import { getCharacters } from '@/lib/store';
import { getModifier } from '@/lib/types';

export interface InitiativeEntry {
  tokenId: string;
  label: string;
  roll: number;
  modifier: number;
  total: number;
  color: string;
  icon?: string;
}

interface InitiativeTrackerProps {
  tokens: MapToken[];
  onTurnChange?: (tokenId: string) => void;
  currentTurnId: string | null;
  entries: InitiativeEntry[];
  setEntries: (entries: InitiativeEntry[]) => void;
  onStartCombat: () => void;
  onNextTurn: () => void;
  onResetCombat: () => void;
  combatActive: boolean;
  isDM: boolean;
}

export function InitiativeTracker({
  tokens,
  currentTurnId,
  entries,
  setEntries,
  onStartCombat,
  onNextTurn,
  onResetCombat,
  combatActive,
  isDM,
}: InitiativeTrackerProps) {
  const [rolling, setRolling] = useState(false);

  const rollInitiative = () => {
    const characters = getCharacters();
    setRolling(true);

    const newEntries: InitiativeEntry[] = tokens.map(token => {
      const roll = Math.floor(Math.random() * 20) + 1;
      let mod = 0;

      if (token.type === 'character') {
        const char = characters.find(c => c.name === token.label);
        if (char) {
          const dex = char.abilities.find(a => a.name === 'DEX');
          if (dex) mod = getModifier(dex.score);
        }
      } else {
        // Monsters get a random DEX mod between -1 and +3
        mod = Math.floor(Math.random() * 5) - 1;
      }

      return {
        tokenId: token.id,
        label: token.label,
        roll,
        modifier: mod,
        total: roll + mod,
        color: token.color,
        icon: token.icon,
      };
    });

    // Sort descending by total
    newEntries.sort((a, b) => b.total - a.total);
    setEntries(newEntries);

    setTimeout(() => setRolling(false), 300);
  };

  if (tokens.length === 0) {
    return (
      <div className="p-3 text-center">
        <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
          Add tokens to roll initiative
        </p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="p-2 border-b border-border flex items-center gap-2">
        <Swords className="w-3 h-3 text-muted-foreground" />
        <span className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground flex-1">
          Initiative
        </span>
        {isDM && (
          <div className="flex gap-1">
            {!combatActive ? (
              <>
                <button
                  onClick={rollInitiative}
                  className="tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold flex items-center gap-1"
                  disabled={rolling}
                >
                  <Play className="w-3 h-3" /> Roll
                </button>
                {entries.length > 0 && (
                  <button
                    onClick={onStartCombat}
                    className="tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold flex items-center gap-1 border-secondary text-secondary"
                  >
                    <Swords className="w-3 h-3" /> Start
                  </button>
                )}
              </>
            ) : (
              <>
                <button
                  onClick={onNextTurn}
                  className="tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold flex items-center gap-1"
                >
                  <SkipForward className="w-3 h-3" /> Next
                </button>
                <button
                  onClick={onResetCombat}
                  className="tactical-card !p-1 px-2 text-[9px] uppercase tracking-wider font-bold flex items-center gap-1"
                >
                  <RotateCcw className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      <AnimatePresence mode="popLayout">
        {entries.map((entry, i) => {
          const isCurrent = combatActive && entry.tokenId === currentTurnId;
          return (
            <motion.div
              key={entry.tokenId}
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              className={`flex items-center gap-2 px-3 py-2 border-b border-border last:border-0 transition-colors ${
                isCurrent ? 'bg-secondary/20 border-l-2 border-l-secondary' : ''
              }`}
            >
              <span className="font-mono text-[10px] text-muted-foreground w-4">{i + 1}</span>
              {entry.icon ? (
                <img src={entry.icon} className="w-5 h-5 rounded-full object-cover" alt="" />
              ) : (
                <div
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-background"
                  style={{ backgroundColor: entry.color }}
                >
                  {entry.label.slice(0, 2).toUpperCase()}
                </div>
              )}
              <span className="text-[11px] font-mono text-foreground flex-1 truncate">
                {entry.label}
              </span>
              <span className="font-mono text-sm font-bold text-foreground">{entry.total}</span>
              <span className="text-[9px] text-muted-foreground font-mono">
                ({entry.roll}{entry.modifier >= 0 ? '+' : ''}{entry.modifier})
              </span>
            </motion.div>
          );
        })}
      </AnimatePresence>

      {entries.length === 0 && (
        <div className="p-4 text-center">
          <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
            {isDM ? 'Click Roll to begin' : 'Waiting for DM...'}
          </p>
        </div>
      )}
    </div>
  );
}
