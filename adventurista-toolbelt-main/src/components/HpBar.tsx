import { motion } from 'framer-motion';

interface HpBarProps {
  current: number;
  max: number;
}

export function HpBar({ current, max }: HpBarProps) {
  const pct = max > 0 ? (current / max) * 100 : 0;
  const color = pct > 50 ? 'bg-tactical-red' : pct > 25 ? 'bg-tactical-gold' : 'bg-destructive';
  
  return (
    <div className="w-full">
      <div className="flex justify-between items-baseline mb-1">
        <span className="stat-label">HIT POINTS</span>
        <span className="font-mono text-sm tabular-nums">
          <span className="text-foreground">{current}</span>
          <span className="text-muted-foreground">/{max}</span>
        </span>
      </div>
      <div className="h-1 w-full bg-muted overflow-hidden rounded-sm">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ type: 'spring', duration: 0.3, bounce: 0 }}
          className={`h-full ${color}`}
        />
      </div>
    </div>
  );
}
