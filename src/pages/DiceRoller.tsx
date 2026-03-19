import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { DICE, RollResult, rollExpression, quickRoll } from '@/lib/dice';
import { Dices, RotateCcw, ChevronUp, ChevronDown } from 'lucide-react';

export default function DiceRoller() {
  const [history, setHistory] = useState<RollResult[]>([]);
  const [expression, setExpression] = useState('1d20');
  const [advMode, setAdvMode] = useState<'normal' | 'advantage' | 'disadvantage'>('normal');
  const [lastRoll, setLastRoll] = useState<RollResult | null>(null);
  const [rolling, setRolling] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const doRoll = (expr?: string) => {
    const adv = advMode === 'normal' ? undefined : advMode;
    const result = expr
      ? rollExpression(expr, adv)
      : rollExpression(expression, adv);
    if (!result) return;
    setRolling(true);
    setTimeout(() => {
      setLastRoll(result);
      setHistory(prev => [result, ...prev].slice(0, 50));
      setRolling(false);
    }, 300);
  };

  const doQuickRoll = (sides: number) => {
    setRolling(true);
    setTimeout(() => {
      const result = quickRoll(sides);
      setLastRoll(result);
      setHistory(prev => [result, ...prev].slice(0, 50));
      setRolling(false);
    }, 300);
  };

  const isCrit = lastRoll && lastRoll.rolls.length === 1 && lastRoll.rolls[0].die === 20 && lastRoll.rolls[0].result === 20;
  const isFumble = lastRoll && lastRoll.rolls.length === 1 && lastRoll.rolls[0].die === 20 && lastRoll.rolls[0].result === 1;

  return (
    <div className="flex-1 overflow-y-auto p-4 md:p-6">
      <div className="mb-6">
        <h1 className="font-display text-lg text-foreground">DICE ROLLER</h1>
        <p className="text-[11px] text-muted-foreground uppercase tracking-widest">
          {history.length} ROLL{history.length !== 1 ? 'S' : ''} THIS SESSION
        </p>
      </div>

      {/* Quick roll buttons */}
      <section className="mb-6">
        <p className="tactical-header mb-3">QUICK ROLL</p>
        <div className="grid grid-cols-4 sm:grid-cols-7 gap-1">
          {DICE.map(die => (
            <motion.button
              key={die.sides}
              onClick={() => doQuickRoll(die.sides)}
              className="tactical-card text-center py-3 md:py-4 cursor-pointer"
              whileTap={{ scale: 0.95 }}
              whileHover={{ borderColor: 'rgba(255,255,255,0.2)' }}
            >
              <span className="text-xl md:text-2xl block mb-1">{die.icon}</span>
              <span className="font-mono text-xs uppercase tracking-wider text-muted-foreground">{die.label}</span>
            </motion.button>
          ))}
        </div>
      </section>

      {/* Expression roller */}
      <section className="mb-6">
        <p className="tactical-header mb-3">CUSTOM EXPRESSION</p>
        <div className="tactical-card">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="stat-label block mb-1">EXPRESSION</label>
              <input
                ref={inputRef}
                value={expression}
                onChange={e => setExpression(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && doRoll()}
                placeholder="2d6+3"
                className="w-full bg-transparent font-mono text-lg text-foreground outline-none border-b border-border pb-1 placeholder:text-muted-foreground/50"
              />
            </div>
            <motion.button
              onClick={() => doRoll()}
              disabled={rolling}
              className="px-4 py-2 font-mono text-[11px] uppercase tracking-widest border border-border rounded-sm hover:bg-foreground hover:text-background transition-colors disabled:opacity-50"
              whileTap={{ scale: 0.95 }}
            >
              <Dices className="w-4 h-4 inline mr-2" />
              ROLL
            </motion.button>
          </div>

          {/* Advantage toggle */}
          <div className="flex gap-1 mt-3">
            {(['normal', 'advantage', 'disadvantage'] as const).map(mode => (
              <button
                key={mode}
                onClick={() => setAdvMode(mode)}
                className={`text-[10px] uppercase tracking-wider px-3 py-1 rounded-sm transition-colors ${
                  advMode === mode
                    ? 'bg-foreground text-background'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {mode === 'advantage' && <ChevronUp className="w-3 h-3 inline mr-1" />}
                {mode === 'disadvantage' && <ChevronDown className="w-3 h-3 inline mr-1" />}
                {mode}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Last result */}
      <AnimatePresence mode="wait">
        {lastRoll && (
          <motion.section
            key={lastRoll.id}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="mb-6"
          >
            <p className="tactical-header mb-3">RESULT</p>
            <div className={`tactical-card text-center py-6 md:py-8 ${
              isCrit ? 'border-tactical-gold' : isFumble ? 'border-destructive' : ''
            }`}>
              <motion.span
                className={`font-mono text-5xl md:text-7xl tabular-nums ${
                  isCrit ? 'text-tactical-gold' : isFumble ? 'text-destructive' : 'text-foreground'
                }`}
                initial={{ scale: 1.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: 'spring', bounce: 0.5 }}
              >
                {lastRoll.total}
              </motion.span>
              {isCrit && (
                <p className="font-display text-sm text-tactical-gold mt-2 tracking-widest">NATURAL 20! CRITICAL HIT!</p>
              )}
              {isFumble && (
                <p className="font-display text-sm text-destructive mt-2 tracking-widest">NATURAL 1! CRITICAL FAIL!</p>
              )}
              <p className="font-mono text-xs text-muted-foreground mt-2">
                {lastRoll.expression}
                {lastRoll.rolls.length > 1 && ` → [${lastRoll.rolls.map(r => r.result).join(', ')}]`}
                {lastRoll.modifier !== 0 && ` ${lastRoll.modifier >= 0 ? '+' : ''}${lastRoll.modifier}`}
                {lastRoll.advantage && ` (${lastRoll.advantage})`}
              </p>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* History */}
      {history.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-3">
            <p className="tactical-header">ROLL HISTORY</p>
            <button
              onClick={() => { setHistory([]); setLastRoll(null); }}
              className="text-[10px] text-muted-foreground hover:text-foreground uppercase tracking-wider flex items-center gap-1"
            >
              <RotateCcw className="w-3 h-3" /> CLEAR
            </button>
          </div>
          <div className="space-y-1 max-h-[300px] overflow-y-auto">
            {history.map(roll => (
              <div key={roll.id} className="tactical-card py-2 flex items-center justify-between">
                <div>
                  <span className="font-mono text-sm text-foreground">{roll.expression}</span>
                  {roll.advantage && (
                    <span className="text-[9px] ml-2 text-muted-foreground uppercase">{roll.advantage}</span>
                  )}
                </div>
                <span className="font-mono text-lg tabular-nums text-foreground">{roll.total}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
