import { motion } from 'framer-motion';
import { AbilityScore, formatModifier } from '@/lib/types';

interface StatBlockProps {
  ability: AbilityScore;
  onScoreChange?: (score: number) => void;
  editable?: boolean;
}

export function StatBlock({ ability, onScoreChange, editable }: StatBlockProps) {
  return (
    <motion.div
      className="tactical-card flex flex-col items-center justify-center gap-1 min-w-[80px] aspect-square"
      whileHover={{ backgroundColor: 'rgba(255,255,255,0.03)' }}
      transition={{ duration: 0.15 }}
    >
      <span className="stat-label">{ability.name}</span>
      <span className="stat-value">{formatModifier(ability.score)}</span>
      <div className="flex items-center gap-1">
        {editable && (
          <button
            onClick={() => onScoreChange?.(Math.max(1, ability.score - 1))}
            className="text-muted-foreground hover:text-foreground text-xs font-mono px-1"
          >
            −
          </button>
        )}
        <span className="text-xs font-mono text-muted-foreground">{ability.score}</span>
        {editable && (
          <button
            onClick={() => onScoreChange?.(Math.min(20, ability.score + 1))}
            className="text-muted-foreground hover:text-foreground text-xs font-mono px-1"
          >
            +
          </button>
        )}
      </div>
    </motion.div>
  );
}
