import type { GameRole } from './gameRole';
import type { Character, CampaignResource, MapToken } from './types';
import type { GridSettings, MapEntry } from './repositories';
import type { Obstacle } from './obstacles';
import type { KeyValueStore } from './storage';
import type { CampaignEventSource } from './campaignEvents';
import type { CampaignSyncAdapter } from './campaignSync';
import { campaignSync } from './campaignSync';
import {
  addCharacter,
  addResource,
  deleteCharacter,
  deleteMap,
  deleteResource,
  saveGridSettings,
  saveMaps,
  saveMapTokens,
  saveObstacles,
  setGameRole,
  updateCharacter,
  getMaps,
} from './repositories';

interface MutationOptions {
  store?: KeyValueStore;
  sync?: CampaignSyncAdapter;
  source?: CampaignEventSource;
}

function getMutationContext(options?: MutationOptions) {
  return {
    store: options?.store,
    sync: options?.sync ?? campaignSync,
    source: options?.source ?? 'local-ui',
  };
}

export function setRole(role: GameRole, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  setGameRole(role, store);
  sync.emit({ type: 'role:set', source, payload: { role } });
}

export function createCharacter(character: Character, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  addCharacter(character, store);
  sync.emit({ type: 'character:created', source, payload: { character } });
}

export function saveCharacter(character: Character, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  updateCharacter(character, store);
  sync.emit({ type: 'character:updated', source, payload: { character } });
}

export function removeCharacter(characterId: string, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  deleteCharacter(characterId, store);
  sync.emit({ type: 'character:deleted', source, payload: { characterId } });
}

export function createResource(resource: CampaignResource, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  addResource(resource, store);
  sync.emit({ type: 'resource:created', source, payload: { resource } });
}

export function removeResource(resourceId: string, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  deleteResource(resourceId, store);
  sync.emit({ type: 'resource:deleted', source, payload: { resourceId } });
}

export function createMap(map: MapEntry, options?: MutationOptions): MapEntry[] {
  const { store, sync, source } = getMutationContext(options);
  const updatedMaps = [...getMaps(store), map];
  saveMaps(updatedMaps, store);
  sync.emit({ type: 'map:created', source, payload: { map } });
  return updatedMaps;
}

export function removeMap(mapId: string, options?: MutationOptions): MapEntry[] {
  const { store, sync, source } = getMutationContext(options);
  const updatedMaps = deleteMap(mapId, store);
  sync.emit({ type: 'map:deleted', source, payload: { mapId } });
  return updatedMaps;
}

export function replaceMapTokens(mapId: string, tokens: MapToken[], options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  saveMapTokens(mapId, tokens, store);
  sync.emit({ type: 'map:tokens_updated', source, payload: { mapId, tokens } });
}

export function saveMapGridSettings(mapId: string, gridSettings: GridSettings, options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  saveGridSettings(mapId, gridSettings, store);
  sync.emit({ type: 'map:grid_updated', source, payload: { mapId, gridSettings } });
}

export function replaceMapObstacles(mapId: string, obstacles: Obstacle[], options?: MutationOptions): void {
  const { store, sync, source } = getMutationContext(options);
  saveObstacles(mapId, obstacles, store);
  sync.emit({ type: 'map:obstacles_updated', source, payload: { mapId, obstacles } });
}
