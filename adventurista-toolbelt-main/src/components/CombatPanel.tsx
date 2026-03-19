import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Footprints, Swords, Shield, XCircle, Check, ChevronDown, Crosshair } from 'lucide-react';
import { MapToken } from './MapCanvas';
import { getCharacters } from '@/lib/store';
import {
  EquipmentItem,
  formatDamageRoll,
  formatRange,
  formatSignedNumber,
  getDistanceBetweenPointsInFeet,
  getEquippedAC,
  getEquippedWeapons,
  getWeaponAttackProfile,
  isWeaponInRange,
} from '@/lib/types';

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
  attackDie: number;
  targetAC: number;
  hit: boolean;
  damageRoll: number;
  damageExpression: string;
  targetName: string;
  natural20: boolean;
  natural1: boolean;
  weaponName: string;
  attackBonus: number;
  attackAbility: string;
  distanceFt: number;
  rangeLabel: string;
}

export function CombatPanel({
  token,
  allTokens,
  gridSize,
  ftPerCell,
  onMoveToken: _onMoveToken,
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
  const charData = characters.find(character => character.name === token.label);
  const maxMovement = charData?.speed || 30;
  const remainingFt = Math.max(0, maxMovement - movementUsed);

  const equippedWeapons = charData ? getEquippedWeapons(charData) : [];

  const unarmedStrike: EquipmentItem = {
    id: 'unarmed',
    name: 'Unarmed Strike',
    weight: 0,
    quantity: 1,
    equipped: true,
    category: 'weapon',
    damageDie: 1,
    damageDiceCount: 1,
    attackBonus: 0,
    damageBonus: 0,
  };

  const availableWeapons = equippedWeapons.length > 0 ? equippedWeapons : [unarmedStrike];
  const activeWeapon = selectedWeapon || availableWeapons[0];

  const enemies = useMemo(
    () => allTokens.filter(otherToken => otherToken.id !== token.id && otherToken.type !== token.type),
    [allTokens, token.id, token.type],
  );

  const getTargetDistance = (target: MapToken) => getDistanceBetweenPointsInFeet(token, target, gridSize, ftPerCell);

  const performAttack = (targetId: string) => {
    const weapon = activeWeapon;
    if (!weapon) return;

    const target = allTokens.find(otherToken => otherToken.id === targetId);
    if (!target) return;

    const distanceFt = getTargetDistance(target);
    if (!isWeaponInRange(distanceFt, weapon)) {
      setLastAttack(null);
      return;
    }

    const targetChar = characters.find(character => character.name === target.label);
    const targetAC = targetChar
      ? getEquippedAC(targetChar)
      : target.type === 'monster'
        ? 10 + Math.floor(Math.random() * 6)
        : 10;

    const attackDie = Math.floor(Math.random() * 20) + 1;
    const attackProfile = charData
      ? getWeaponAttackProfile(charData, weapon)
      : {
          attackAbility: 'STR',
          attackModifier: 2,
          damageModifier: 2,
          attackBonus: 2,
          damageBonus: 2,
          damageDiceCount: weapon.damageDiceCount ?? 1,
          damageDie: weapon.damageDie ?? 1,
          range: weapon.range,
          rangeLabel: formatRange(weapon),
        };

    const attackTotal = attackDie + attackProfile.attackBonus;
    const natural20 = attackDie === 20;
    const natural1 = attackDie === 1;
    const hit = natural20 || (!natural1 && attackTotal >= targetAC);

    let damageRoll = 0;
    if (hit) {
      const damageDice = Array.from({ length: attackProfile.damageDiceCount }, () => Math.floor(Math.random() * attackProfile.damageDie) + 1);
      damageRoll = damageDice.reduce((total, roll) => total + roll, 0) + attackProfile.damageBonus;
      damageRoll = Math.max(1, damageRoll);
      if (natural20) damageRoll *= 2;
      onDamageToken(targetId, damageRoll);
    }

    setLastAttack({
      attackRoll: attackTotal,
      attackDie,
      targetAC,
      hit,
      damageRoll,
      damageExpression: `${attackProfile.damageDiceCount}d${attackProfile.damageDie}${formatSignedNumber(attackProfile.damageBonus)}`,
      targetName: target.label,
      natural20,
      natural1,
      weaponName: weapon.name,
      attackBonus: attackProfile.attackBonus,
      attackAbility: attackProfile.attackAbility,
      distanceFt,
      rangeLabel: attackProfile.rangeLabel,
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

        <AnimatePresence>
          {mode === 'attacking' && showWeaponSelect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 pl-2"
            >
              <p className="text-[9px] uppercase tracking-widest text-muted-foreground py-1">Choose Weapon</p>
              {availableWeapons.map(weapon => {
                const profile = charData ? getWeaponAttackProfile(charData, weapon) : null;
                return (
                  <button
                    key={weapon.id}
                    onClick={() => {
                      setSelectedWeapon(weapon);
                      setShowWeaponSelect(false);
                    }}
                    className={`w-full tactical-card !p-2 flex items-center gap-2 text-[10px] font-mono text-foreground hover:border-accent ${
                      selectedWeapon?.id === weapon.id ? 'border-accent text-accent' : ''
                    }`}
                  >
                    <Swords className="w-3 h-3 text-muted-foreground" />
                    <div className="flex-1 text-left min-w-0">
                      <div className="truncate">{weapon.name}</div>
                      <div className="text-[8px] text-muted-foreground">
                        {formatDamageRoll(weapon)} · {formatRange(weapon)}
                        {profile && ` · ${profile.attackAbility} ${formatSignedNumber(profile.attackBonus)} to hit`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {mode === 'attacking' && !showWeaponSelect && activeWeapon && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="space-y-1 pl-2"
            >
              <div className="flex items-center justify-between py-1">
                <div>
                  <p className="text-[9px] uppercase tracking-widest text-muted-foreground">
                    Attacking with <span className="text-foreground">{activeWeapon.name}</span>
                  </p>
                  {charData && (
                    <p className="text-[8px] text-muted-foreground">
                      {formatDamageRoll(activeWeapon)} · {getWeaponAttackProfile(charData, activeWeapon).attackAbility} based · {formatRange(activeWeapon)}
                    </p>
                  )}
                </div>
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
                enemies.map(enemy => {
                  const distanceFt = getTargetDistance(enemy);
                  const inRange = isWeaponInRange(distanceFt, activeWeapon);
                  return (
                    <button
                      key={enemy.id}
                      onClick={() => performAttack(enemy.id)}
                      disabled={!inRange}
                      className={`w-full tactical-card !p-2 flex items-center gap-2 text-[10px] font-mono text-foreground ${
                        inRange ? 'hover:border-accent' : 'opacity-50 cursor-not-allowed'
                      }`}
                    >
                      <div
                        className="w-4 h-4 rounded-full flex items-center justify-center text-[7px] font-bold text-background"
                        style={{ backgroundColor: enemy.color }}
                      >
                        {enemy.label[0]}
                      </div>
                      <div className="flex-1 text-left min-w-0">
                        <div className="truncate">{enemy.label}</div>
                        <div className="text-[8px] text-muted-foreground flex items-center gap-1">
                          <Crosshair className="w-2.5 h-2.5" />
                          {distanceFt} ft away · {inRange ? 'In range' : `Out of range (${formatRange(activeWeapon)})`}
                        </div>
                      </div>
                      {enemy.hp !== undefined && (
                        <span className="text-[9px] text-muted-foreground">{enemy.hp}HP</span>
                      )}
                    </button>
                  );
                })
              )}
            </motion.div>
          )}
        </AnimatePresence>

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
                {lastAttack.weaponName}: d20 {formatSignedNumber(lastAttack.attackBonus)} = {lastAttack.attackRoll} vs AC {lastAttack.targetAC}
              </p>
              <p className="text-muted-foreground">
                {lastAttack.targetName} · {lastAttack.distanceFt} ft · {lastAttack.rangeLabel} · {lastAttack.attackAbility}
              </p>
              {lastAttack.hit && (
                <p className="text-foreground font-bold">
                  {lastAttack.damageRoll} damage from {lastAttack.damageExpression}{lastAttack.natural20 ? ' (crit!)' : ''}
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
