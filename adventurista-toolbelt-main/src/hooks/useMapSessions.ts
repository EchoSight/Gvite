import { useEffect, useMemo, useState } from 'react';
import type { GridSettings, MapEntry } from '@/lib/repositories';
import {
  MapCollectionSession,
  type MapCollectionSnapshot,
  MapSession,
  type MapSnapshot,
  mapCollectionSnapshotFromCampaign,
  mapSnapshotFromCampaign,
  resolveMapIntent,
  type MapIntent,
} from '@/lib/mapSessions';
import { NetworkCampaignClient } from '@/lib/networkCampaignSync';
import { useMultiplayerSession } from '@/lib/MultiplayerSessionContext';

interface SessionStatus {
  mode: 'local' | 'hosted';
  state: 'idle' | 'connecting' | 'connected' | 'error';
  error: string | null;
}

function emptyCollectionSnapshot(): MapCollectionSnapshot {
  return { maps: [], version: 0 };
}

function parseDataUrl(dataUrl: string): { mimeType: string; bytes: Uint8Array } | null {
  const match = dataUrl.match(/^data:([^;]+);base64,(.+)$/);
  if (!match) return null;

  const [, mimeType, base64Payload] = match;
  const binary = atob(base64Payload);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return { mimeType, bytes };
}

async function hydrateHostedMap(client: NetworkCampaignClient, map: MapEntry): Promise<MapEntry> {
  const parsed = parseDataUrl(map.image);
  if (!parsed) return map;

  const asset = await client.uploadAsset({
    kind: 'maps',
    filename: `${map.id}.${parsed.mimeType.split('/')[1] ?? 'png'}`,
    mimeType: parsed.mimeType,
    content: parsed.bytes,
  });

  return {
    ...map,
    image: client.getAssetUrl(asset.id),
  };
}

export function useMapCollectionSession() {
  const localSession = useMemo(() => new MapCollectionSession(), []);
  const { hosted, hostedClient } = useMultiplayerSession();

  const [snapshot, setSnapshot] = useState<MapCollectionSnapshot>(() => localSession.getSnapshot());
  const [status, setStatus] = useState<SessionStatus>({ mode: hosted ? 'hosted' : 'local', state: 'idle', error: null });

  useEffect(() => {
    if (!hosted || !hostedClient) {
      setStatus({ mode: 'local', state: 'connected', error: null });
      setSnapshot(localSession.getSnapshot());
      return localSession.subscribe(setSnapshot);
    }

    let active = true;
    setStatus({ mode: 'hosted', state: 'connecting', error: null });

    const refresh = async () => {
      try {
        const campaignSnapshot = await hostedClient.fetchSnapshot();
        if (!active) return;
        setSnapshot(mapCollectionSnapshotFromCampaign(campaignSnapshot));
        setStatus({ mode: 'hosted', state: 'connected', error: null });
      } catch (error) {
        if (!active) return;
        setStatus({ mode: 'hosted', state: 'error', error: error instanceof Error ? error.message : 'Failed to load hosted maps.' });
      }
    };

    void refresh();
    const unsubscribe = hostedClient.subscribe(event => {
      if (event.type === 'map:created' || event.type === 'map:deleted') {
        void refresh();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [hosted, hostedClient, localSession]);

  return {
    snapshot,
    status,
    createMap: async (map: MapEntry) => {
      if (!hosted || !hostedClient) {
        return localSession.createMap(map);
      }

      const hostedMap = await hydrateHostedMap(hostedClient, map);
      await hostedClient.sendEvent({ type: 'map:created', source: 'local-ui', payload: { map: hostedMap } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      setSnapshot(mapCollectionSnapshotFromCampaign(campaignSnapshot));
      return campaignSnapshot.maps;
    },
    removeMap: async (mapId: string) => {
      if (!hosted || !hostedClient) {
        return localSession.removeMap(mapId);
      }

      await hostedClient.sendEvent({ type: 'map:deleted', source: 'local-ui', payload: { mapId } });
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      setSnapshot(mapCollectionSnapshotFromCampaign(campaignSnapshot));
      return campaignSnapshot.maps;
    },
  };
}

export function useMapSession(mapId: string, fallbackGridSettings: GridSettings) {
  const localSession = useMemo(
    () => new MapSession(mapId, fallbackGridSettings),
    [mapId, fallbackGridSettings],
  );
  const { hosted, hostedClient } = useMultiplayerSession();

  const [snapshot, setSnapshot] = useState<MapSnapshot>(() => localSession.getSnapshot());
  const [status, setStatus] = useState<SessionStatus>({ mode: hosted ? 'hosted' : 'local', state: 'idle', error: null });

  useEffect(() => {
    if (!hosted || !hostedClient) {
      setStatus({ mode: 'local', state: 'connected', error: null });
      setSnapshot(localSession.getSnapshot());
      return localSession.subscribe(setSnapshot);
    }

    let active = true;
    setStatus({ mode: 'hosted', state: 'connecting', error: null });

    const refresh = async () => {
      try {
        const campaignSnapshot = await hostedClient.fetchSnapshot();
        if (!active) return;
        setSnapshot(mapSnapshotFromCampaign(campaignSnapshot, mapId, fallbackGridSettings));
        setStatus({ mode: 'hosted', state: 'connected', error: null });
      } catch (error) {
        if (!active) return;
        setStatus({ mode: 'hosted', state: 'error', error: error instanceof Error ? error.message : 'Failed to load hosted map.' });
      }
    };

    void refresh();
    const unsubscribe = hostedClient.subscribe(event => {
      if (event.type === 'map:created' || ('mapId' in event.payload && event.payload.mapId === mapId)) {
        void refresh();
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [fallbackGridSettings, hosted, hostedClient, localSession, mapId]);

  return {
    snapshot,
    status,
    dispatch: async (intent: MapIntent) => {
      if (!hosted || !hostedClient) {
        return localSession.dispatch(intent);
      }

      const event = resolveMapIntent(snapshot, intent);
      await hostedClient.sendEvent(event);
      const campaignSnapshot = await hostedClient.fetchSnapshot();
      setSnapshot(mapSnapshotFromCampaign(campaignSnapshot, mapId, fallbackGridSettings));
    },
  };
}
