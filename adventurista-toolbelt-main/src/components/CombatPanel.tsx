import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Footprints, Swords, Shield, XCircle, Check, ChevronDown } from 'lucide-react';
import { MapToken } from './MapCanvas';
import { getCharacters } from '@/lib/store';
import { getModifier, getEquippedAC, getEquippedWeapons, EquipmentItem } from '@/lib/types';

interface CombatPanelProps {
  token: MapToken;
  allTokens: MapToken[];
  gridSize: number;
  ftPerCell: number;
  onMoveToken: (tokenId: string, newX: number, newY: number) => void;
  onDamageToken: (tokenId: string, damage: number) => void;
  onEndTurn: () => void;
  isCurrentTurn: boolean;
  movementUsed: number;
  onSetMovementUsed: (ft: number) => void;
  onSetCombatMoving: (moving: boolean) => void;
  combatMoving: boolean;
}

interface AttackResult {
  attackRoll: number;
  targetAC: number;
  hit: boolean;
  damageRoll: number;
  targetName: string;
  natural20: boolean;
  natural1: boolean;
  weaponName: string;
}

export function CombatPanel({
  token,
  allTokens,
  gridSize,
  ftPerCell,
  onMoveToken,
  onDamageToken,
  onEndTurn,
  isCurrentTurn,
  movementUsed,
  onSetMovementUsed,
  onSetCombatMoving,
  combatMoving,
}: CombatPanelProps) {
  const [mode, setMode] = useState<'idle' | 'moving' | 'attacking'>('idle');
  const [hasAttacked, setHasAttacked] = useState(false);
  const [lastAttack, setLastAttack] = useState<AttackResult | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<EquipmentItem | null>(null);
  const [showWeaponSelect, setShowWeaponSelect] = useState(false);

  const characters = getCharacters();
  const charData = characters.find(c => c.name === token.label);
  const maxMovement = charData?.speed || 30;
  const remainingFt = Math.max(0, maxMovement - movementUsed);

  // Get equipped weapons for this character
  const equippedWeapons = charData ? getEquippedWeapons(charData) : [];

  // Unarmed strike fallback
  const unarmedStrike: EquipmentItem = {
    id: 'unarmed',
    name: 'Unarmed Strike',
    weight: 0,
    quantity: 1,
    equipped: true,
    category: 'weapon',
    damageDie: 1,
    attackBonus: 0,
    damageBonus: 0,
  };

  const availableWeapons = equippedWeapons.length > 0 ? equippedWeapons : [unarmedStrike];

  // Get enemies (opposite type)
  const enemies = allTokens.filter(t => t.id !== token.id && t.type !== token.type);

  const performAttack = (targetId: string) => {
    const weapon = selectedWeapon || availableWeapons[0];
    if (!weapon) return;

    const target = allTokens.find(t => t.id === targetId);
    if (!target) return;

    const targetChar = characters.find(c => c.name === target.label);
    const targetAC = targetChar ? getEquippedAC(targetChar) : (target.type === 'monster' ? 10 + Math.floor(Math.random() * 6) : 10);

    // Attack roll: d20 + ability mod + weapon bonus
    const attackDie = Math.floor(Math.random() * 20) + 1;
    let attackMod = 0;
    if (charData) {
      const isFinesse = weapon.properties?.includes('finesse');
      const isRanged = weapon.properties?.includes('ranged');
      const str = charData.abilities.find(a => a.name === 'STR');
      const dex = charData.abilities.find(a => a.name === 'DEX');
      if (isRanged) {
        attackMod = dex ? getModifier(dex.score) : 0;
      } else if (isFinesse) {
        const strMod = str ? getModifier(str.score) : 0;
        const dexMod = dex ? getModifier(dex.score) : 0;
        attackMod = Math.max(strMod, dexMod);
      } else {
        attackMod = str ? getModifier(str.score) : 0;
      }
    } else {
      attackMod = Math.floor(Math.random() * 4) + 1;
    }

    const weaponAttackBonus = weapon.attackBonus || 0;
    const attackTotal = attackDie + attackMod + weaponAttackBonus;
    const natural20 = attackDie === 20;
    const natural1 = attackDie === 1;
    const hit = natural20 || (!natural1 && attackTotal >= targetAC);

    let damageRoll = 0;
    if (hit) {
      const damageDieSides = weapon.damageDie || 4;
      damageRoll = Math.floor(Math.random() * damageDieSides) + 1;
      damageRoll += (weapon.damageBonus || 0) + attackMod;
      damageRoll = Math.max(1, damageRoll);
      if (natural20) damageRoll *= 2;
      onDamageToken(targetId, damageRoll);
    }

    setLastAttack({
      attackRoll: attackTotal,
      targetAC,
      hit,
      damageRoll,
      targetName: target.label,
      natural20,
      natural1,
      weaponName: weapon.name,
    });
    setHasAttacked(true);
    setSelectedWeapon(null);
    setShowWeaponSelect(false);
    setMode('idle');
  };

  if (!isCurrentTurn) {
    return (
      <div className="bg-card border border-border rounded-sm p-3 text-center">
        <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
          Waiting for turn...
        </p>
        <p className="font-mono text-sm text-foreground mt-1">{token.label}</p>
      </div>
    );
  }

  return (
    <div className="bg-card border border-border rounded-sm overflow-hidden">
      <div className="p-2 border-b border-border flex items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest font-bold text-secondary flex-1">
          {token.label}'s Turn
        </span>
      </div>

      {/* Movement info */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Movement</span>
          <span className="font-mono text-xs text-foreground">
            {remainingFt}ft / {maxMovement}ft
          </span>
        </div>
        <div className="w-full bg-muted rounded-full h-1.5 mt-1">
          <div
            className="bg-secondary rounded-full h-1.5 transition-all"
            style={{ width: `${Math.max(0, (remainingFt / maxMovement)) * 100}%` }}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="p-2 flex flex-col gap-1">
        <button
          onClick={() => {
            const newMode = mode === 'moving' ? 'idle' : 'moving';
            setMode(newMode);
            onSetCombatMoving(newMode === 'moving');
          }}
          disabled={remainingFt <= 0}
          className={`tactical-card !p-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold transition-colors ${
            combatMoving ? 'border-secondary text-secondary' : ''
          } disabled:opacity-30`}
        >
          <Footprints className="w-3 h-3" />
          {combatMoving ? 'Click map to move' : `Move (${remainingFt}ft left)`}
        </button>

        {/* Attack with weapon selection */}
        <button
          onClick={() => {
            if (mode === 'attacking') {
              setMode('idle');
              setShowWeaponSelect(false);
            } else {
              setMode('attacking');
              setShowWeaponSelect(true);
            }
          }}
          disabled={hasAttacked}
          className={`tactical-card !p-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold transition-colors ${
            mode === 'attacking' ? 'border-accent text-accent' : ''
          } disabled:opacity-30`}
        >
          <Swords className="w-3 h-3" />
          {hasAttacked ? 'Already attacked' : mode === 'attacking' ? 'Select weapon & target' : 'Attack'}
        </button>

        {/* Weapon selection */}
        <AnimatePresence>
          {mode === 'attacking' && showWeaponSelect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 pl-2"
            >
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground py-1">Choose Weapon</p>
              {availableWeapons.map(w => (
                <button
                  key={w.id}
                  onClick={() => { setSelectedWeapon(w); setShowWeaponSelect(false); }}
                  className={`w-full tactical-card !p-2 flex items-center gap-2 text-[10px] font-mono text-foreground hover:border-accent ${
                    selectedWeapon?.id === w.id ? 'border-accent text-accent' : ''
                  }`}
                >
                  <Swords className="w-3 h-3 text-muted-foreground" />
                  <span className="flex-1 text-left">{w.name}</span>
                  <span className="text-[8px] text-muted-foreground">
                    1d{w.damageDie || 1}
                    {(w.damageBonus || 0) > 0 ? `+${w.damageBonus}` : ''}
                  </span>
                </button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Target selection (shown after weapon is chosen) */}
        <AnimatePresence>
          {mode === 'attacking' && !showWeaponSelect && (selectedWeapon || availableWeapons.length === 1) && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 pl-2"
            >
              <div className="flex items-center justify-between py-1">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                  Attacking with: <span className="text-foreground">{(selectedWeapon || availableWeapons[0])?.name}</span>
                </p>
                <button
                  onClick={() => setShowWeaponSelect(true)}
                  className="text-[8px] text-muted-foreground hover:text-foreground"
                >
                  <ChevronDown className="w-3 h-3" />
                </button>
              </div>
              {enemies.length === 0 ? (
                <p className="text-[9px] text-muted-foreground py-1">No targets</p>
              ) : (
                enemies.map(enemy => (
                  <button
                    key={enemy.id}
                    onClick={() => performAttack(enemy.id)}
                    className="w-full tactical-card !p-2 flex items-center gap-2 text-[10px] font-mono text-foreground hover:border-accent"
                  >
                    <div
                      className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-background"
                      style={{ backgroundColor: enemy.color }}
                    >
                      {enemy.label[0]}
                    </div>
                    {enemy.label}
                    {enemy.hp !== undefined && (
                      <span className="ml-auto text-[9px] text-muted-foreground">{enemy.hp}HP</span>
                    )}
                  </button>
                ))
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Attack result */}
        <AnimatePresence>
          {lastAttack && (
            <motion.div
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className={`tactical-card !p-2 text-[10px] font-mono ${
                lastAttack.hit ? 'border-secondary' : 'border-destructive'
              }`}
            >
              <div className="flex items-center gap-1 mb-1">
                {lastAttack.hit ? (
                  <Check className="w-3 h-3 text-secondary" />
                ) : (
                  <XCircle className="w-3 h-3 text-destructive" />
                )}
                <span className={lastAttack.hit ? 'text-secondary' : 'text-destructive'}>
                  {lastAttack.natural20 ? 'CRITICAL HIT!' : lastAttack.natural1 ? 'CRITICAL MISS!' : lastAttack.hit ? 'HIT!' : 'MISS!'}
                </span>
              </div>
              <p className="text-muted-foreground">
                {lastAttack.weaponName}: {lastAttack.attackRoll} vs AC {lastAttack.targetAC} ({lastAttack.targetName})
              </p>
              {lastAttack.hit && (
                <p className="text-foreground font-bold">
                  {lastAttack.damageRoll} damage{lastAttack.natural20 ? ' (crit!)' : ''}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        <button
          onClick={() => {
            setMode('idle');
            onSetMovementUsed(0);
            setHasAttacked(false);
            setLastAttack(null);
            setSelectedWeapon(null);
            onSetCombatMoving(false);
            onEndTurn();
          }}
          className="tactical-card !p-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold border-muted-foreground/30 hover:border-foreground"
        >
          <Shield className="w-3 h-3" />
          End Turn
        </button>
      </div>
    </div>
  );
}
