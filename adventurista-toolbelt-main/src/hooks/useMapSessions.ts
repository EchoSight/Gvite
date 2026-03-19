import { useEffect, useMemo, useState } from 'react';
import type { GridSettings } from '@/lib/repositories';
import { MapCollectionSession, type MapCollectionSnapshot, MapSession, type MapSnapshot } from '@/lib/mapSessions';

export function useMapCollectionSession() {
  const session = useMemo(() => new MapCollectionSession(), []);
  const [snapshot, setSnapshot] = useState<MapCollectionSnapshot>(() => session.getSnapshot());

  useEffect(() => session.subscribe(setSnapshot), [session]);

  return {
    snapshot,
    createMap: (map: MapCollectionSnapshot['maps'][number]) => session.createMap(map),
    removeMap: (mapId: string) => session.removeMap(mapId),
  };
}

export function useMapSession(mapId: string, fallbackGridSettings: GridSettings) {
  const session = useMemo(
    () => new MapSession(mapId, fallbackGridSettings),
    [mapId, fallbackGridSettings],
  );
  const [snapshot, setSnapshot] = useState<MapSnapshot>(() => session.getSnapshot());

  useEffect(() => session.subscribe(setSnapshot), [session]);

  return {
    snapshot,
    dispatch: session.dispatch.bind(session),
  };
}
