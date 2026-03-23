import type { Character, CampaignResource, MapToken, SpellTemplate } from './types';
import type { GameRole } from './gameRole';
import { getEquippedAC } from './types';
import { normalizeCharacterSpellcasting } from './spellcasting';
import type { Obstacle } from './obstacles';
import { appStorage, type KeyValueStore, readJson, writeJson } from './storage';

export interface MapEntry {
  id: string;
  name: string;
  image: string;
  createdAt: string;
}

export interface GridSettings {
  showGrid: boolean;
  gridSize: number;
  ftPerCell: number;
  offsetX: number;
  offsetY: number;
}

const storageKeys = {
  characters: 'dnd_characters',
  resources: 'dnd_resources',
  role: 'dnd_role',
  maps: 'dnd_maps',
  mapTokens: (mapId: string) => `map-tokens-${mapId}`,
  mapGridSettings: (mapId: string) => `map-grid-settings-${mapId}`,
  mapObstacles: (mapId: string) => `map-obstacles-${mapId}`,
  mapSpellTemplates: (mapId: string) => `map-spell-templates-${mapId}`,
};

const defaultResources: CampaignResource[] = [
  {
    id: 'res-1', title: 'Standard Array',
    description: 'The standard ability score array for quick character creation.',
    tags: ['rules', 'character-creation'],
    type: 'rules',
    content: '15, 14, 13, 12, 10, 8 — Assign one to each ability score.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-2', title: 'Conditions Reference',
    description: 'Quick reference for all combat conditions.',
    tags: ['rules', 'combat'],
    type: 'handout',
    content: 'Blinded, Charmed, Deafened, Exhaustion, Frightened, Grappled, Incapacitated, Invisible, Paralyzed, Petrified, Poisoned, Prone, Restrained, Stunned, Unconscious.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-3', title: 'Starter Dungeon Map',
    description: 'A simple 5-room dungeon for level 1 parties.',
    tags: ['maps', 'starter'],
    type: 'map',
    content: 'Room 1: Entry Hall (2 Goblins) → Room 2: Trapped Corridor (DC 12 Perception) → Room 3: Armory (Loot) → Room 4: Boss Chamber (Bugbear) → Room 5: Treasure Vault.',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'res-4', title: 'Town of Willowmere',
    description: 'A small frontier town for campaign starting point.',
    tags: ['lore', 'setting'],
    type: 'lore',
    content: 'Pop: ~200. Notable NPCs: Mayor Elda Thornwick (Human, LG), Blacksmith Grok (Half-Orc), Innkeeper Mira (Halfling). Tavern: The Rusty Lantern. Quest Board available.',
    createdAt: new Date().toISOString(),
  },
];

export function getCharacters(store: KeyValueStore = appStorage): Character[] {
  const parsed = readJson<Character[]>(store, storageKeys.characters, []);
  return parsed.map(character => {
    const normalized = normalizeCharacterSpellcasting(character);
    return {
      ...normalized,
      ac: getEquippedAC(normalized),
    };
  });
}

export function saveCharacters(chars: Character[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.characters, chars);
}

export function addCharacter(char: Character, store: KeyValueStore = appStorage): void {
  const chars = getCharacters(store);
  chars.push(char);
  saveCharacters(chars, store);
}

export function updateCharacter(char: Character, store: KeyValueStore = appStorage): void {
  const chars = getCharacters(store).map(c => c.id === char.id ? char : c);
  saveCharacters(chars, store);
}

export function deleteCharacter(id: string, store: KeyValueStore = appStorage): void {
  saveCharacters(getCharacters(store).filter(c => c.id !== id), store);
}

export function getResources(store: KeyValueStore = appStorage): CampaignResource[] {
  const data = readJson<CampaignResource[] | null>(store, storageKeys.resources, null);
  if (data) return data;

  writeJson(store, storageKeys.resources, defaultResources);
  return defaultResources;
}

export function saveResources(resources: CampaignResource[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.resources, resources);
}

export function addResource(resource: CampaignResource, store: KeyValueStore = appStorage): void {
  const resources = getResources(store);
  resources.push(resource);
  saveResources(resources, store);
}

export function deleteResource(id: string, store: KeyValueStore = appStorage): void {
  saveResources(getResources(store).filter(r => r.id !== id), store);
}

export function getGameRole(store: KeyValueStore = appStorage): GameRole {
  const storedRole = store.getItem(storageKeys.role);
  return storedRole === 'dm' ? 'dm' : 'player';
}

export function setGameRole(role: GameRole, store: KeyValueStore = appStorage): void {
  store.setItem(storageKeys.role, role);
}

export function getMaps(store: KeyValueStore = appStorage): MapEntry[] {
  return readJson<MapEntry[]>(store, storageKeys.maps, []);
}

export function saveMaps(maps: MapEntry[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.maps, maps);
}

export function deleteMap(mapId: string, store: KeyValueStore = appStorage): MapEntry[] {
  const updatedMaps = getMaps(store).filter(map => map.id !== mapId);
  saveMaps(updatedMaps, store);
  store.removeItem(storageKeys.mapTokens(mapId));
  store.removeItem(storageKeys.mapGridSettings(mapId));
  store.removeItem(storageKeys.mapObstacles(mapId));
  store.removeItem(storageKeys.mapSpellTemplates(mapId));
  return updatedMaps;
}

export function loadMapTokens(mapId: string, store: KeyValueStore = appStorage): MapToken[] {
  return readJson<MapToken[]>(store, storageKeys.mapTokens(mapId), []);
}

export function saveMapTokens(mapId: string, tokens: MapToken[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.mapTokens(mapId), tokens);
}

export function loadGridSettings(mapId: string, fallback: GridSettings, store: KeyValueStore = appStorage): GridSettings {
  const parsed = readJson<Partial<GridSettings> | null>(store, storageKeys.mapGridSettings(mapId), null);
  if (!parsed) return fallback;

  return {
    showGrid: parsed.showGrid ?? fallback.showGrid,
    gridSize: parsed.gridSize ?? fallback.gridSize,
    ftPerCell: parsed.ftPerCell ?? fallback.ftPerCell,
    offsetX: parsed.offsetX ?? fallback.offsetX,
    offsetY: parsed.offsetY ?? fallback.offsetY,
  };
}

export function saveGridSettings(mapId: string, gridSettings: GridSettings, store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.mapGridSettings(mapId), gridSettings);
}

export function loadObstacles(mapId: string, store: KeyValueStore = appStorage): Obstacle[] {
  return readJson<Obstacle[]>(store, storageKeys.mapObstacles(mapId), []);
}

export function saveObstacles(mapId: string, obstacles: Obstacle[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.mapObstacles(mapId), obstacles);
}


export function loadSpellTemplates(mapId: string, store: KeyValueStore = appStorage): SpellTemplate[] {
  return readJson<SpellTemplate[]>(store, storageKeys.mapSpellTemplates(mapId), []);
}

export function saveSpellTemplates(mapId: string, spellTemplates: SpellTemplate[], store: KeyValueStore = appStorage): void {
  writeJson(store, storageKeys.mapSpellTemplates(mapId), spellTemplates);
}
