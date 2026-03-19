export interface DieType {
  sides: number;
  label: string;
  icon: string;
}

export const DICE: DieType[] = [
  { sides: 4, label: 'd4', icon: '◆' },
  { sides: 6, label: 'd6', icon: '⬡' },
  { sides: 8, label: 'd8', icon: '◇' },
  { sides: 10, label: 'd10', icon: '⬠' },
  { sides: 12, label: 'd12', icon: '⬡' },
  { sides: 20, label: 'd20', icon: '⬣' },
  { sides: 100, label: 'd100', icon: '%' },
];

export interface RollResult {
  id: string;
  expression: string;
  rolls: { die: number; result: number }[];
  modifier: number;
  total: number;
  advantage?: 'advantage' | 'disadvantage';
  timestamp: number;
}

/** Parse "2d6+3", "1d20", "d8-1", etc. */
export function parseExpression(expr: string): { count: number; sides: number; modifier: number } | null {
  const match = expr.trim().toLowerCase().match(/^(\d*)d(\d+)\s*([+-]\s*\d+)?$/);
  if (!match) return null;
  const count = match[1] ? parseInt(match[1]) : 1;
  const sides = parseInt(match[2]);
  const modifier = match[3] ? parseInt(match[3].replace(/\s/g, '')) : 0;
  if (count < 1 || count > 100 || sides < 2 || sides > 100) return null;
  return { count, sides, modifier };
}

export function rollDice(count: number, sides: number): number[] {
  return Array.from({ length: count }, () => Math.floor(Math.random() * sides) + 1);
}

export function rollExpression(expr: string, advMode?: 'advantage' | 'disadvantage'): RollResult | null {
  const parsed = parseExpression(expr);
  if (!parsed) return null;

  let rolls = rollDice(parsed.count, parsed.sides).map(r => ({ die: parsed.sides, result: r }));

  // Advantage/disadvantage only applies to single d20 rolls
  if (advMode && parsed.count === 1 && parsed.sides === 20) {
    const second = Math.floor(Math.random() * 20) + 1;
    const first = rolls[0].result;
    if (advMode === 'advantage') {
      rolls = [{ die: 20, result: Math.max(first, second) }];
    } else {
      rolls = [{ die: 20, result: Math.min(first, second) }];
    }
  }

  const diceTotal = rolls.reduce((s, r) => s + r.result, 0);

  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    expression: expr.trim(),
    rolls,
    modifier: parsed.modifier,
    total: diceTotal + parsed.modifier,
    advantage: advMode,
    timestamp: Date.now(),
  };
}

export function quickRoll(sides: number): RollResult {
  const result = Math.floor(Math.random() * sides) + 1;
  return {
    id: `roll-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    expression: `1d${sides}`,
    rolls: [{ die: sides, result }],
    modifier: 0,
    total: result,
    timestamp: Date.now(),
  };
}
