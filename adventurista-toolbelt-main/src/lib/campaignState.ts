import type { Character, CampaignResource, MapToken, SpellTemplate } from './types';
import type { GridSettings, MapEntry } from './repositories';
import type { Obstacle } from './obstacles';

export interface CampaignMetadata {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  version: number;
}

export interface MapStateSnapshot {
  mapId: string;
  tokens: MapToken[];
  gridSettings: GridSettings | null;
  obstacles: Obstacle[];
  spellTemplates: SpellTemplate[];
}

export interface CampaignSnapshot {
  campaign: CampaignMetadata;
  characters: Character[];
  resources: CampaignResource[];
  maps: MapEntry[];
  mapStates: Record<string, MapStateSnapshot>;
  events: Array<{
    id: string;
    type: string;
    occurredAt: string;
    source: string;
    payload: unknown;
  }>;
}

export interface StoredAsset {
  id: string;
  campaignId: string;
  kind: 'maps' | 'portraits' | 'handouts';
  filename: string;
  mimeType: string;
  relativePath: string;
  size: number;
  createdAt: string;
}

export interface AssetInput {
  kind: StoredAsset['kind'];
  filename: string;
  mimeType: string;
  content: Buffer | Uint8Array | string;
}
