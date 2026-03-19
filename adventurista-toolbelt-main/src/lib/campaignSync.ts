import { CampaignEvent, CampaignEventInput, createCampaignEvent } from './campaignEvents';

export type CampaignEventListener = (event: CampaignEvent) => void;

export interface CampaignSyncAdapter {
  emit(event: CampaignEventInput): CampaignEvent;
  subscribe(listener: CampaignEventListener): () => void;
  getEventLog(): CampaignEvent[];
  clearEventLog(): void;
}

export class LocalCampaignSync implements CampaignSyncAdapter {
  private readonly listeners = new Set<CampaignEventListener>();
  private readonly eventLog: CampaignEvent[] = [];

  emit(event: CampaignEventInput): CampaignEvent {
    const createdEvent = createCampaignEvent(event);
    this.eventLog.push(createdEvent);
    this.listeners.forEach(listener => listener(createdEvent));
    return createdEvent;
  }

  subscribe(listener: CampaignEventListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  getEventLog(): CampaignEvent[] {
    return [...this.eventLog];
  }

  clearEventLog(): void {
    this.eventLog.length = 0;
  }
}

export const campaignSync = new LocalCampaignSync();
