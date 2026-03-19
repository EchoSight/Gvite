export type TurnActionType = 'action' | 'bonus' | 'reaction';

export interface CombatTurnState {
  actionAvailable: boolean;
  bonusActionAvailable: boolean;
  reactionAvailable: boolean;
  dashActive: boolean;
  actionLabel: string | null;
  bonusActionLabel: string | null;
  reactionLabel: string | null;
  conditions: string[];
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
    addsCondition: 'Dodging',
    log: 'took the Dodge action.',
  },
  {
    id: 'disengage',
    name: 'Disengage',
    type: 'action',
    description: 'Your movement does not provoke opportunity attacks for the rest of the turn.',
    addsCondition: 'Disengaged',
    log: 'used Disengage and will not provoke opportunity attacks this turn.',
  },
  {
    id: 'help',
    name: 'Help',
    type: 'action',
    description: 'Grant an ally advantage on their next relevant ability check or attack.',
    addsCondition: 'Helping',
    log: 'used Help to support an ally.',
  },
  {
    id: 'hide',
    name: 'Hide',
    type: 'action',
    description: 'Attempt to become hidden from enemies.',
    addsCondition: 'Hidden attempt',
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

export function getTurnMovementLimit(speed: number, state: CombatTurnState): number {
  return speed + (state.dashActive ? speed : 0);
}

export function applyTurnAction(state: CombatTurnState, action: CoreTurnAction, actorName: string): CombatTurnState {
  const nextState: CombatTurnState = {
    ...state,
    conditions: [...state.conditions],
    turnLog: [...state.turnLog],
  };

  if (action.type === 'action') {
    if (!state.actionAvailable) return state;
    nextState.actionAvailable = false;
    nextState.actionLabel = action.name;
  }

  if (action.type === 'bonus') {
    if (!state.bonusActionAvailable) return state;
    nextState.bonusActionAvailable = false;
    nextState.bonusActionLabel = action.name;
  }

  if (action.type === 'reaction') {
    if (!state.reactionAvailable) return state;
    nextState.reactionAvailable = false;
    nextState.reactionLabel = action.name;
  }

  if (action.enablesDash) {
    nextState.dashActive = true;
  }

  if (action.addsCondition && !nextState.conditions.includes(action.addsCondition)) {
    nextState.conditions.push(action.addsCondition);
  }

  nextState.turnLog.unshift(`${actorName} ${action.log ?? `used ${action.name}.`}`);
  return nextState;
}
