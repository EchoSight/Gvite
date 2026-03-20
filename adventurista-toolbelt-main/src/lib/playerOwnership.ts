import type { Character, MapToken } from './types';

export interface PlayerIdentity {
  id: string;
  name: string;
  linkedCharacterId: string;
}

export function createPlayerId(): string {
  return `player-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getCharacterOwnerLabel(character: Character): string {
  if (!character.ownerPlayerId) return 'Unlinked';
  return character.ownerPlayerName?.trim() || character.ownerPlayerId;
}

export function canManageCharacter(character: Character | null | undefined, isDM: boolean, playerId: string): boolean {
  if (!character) return false;
  if (isDM) return true;
  return Boolean(character.ownerPlayerId) && character.ownerPlayerId === playerId;
}

export function canLinkCharacter(character: Character | null | undefined, isDM: boolean, playerId: string): boolean {
  if (!character) return false;
  if (isDM) return true;
  return !character.ownerPlayerId || character.ownerPlayerId === playerId;
}

export function assignCharacterOwner(character: Character, player: Pick<PlayerIdentity, 'id' | 'name'>): Character {
  return {
    ...character,
    ownerPlayerId: player.id,
    ownerPlayerName: player.name.trim() || player.id,
  };
}

export function clearCharacterOwner(character: Character): Character {
  return {
    ...character,
    ownerPlayerId: undefined,
    ownerPlayerName: undefined,
  };
}

export function canControlToken(token: MapToken, isDM: boolean, playerId: string): boolean {
  if (isDM) return true;
  if (token.type !== 'character') return false;
  return Boolean(token.ownerPlayerId) && token.ownerPlayerId === playerId;
}
