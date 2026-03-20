import { createContext, useContext, useEffect, useMemo } from 'react';
import { NetworkCampaignClient } from '@/lib/networkCampaignSync';
import { isHostedMultiplayerEnabled } from '@/lib/multiplayerSettings';
import { createPlayerId } from '@/lib/playerOwnership';
import { useMultiplayerSettings } from '@/hooks/useMultiplayerSettings';

interface MultiplayerSessionContextValue {
  settings: ReturnType<typeof useMultiplayerSettings>['settings'];
  saveSettings: ReturnType<typeof useMultiplayerSettings>['saveSettings'];
  hosted: boolean;
  hostedClient: NetworkCampaignClient | null;
  playerId: string;
  playerName: string;
  linkedCharacterId: string;
  setLinkedCharacterId: (characterId: string) => void;
}

const MultiplayerSessionContext = createContext<MultiplayerSessionContextValue | null>(null);

function createHostedClient(hostUrl: string, campaignId: string) {
  return new NetworkCampaignClient({
    baseUrl: hostUrl,
    campaignId,
    webSocketFactory: url => new WebSocket(url),
  });
}

export function MultiplayerSessionProvider({ children }: { children: React.ReactNode }) {
  const { settings, saveSettings } = useMultiplayerSettings();
  const hosted = isHostedMultiplayerEnabled(settings);
  const hostedClient = useMemo(
    () => hosted ? createHostedClient(settings.hostUrl, settings.campaignId) : null,
    [hosted, settings.hostUrl, settings.campaignId],
  );

  useEffect(() => {
    if (settings.playerId) return;
    saveSettings({
      ...settings,
      playerId: createPlayerId(),
    });
  }, [saveSettings, settings]);

  useEffect(() => {
    if (!hostedClient) return;
    hostedClient.connect();
    return () => {
      hostedClient.disconnect();
    };
  }, [hostedClient]);

  const playerId = settings.playerId || createPlayerId();
  const playerName = settings.playerName.trim() || 'Player';

  const value = useMemo(
    () => ({
      settings,
      saveSettings,
      hosted,
      hostedClient,
      playerId,
      playerName,
      linkedCharacterId: settings.linkedCharacterId,
      setLinkedCharacterId: (characterId: string) => {
        saveSettings({
          ...settings,
          linkedCharacterId: characterId,
        });
      },
    }),
    [hosted, hostedClient, playerId, playerName, saveSettings, settings],
  );

  return (
    <MultiplayerSessionContext.Provider value={value}>
      {children}
    </MultiplayerSessionContext.Provider>
  );
}

export function useMultiplayerSession() {
  const context = useContext(MultiplayerSessionContext);
  if (!context) {
    throw new Error('useMultiplayerSession must be used within a MultiplayerSessionProvider.');
  }

  return context;
}
