import { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Footprints,
  Swords,
  Shield,
  XCircle,
  Check,
  ChevronDown,
  Sparkles,
  Zap,
  HandHelping,
} from 'lucide-react';
import { MapToken } from './MapCanvas';
import { getCharacters } from '@/lib/store';
import { getModifier, getEquippedAC, getEquippedWeapons, EquipmentItem } from '@/lib/types';
import {
  applyTurnAction,
  CORE_TURN_ACTIONS,
  createCombatTurnState,
  getTurnMovementLimit,
  type CombatTurnState,
  type CoreTurnAction,
} from '@/lib/combat';

interface CombatPanelProps {
  token: MapToken;
  allTokens: MapToken[];
  gridSize: number;
  ftPerCell: number;
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

const RESOURCE_STYLES: Record<'ready' | 'spent', string> = {
  ready: 'border-secondary/50 bg-secondary/10 text-secondary',
  spent: 'border-border bg-muted/40 text-muted-foreground',
};

export function CombatPanel({
  token,
  allTokens,
  gridSize,
  ftPerCell,
  onDamageToken,
  onEndTurn,
  isCurrentTurn,
  movementUsed,
  onSetMovementUsed,
  onSetCombatMoving,
  combatMoving,
}: CombatPanelProps) {
  const [mode, setMode] = useState<'idle' | 'moving' | 'attacking'>('idle');
  const [lastAttack, setLastAttack] = useState<AttackResult | null>(null);
  const [selectedWeapon, setSelectedWeapon] = useState<EquipmentItem | null>(null);
  const [showWeaponSelect, setShowWeaponSelect] = useState(false);
  const [turnState, setTurnState] = useState<CombatTurnState>(() => createCombatTurnState());

  useEffect(() => {
    setMode('idle');
    setLastAttack(null);
    setSelectedWeapon(null);
    setShowWeaponSelect(false);
    setTurnState(createCombatTurnState());
    onSetCombatMoving(false);
    onSetMovementUsed(0);
  }, [token.id, onSetCombatMoving, onSetMovementUsed]);

  const characters = getCharacters();
  const charData = characters.find(c => c.name === token.label);
  const baseMovement = charData?.speed || 30;
  const maxMovement = getTurnMovementLimit(baseMovement, turnState);
  const remainingFt = Math.max(0, maxMovement - movementUsed);
  const hasAction = turnState.actionAvailable;
  const hasBonusAction = turnState.bonusActionAvailable;
  const hasReaction = turnState.reactionAvailable;

  const equippedWeapons = charData ? getEquippedWeapons(charData) : [];

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
  const enemies = allTokens.filter(t => t.id !== token.id && t.type !== token.type);

  const groupedCoreActions = useMemo(() => ({
    action: CORE_TURN_ACTIONS.filter(action => action.type === 'action'),
    bonus: CORE_TURN_ACTIONS.filter(action => action.type === 'bonus'),
    reaction: CORE_TURN_ACTIONS.filter(action => action.type === 'reaction'),
  }), []);

  const handleQuickAction = (action: CoreTurnAction) => {
    setTurnState(current => applyTurnAction(current, action, token.label));
    setMode('idle');
    setShowWeaponSelect(false);
    if (action.id !== 'dash') {
      onSetCombatMoving(false);
    }
  };

  const performAttack = (targetId: string) => {
    if (!hasAction) return;

    const weapon = selectedWeapon || availableWeapons[0];
    if (!weapon) return;

    const target = allTokens.find(t => t.id === targetId);
    if (!target) return;

    const targetChar = characters.find(c => c.name === target.label);
    const targetAC = targetChar ? getEquippedAC(targetChar) : (target.type === 'monster' ? 10 + Math.floor(Math.random() * 6) : 10);

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
    setTurnState(current => ({
      ...current,
      actionAvailable: false,
      actionLabel: `Attack (${weapon.name})`,
      turnLog: [`${token.label} attacked ${target.label} with ${weapon.name}.`, ...current.turnLog],
    }));
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

      <div className="px-3 py-2 border-b border-border space-y-2">
        <div className="grid grid-cols-3 gap-1">
          <div className={`rounded-sm border px-2 py-1 ${hasAction ? RESOURCE_STYLES.ready : RESOURCE_STYLES.spent}`}>
            <p className="text-[8px] uppercase tracking-widest">Action</p>
            <p className="font-mono text-[10px] truncate">{turnState.actionLabel ?? (hasAction ? 'Ready' : 'Spent')}</p>
          </div>
          <div className={`rounded-sm border px-2 py-1 ${hasBonusAction ? RESOURCE_STYLES.ready : RESOURCE_STYLES.spent}`}>
            <p className="text-[8px] uppercase tracking-widest">Bonus</p>
            <p className="font-mono text-[10px] truncate">{turnState.bonusActionLabel ?? (hasBonusAction ? 'Ready' : 'Spent')}</p>
          </div>
          <div className={`rounded-sm border px-2 py-1 ${hasReaction ? RESOURCE_STYLES.ready : RESOURCE_STYLES.spent}`}>
            <p className="text-[8px] uppercase tracking-widest">Reaction</p>
            <p className="font-mono text-[10px] truncate">{turnState.reactionLabel ?? (hasReaction ? 'Ready' : 'Spent')}</p>
          </div>
        </div>

        <div>
          <div className="flex items-center justify-between">
            <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Movement</span>
            <span className="font-mono text-xs text-foreground">
              {remainingFt}ft / {maxMovement}ft
            </span>
          </div>
          <div className="w-full bg-muted rounded-full h-1.5 mt-1">
            <div
              className="bg-secondary rounded-full h-1.5 transition-all"
              style={{ width: `${Math.max(0, remainingFt / maxMovement) * 100}%` }}
            />
          </div>
          {turnState.dashActive && (
            <p className="text-[9px] uppercase tracking-widest text-secondary mt-1">
              Dash active: movement doubled this turn.
            </p>
          )}
        </div>

        {turnState.conditions.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {turnState.conditions.map(condition => (
              <span key={condition} className="px-1.5 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-[9px] uppercase tracking-widest text-accent">
                {condition}
              </span>
            ))}
          </div>
        )}
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
          disabled={!hasAction}
          className={`tactical-card !p-2 flex items-center gap-2 text-[10px] uppercase tracking-wider font-bold transition-colors ${
            mode === 'attacking' ? 'border-accent text-accent' : ''
          } disabled:opacity-30`}
        >
          <Swords className="w-3 h-3" />
          {!hasAction ? 'Action spent' : mode === 'attacking' ? 'Select weapon & target' : 'Attack'}
        </button>

        <AnimatePresence>
          {mode === 'attacking' && showWeaponSelect && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="border border-border rounded-sm p-2 mt-1 space-y-2"
            >
              <div>
                <button
                  onClick={() => setSelectedWeapon(null)}
                  className={`w-full text-left px-2 py-1.5 rounded-sm text-[10px] font-mono transition-colors ${
                    !selectedWeapon ? 'bg-secondary/20 text-secondary border border-secondary/40' : 'hover:bg-muted/50 border border-transparent'
                  }`}
                >
                  Default weapon ({availableWeapons[0]?.name})
                </button>
                {availableWeapons.map(weapon => (
                  <button
                    key={weapon.id}
                    onClick={() => setSelectedWeapon(weapon)}
                    className={`w-full mt-1 text-left px-2 py-1.5 rounded-sm text-[10px] font-mono transition-colors flex items-center justify-between ${
                      selectedWeapon?.id === weapon.id ? 'bg-secondary/20 text-secondary border border-secondary/40' : 'hover:bg-muted/50 border border-transparent'
                    }`}
                  >
                    <span>{weapon.name}</span>
                    <span className="text-muted-foreground">1d{weapon.damageDie || 4}</span>
                  </button>
                ))}
              </div>

              <div className="border-t border-border pt-2">
                <p className="text-[9px] uppercase tracking-widest text-muted-foreground mb-1">Targets</p>
                {enemies.length === 0 ? (
                  <p className="text-[10px] text-muted-foreground">No enemies on the map.</p>
                ) : (
                  <div className="space-y-1">
                    {enemies.map(enemy => {
                      const dx = Math.abs(enemy.x - token.x) / gridSize;
                      const dy = Math.abs(enemy.y - token.y) / gridSize;
                      const distanceFt = Math.round(Math.max(dx, dy) * ftPerCell);
                      return (
                        <button
                          key={enemy.id}
                          onClick={() => performAttack(enemy.id)}
                          className="w-full text-left px-2 py-1.5 rounded-sm text-[10px] font-mono border border-border hover:border-accent hover:text-accent transition-colors flex items-center justify-between"
                        >
                          <span>{enemy.label}</span>
                          <span className="text-muted-foreground">{distanceFt}ft</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="mt-1 border border-border rounded-sm p-2 space-y-2">
          <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground">
            <Sparkles className="w-3 h-3" /> Core D&D turn options
          </div>

          <div className="space-y-1">
            {groupedCoreActions.action.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={!hasAction}
                className="w-full text-left px-2 py-1.5 rounded-sm border border-border hover:border-secondary hover:text-secondary transition-colors disabled:opacity-30"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] uppercase tracking-widest font-bold">{action.name}</span>
                  <Shield className="w-3 h-3 text-muted-foreground" />
                </div>
                <p className="text-[10px] text-muted-foreground normal-case tracking-normal mt-1">{action.description}</p>
              </button>
            ))}
          </div>

          <div className="grid grid-cols-2 gap-1">
            {groupedCoreActions.bonus.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={!hasBonusAction}
                className="text-left px-2 py-1.5 rounded-sm border border-border hover:border-accent hover:text-accent transition-colors disabled:opacity-30"
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold">
                  <Zap className="w-3 h-3" /> {action.name}
                </div>
                <p className="text-[10px] text-muted-foreground normal-case tracking-normal mt-1">{action.description}</p>
              </button>
            ))}
            {groupedCoreActions.reaction.map(action => (
              <button
                key={action.id}
                onClick={() => handleQuickAction(action)}
                disabled={!hasReaction}
                className="text-left px-2 py-1.5 rounded-sm border border-border hover:border-foreground hover:text-foreground transition-colors disabled:opacity-30"
              >
                <div className="flex items-center gap-1 text-[10px] uppercase tracking-widest font-bold">
                  <HandHelping className="w-3 h-3" /> {action.name}
                </div>
                <p className="text-[10px] text-muted-foreground normal-case tracking-normal mt-1">{action.description}</p>
              </button>
            ))}
          </div>
        </div>

        {lastAttack && (
          <div className={`border rounded-sm p-2 text-[10px] font-mono mt-1 ${lastAttack.hit ? 'border-secondary/40 bg-secondary/10' : 'border-border bg-muted/30'}`}>
            <div className="flex items-center gap-1 uppercase tracking-widest mb-1">
              {lastAttack.hit ? <Check className="w-3 h-3 text-secondary" /> : <XCircle className="w-3 h-3 text-destructive" />}
              {lastAttack.hit ? 'Attack landed' : 'Attack missed'}
            </div>
            <p>{lastAttack.weaponName} vs {lastAttack.targetName}</p>
            <p>Attack roll {lastAttack.attackRoll} vs AC {lastAttack.targetAC}</p>
            {lastAttack.natural20 && <p className="text-secondary">Critical hit!</p>}
            {lastAttack.natural1 && <p className="text-destructive">Natural 1.</p>}
            {lastAttack.hit && <p>Damage: {lastAttack.damageRoll}</p>}
          </div>
        )}

        {turnState.turnLog.length > 0 && (
          <div className="border border-border rounded-sm p-2 mt-1">
            <div className="flex items-center gap-1 text-[9px] uppercase tracking-widest text-muted-foreground mb-2">
              <ChevronDown className="w-3 h-3" /> Turn log
            </div>
            <div className="space-y-1">
              {turnState.turnLog.slice(0, 4).map(entry => (
                <p key={entry} className="text-[10px] font-mono text-foreground/90">
                  {entry}
                </p>
              ))}
            </div>
          </div>
        )}

        <button
          onClick={() => {
            setMode('idle');
            onSetCombatMoving(false);
            onEndTurn();
          }}
          className="mt-1 tactical-card !p-2 flex items-center justify-center gap-2 text-[10px] uppercase tracking-wider font-bold border-secondary text-secondary"
        >
          End Turn
        </button>
      </div>
    </div>
  );
}
