import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Dices, X } from 'lucide-react';
import { DICE, quickRoll, RollResult } from '@/lib/dice';

export function DiceFloatingButton() {
  const [open, setOpen] = useState(false);
  const [result, setResult] = useState<RollResult | null>(null);

  const handleRoll = (sides: number) => {
    const r = quickRoll(sides);
    setResult(r);
    setTimeout(() => setResult(null), 2000);
  };

  const isCrit = result && result.rolls[0].die === 20 && result.rolls[0].result === 20;
  const isFumble = result && result.rolls[0].die === 20 && result.rolls[0].result === 1;

  return (
    <div className="fixed bottom-4 right-4 z-50 flex flex-col items-end gap-2">
      {/* Result toast */}
      <AnimatePresence>
        {result && (
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 10, scale: 0.9 }}
            className={`tactical-card px-4 py-3 text-center mb-1 ${
              isCrit ? 'border-tactical-gold' : isFumble ? 'border-destructive' : ''
            }`}
          >
            <span className={`font-mono text-2xl tabular-nums ${
              isCrit ? 'text-tactical-gold' : isFumble ? 'text-destructive' : 'text-foreground'
            }`}>
              {result.total}
            </span>
            <p className="font-mono text-[10px] text-muted-foreground">{result.expression}</p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Dice menu */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 10 }}
            className="flex flex-col gap-1 mb-1"
          >
            {DICE.filter(d => d.sides !== 100).map(die => (
              <motion.button
                key={die.sides}
                onClick={() => handleRoll(die.sides)}
                className="tactical-card w-12 h-12 flex flex-col items-center justify-center cursor-pointer"
                whileTap={{ scale: 0.9 }}
                whileHover={{ borderColor: 'rgba(255,255,255,0.2)' }}
              >
                <span className="text-sm">{die.icon}</span>
                <span className="font-mono text-[9px] text-muted-foreground">{die.label}</span>
              </motion.button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* FAB */}
      <motion.button
        onClick={() => setOpen(!open)}
        className="w-12 h-12 rounded-full bg-foreground text-background flex items-center justify-center shadow-lg"
        whileTap={{ scale: 0.9 }}
        whileHover={{ scale: 1.05 }}
      >
        {open ? <X className="w-5 h-5" /> : <Dices className="w-5 h-5" />}
      </motion.button>
    </div>
  );
}
