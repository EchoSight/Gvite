export type TurnActionType = 'action' | 'bonus' | 'reaction';

export interface CombatConditionDefinition {
  id: string;
  name: string;
  defaultDuration: number | null;
  effectSummary: string;
  blocksMovement?: boolean;
  blocksAction?: boolean;
  blocksBonusAction?: boolean;
  blocksReaction?: boolean;
}

export interface CombatCondition extends CombatConditionDefinition {
  remainingTurns: number | null;
}

export interface CombatTurnState {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  dashActive: boolean;
  actionLabel: string | null;
  bonusActionLabel: string | null;
  reactionLabel: string | null;
  conditions: CombatCondition[];
  turnLog: string[];
}

export interface CoreTurnAction {
  id: string;
  name: string;
  type: TurnActionType;
  description: string;
  addsCondition?: string;
  enablesDash?: boolean;
  log?: string;
}

export const CONDITION_DEFINITIONS: CombatConditionDefinition[] = [
  {
    id: 'dodging',
    name: 'Dodging',
    defaultDuration: 1,
    effectSummary: 'Attacks against you have disadvantage until your next turn if you can see the attacker.',
  },
  {
    id: 'disengaged',
    name: 'Disengaged',
    defaultDuration: 1,
    effectSummary: 'Your movement does not provoke opportunity attacks this turn.',
  },
  {
    id: 'helping',
    name: 'Helping',
    defaultDuration: 1,
    effectSummary: 'You are granting advantage to an ally on their next relevant check or attack.',
  },
  {
    id: 'hidden-attempt',
    name: 'Hidden attempt',
    defaultDuration: 1,
    effectSummary: 'You are attempting to stay unseen until something reveals you.',
  },
  {
    id: 'prone',
    name: 'Prone',
    defaultDuration: null,
    effectSummary: 'Stand up to recover; melee attackers gain advantage while your attacks are limited.',
  },
  {
    id: 'grappled',
    name: 'Grappled',
    defaultDuration: null,
    effectSummary: 'Speed becomes 0 until the grapple ends.',
    blocksMovement: true,
  },
  {
    id: 'restrained',
    name: 'Restrained',
    defaultDuration: null,
    effectSummary: 'Speed becomes 0 and attacks against you gain advantage.',
    blocksMovement: true,
  },
  {
    id: 'stunned',
    name: 'Stunned',
    defaultDuration: 1,
    effectSummary: 'You cannot move and can take no actions or reactions.',
    blocksMovement: true,
    blocksAction: true,
    blocksBonusAction: true,
    blocksReaction: true,
  },
  {
    id: 'incapacitated',
    name: 'Incapacitated',
    defaultDuration: 1,
    effectSummary: 'You cannot take actions or reactions.',
    blocksAction: true,
    blocksBonusAction: true,
    blocksReaction: true,
  },
  {
    id: 'unconscious',
    name: 'Unconscious',
    defaultDuration: null,
    effectSummary: 'You cannot move or act until stabilized or awakened.',
    blocksMovement: true,
    blocksAction: true,
    blocksBonusAction: true,
    blocksReaction: true,
  },
];

export const CORE_TURN_ACTIONS: CoreTurnAction[] = [
  {
    id: 'dash',
    name: 'Dash',
    type: 'action',
    description: 'Gain extra movement equal to your speed for this turn.',
    enablesDash: true,
    log: 'used Dash and can move up to double speed this turn.',
  },
  {
    id: 'dodge',
    name: 'Dodge',
    type: 'action',
    description: 'Attacks against you have disadvantage until your next turn if you can see the attacker.',
    addsCondition: 'dodging',
    log: 'took the Dodge action.',
  },
  {
    id: 'disengage',
    name: 'Disengage',
    type: 'action',
    description: 'Your movement does not provoke opportunity attacks for the rest of the turn.',
    addsCondition: 'disengaged',
    log: 'used Disengage and will not provoke opportunity attacks this turn.',
  },
  {
    id: 'help',
    name: 'Help',
    type: 'action',
    description: 'Grant an ally advantage on their next relevant ability check or attack.',
    addsCondition: 'helping',
    log: 'used Help to support an ally.',
  },
  {
    id: 'hide',
    name: 'Hide',
    type: 'action',
    description: 'Attempt to become hidden from enemies.',
    addsCondition: 'hidden-attempt',
    log: 'used Hide and is attempting to remain unseen.',
  },
  {
    id: 'offhand',
    name: 'Off-hand / Bonus',
    type: 'bonus',
    description: 'Track a bonus action such as off-hand attack, class feature, or spell.',
    log: 'spent their bonus action.',
  },
  {
    id: 'opportunity',
    name: 'Reaction',
    type: 'reaction',
    description: 'Track a reaction such as an opportunity attack, Shield, or similar trigger.',
    log: 'spent their reaction.',
  },
];

export function getConditionDefinition(id: string): CombatConditionDefinition | undefined {
  return CONDITION_DEFINITIONS.find(condition => condition.id === id);
}

export function createCombatTurnState(): CombatTurnState {
  return {
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true,
    dashActive: false,
    actionLabel: null,
    bonusActionLabel: null,
    reactionLabel: null,
    conditions: [],
    turnLog: [],
  };
}

export function canTakeAction(state: CombatTurnState): boolean {
  return !state.conditions.some(condition => condition.blocksAction);
}

export function canTakeBonusAction(state: CombatTurnState): boolean {
  return !state.conditions.some(condition => condition.blocksBonusAction);
}

export function canTakeReaction(state: CombatTurnState): boolean {
  return !state.conditions.some(condition => condition.blocksReaction);
}

export function canMove(state: CombatTurnState): boolean {
  return !state.conditions.some(condition => condition.blocksMovement);
}

export function getTurnMovementLimit(speed: number, state: CombatTurnState): number {
  if (!canMove(state)) return 0;
  return speed + (state.dashActive ? speed : 0);
}

export function addCondition(state: CombatTurnState, conditionId: string, actorName: string): CombatTurnState {
  const definition = getConditionDefinition(conditionId);
  if (!definition) return state;

  const existingIndex = state.conditions.findIndex(condition => condition.id === definition.id);
  const nextCondition: CombatCondition = {
    ...definition,
    remainingTurns: definition.defaultDuration,
  };
  const nextConditions = [...state.conditions];

  if (existingIndex >= 0) {
    nextConditions[existingIndex] = nextCondition;
  } else {
    nextConditions.push(nextCondition);
  }

  return {
    ...state,
    conditions: nextConditions,
    turnLog: [`${actorName} is now ${definition.name.toLowerCase()}.`, ...state.turnLog],
  };
}

export function removeCondition(state: CombatTurnState, conditionId: string, actorName: string): CombatTurnState {
  const removed = state.conditions.find(condition => condition.id === conditionId);
  if (!removed) return state;

  return {
    ...state,
    conditions: state.conditions.filter(condition => condition.id !== conditionId),
    turnLog: [`${actorName} is no longer ${removed.name.toLowerCase()}.`, ...state.turnLog],
  };
}

export function advanceTurnState(state: CombatTurnState, actorName: string): CombatTurnState {
  const expired: CombatCondition[] = [];
  const nextConditions = state.conditions.flatMap(condition => {
    if (condition.remainingTurns === null) return [condition];
    if (condition.remainingTurns <= 1) {
      expired.push(condition);
      return [];
    }
    return [{ ...condition, remainingTurns: condition.remainingTurns - 1 }];
  });

  const expirationLog = expired.map(condition => `${actorName} is no longer ${condition.name.toLowerCase()}.`);

  return {
    ...state,
    dashActive: false,
    actionAvailable: true,
    bonusActionAvailable: true,
    reactionAvailable: true,
    actionLabel: null,
    bonusActionLabel: null,
    reactionLabel: null,
    conditions: nextConditions,
    turnLog: [...expirationLog, ...state.turnLog],
  };
}

export function formatConditionDuration(condition: CombatCondition): string {
  if (condition.remainingTurns === null) return '∞';
  return `${condition.remainingTurns}t`;
}

export function applyTurnAction(state: CombatTurnState, action: CoreTurnAction, actorName: string): CombatTurnState {
  const nextState: CombatTurnState = {
    ...state,
    conditions: [...state.conditions],
    turnLog: [...state.turnLog],
  };

  if (action.type === 'action') {
    if (!state.actionAvailable || !canTakeAction(state)) return state;
    nextState.actionAvailable = false;
    nextState.actionLabel = action.name;
  }

  if (action.type === 'bonus') {
    if (!state.bonusActionAvailable || !canTakeBonusAction(state)) return state;
    nextState.bonusActionAvailable = false;
    nextState.bonusActionLabel = action.name;
  }

  if (action.type === 'reaction') {
    if (!state.reactionAvailable || !canTakeReaction(state)) return state;
    nextState.reactionAvailable = false;
    nextState.reactionLabel = action.name;
  }

  if (action.enablesDash) {
    nextState.dashActive = true;
  }

  const withActionCondition = action.addsCondition
    ? addCondition(nextState, action.addsCondition, actorName)
    : nextState;

  return {
    ...withActionCondition,
    turnLog: [`${actorName} ${action.log ?? `used ${action.name}.`}`, ...withActionCondition.turnLog],
  };
}
