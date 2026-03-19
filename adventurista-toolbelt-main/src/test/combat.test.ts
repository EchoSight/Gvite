import { describe, expect, it } from 'vitest';
import {
  applyTurnAction,
  CORE_TURN_ACTIONS,
  createCombatTurnState,
  getTurnMovementLimit,
} from '@/lib/combat';

describe('combat turn helpers', () => {
  it('doubles movement after dash', () => {
    const baseState = createCombatTurnState();
    const dash = CORE_TURN_ACTIONS.find(action => action.id === 'dash');

    expect(dash).toBeDefined();

    const dashedState = applyTurnAction(baseState, dash!, 'Aria');

    expect(dashedState.actionAvailable).toBe(false);
    expect(dashedState.dashActive).toBe(true);
    expect(getTurnMovementLimit(30, dashedState)).toBe(60);
  });

  it('tracks conditions and spent resources for core actions', () => {
    const dodge = CORE_TURN_ACTIONS.find(action => action.id === 'dodge');
    const reaction = CORE_TURN_ACTIONS.find(action => action.id === 'opportunity');

    const afterDodge = applyTurnAction(createCombatTurnState(), dodge!, 'Borin');
    const afterReaction = applyTurnAction(afterDodge, reaction!, 'Borin');

    expect(afterDodge.conditions).toContain('Dodging');
    expect(afterDodge.actionLabel).toBe('Dodge');
    expect(afterReaction.reactionAvailable).toBe(false);
    expect(afterReaction.reactionLabel).toBe('Reaction');
    expect(afterReaction.turnLog[0]).toContain('spent their reaction');
  });
});
