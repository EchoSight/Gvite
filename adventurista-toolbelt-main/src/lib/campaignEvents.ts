import type { GameRole } from './gameRole';
import type { Character, CampaignResource, MapToken, SpellTemplate } from './types';
import type { GridSettings, MapEntry } from './repositories';
import type { Obstacle } from './obstacles';

export type CampaignEventSource = 'local-ui' | 'sync';

interface CampaignEventBase<TType extends string, TPayload> {
  id: string;
  type: TType;
  occurredAt: string;
  source: CampaignEventSource;
  payload: TPayload;
}

export type CampaignEvent =
  | CampaignEventBase<'role:set', { role: GameRole }>
  | CampaignEventBase<'character:created', { character: Character }>
  | CampaignEventBase<'character:updated', { character: Character }>
  | CampaignEventBase<'character:deleted', { characterId: string }>
  | CampaignEventBase<'resource:created', { resource: CampaignResource }>
  | CampaignEventBase<'resource:deleted', { resourceId: string }>
  | CampaignEventBase<'map:created', { map: MapEntry }>
  | CampaignEventBase<'map:deleted', { mapId: string }>
  | CampaignEventBase<'map:tokens_updated', { mapId: string; tokens: MapToken[] }>
  | CampaignEventBase<'map:grid_updated', { mapId: string; gridSettings: GridSettings }>
  | CampaignEventBase<'map:obstacles_updated', { mapId: string; obstacles: Obstacle[] }>
  | CampaignEventBase<'map:spell_templates_updated', { mapId: string; spellTemplates: SpellTemplate[] }>;

export type CampaignEventInput = Omit<CampaignEvent, 'id' | 'occurredAt'>;

export function createCampaignEvent(event: CampaignEventInput): CampaignEvent {
  return {
    ...event,
    id: `evt-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    occurredAt: new Date().toISOString(),
  } as CampaignEvent;
}
