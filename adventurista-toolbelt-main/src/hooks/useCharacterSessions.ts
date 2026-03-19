import { useEffect, useMemo, useState } from 'react';
import type { Character } from '@/lib/types';
import { getEquippedAC } from '@/lib/types';
import {
  addCharacter as addLocalCharacter,
  deleteCharacter as deleteLocalCharacter,
  getCharacters,
  updateCharacter as updateLocalCharacter,
} from '@/lib/repositories';
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
  return characters.map(character => ({
    ...character,
    ac: getEquippedAC(character),
  }));
}

export function characterCollectionSnapshotFromCampaign(campaignSnapshot: { campaign: { version: number }; characters: Character[] }): CharacterCollectionSnapshot {
  return {
    characters: normalizeCharacters(campaignSnapshot.characters),
    version: campaignSnapshot.campaign.version,
  };
}

export function useCharacterCollectionSession() {
  const { hosted, hostedClient } = useMultiplayerSession();
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
      if (!hosted || !hostedClient) {
        addLocalCharacter(character);
        const nextCharacters = normalizeCharacters(getCharacters());
        setSnapshot(current => ({ ...current, characters: nextCharacters }));
        return nextCharacters;
      }

      await hostedClient.sendEvent({ type: 'character:created', source: 'local-ui', payload: { character } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      const nextSnapshot = characterCollectionSnapshotFromCampaign(campaignSnapshot);
      setSnapshot(nextSnapshot);
      return nextSnapshot.characters;
    },
    updateCharacter: async (character: Character) => {
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
