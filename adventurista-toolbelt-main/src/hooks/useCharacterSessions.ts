import { useEffect, useMemo, useState } from 'react';
import type { Character } from '@/lib/types';
import { getEquippedAC } from '@/lib/types';
import { normalizeCharacterSpellcasting } from '@/lib/spellcasting';
import {
  assignCharacterOwner,
  canLinkCharacter,
  canManageCharacter,
  clearCharacterOwner,
} from '@/lib/playerOwnership';
import {
  addCharacter as addLocalCharacter,
  deleteCharacter as deleteLocalCharacter,
  getCharacters,
  updateCharacter as updateLocalCharacter,
} from '@/lib/repositories';
import { useGame } from '@/lib/GameContext';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';

interface SessionStatus {
  mode: 'local' | 'hosted';
  state: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

export interface CharacterCollectionSnapshot {
  characters: Character[];
  version: number;
}

function normalizeCharacters(characters: Character[]): Character[] {
  return characters.map(character => {
    const normalized = normalizeCharacterSpellcasting(character);
    return {
      ...normalized,
      ac: getEquippedAC(normalized),
    };
  });
}

export function characterCollectionSnapshotFromCampaign(campaignSnapshot: { campaign: { version: number }; characters: Character[] }): CharacterCollectionSnapshot {
  return {
    characters: normalizeCharacters(campaignSnapshot.characters),
    version: campaignSnapshot.campaign.version,
  };
}

export function useCharacterCollectionSession() {
  const {
    hosted,
    hostedClient,
    playerId,
    playerName,
    linkedCharacterId,
    setLinkedCharacterId,
  } = useMultiplayerSession();
  const { isDM } = useGame();
  const [snapshot, setSnapshot] = useState<CharacterCollectionSnapshot>(() => ({
    characters: normalizeCharacters(getCharacters()),
    version: 0,
  }));
  const [status, setStatus] = useState<SessionStatus>({ mode: hosted ? 'hosted' : 'local', state: 'idle', error: null });

  useEffect(() => {
    if (!hosted || !hostedClient) {
      setStatus({ mode: 'local', state: 'connected', error: null });
      setSnapshot({ characters: normalizeCharacters(getCharacters()), version: 0 });
      return;
    }

    let active = true;
    setStatus({ mode: 'hosted', state: 'connecting', error: null });

    const refresh = async () => {
      try {
        const campaignSnapshot = await hostedClient.fetchSnapshot();
        if (!active) return;
        setSnapshot(characterCollectionSnapshotFromCampaign(campaignSnapshot));
        setStatus({ mode: 'hosted', state: 'connected', error: null });
      } catch (error) {
        if (!active) return;
        setStatus({ mode: 'hosted', state: 'error', error: error instanceof Error ? error.message : 'Failed to load hosted characters.' });
      }
    };

    void refresh();
    const unsubscribe = hostedClient.subscribe(event => {
      if (event.type.startsWith('character:')) {
        void refresh();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [hosted, hostedClient]);

  return {
    snapshot,
    status,
    createCharacter: async (character: Character) => {
      const nextCharacter = hosted
        ? assignCharacterOwner(character, { id: playerId, name: playerName })
        : character;

      if (!hosted || !hostedClient) {
        addLocalCharacter(nextCharacter);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:created', source: 'local-ui', payload: { character: nextCharacter } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      setLinkedCharacterId(nextCharacter.id);
      return nextSnapshot.characters;
    },
    updateCharacter: async (character: Character) => {
      if (hosted && !canManageCharacter(character, isDM, playerId)) {
        throw new Error('You can only edit a character linked to your player profile.');
      }

      if (!hosted || !hostedClient) {
        updateLocalCharacter(character);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:updated', source: 'local-ui', payload: { character } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      return nextSnapshot.characters;
    },
    removeCharacter: async (characterId: string) => {
      const target = snapshot.characters.find(character => character.id === characterId);
      if (hosted && !canManageCharacter(target, isDM, playerId)) {
        throw new Error('You can only delete a character linked to your player profile.');
      }

      if (!hosted || !hostedClient) {
        deleteLocalCharacter(characterId);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:deleted', source: 'local-ui', payload: { characterId } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      if (linkedCharacterId === characterId) {
        setLinkedCharacterId('');
      }
      return nextSnapshot.characters;
    },
    linkCharacter: async (characterId: string) => {
      const character = snapshot.characters.find(entry => entry.id === characterId);
      if (!character) {
        throw new Error('Character not found.');
      }
      if (hosted && !canLinkCharacter(character, isDM, playerId)) {
        throw new Error('This character is already linked to another player.');
      }

      const linked = assignCharacterOwner(character, { id: playerId, name: playerName });

      if (!hosted || !hostedClient) {
        updateLocalCharacter(linked);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        setLinkedCharacterId(characterId);
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:updated', source: 'local-ui', payload: { character: linked } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      setLinkedCharacterId(characterId);
      return nextSnapshot.characters;
    },
    unlinkCharacter: async (characterId: string) => {
      const character = snapshot.characters.find(entry => entry.id === characterId);
      if (!character) {
        throw new Error('Character not found.');
      }
      if (hosted && !canManageCharacter(character, isDM, playerId)) {
        throw new Error('You can only unlink a character linked to your player profile.');
      }

      const unlinked = clearCharacterOwner(character);

      if (!hosted || !hostedClient) {
        updateLocalCharacter(unlinked);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        if (linkedCharacterId === characterId) {
          setLinkedCharacterId('');
        }
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:updated', source: 'local-ui', payload: { character: unlinked } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      if (linkedCharacterId === characterId) {
        setLinkedCharacterId('');
      }
      return nextSnapshot.characters;
    },
  };
}

export function useCharacterSession(characterId: string | undefined) {
  const collection = useCharacterCollectionSession();
  const character = useMemo(
    () => collection.snapshot.characters.find(entry => entry.id === characterId) ?? null,
    [characterId, collection.snapshot.characters],
  );

  return {
    ...collection,
    character,
  };
}
