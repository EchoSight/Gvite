import type { CampaignEvent, CampaignEventInput } from './campaignEvents';
import type { CampaignSnapshot, CampaignMetadata, StoredAsset, AssetInput } from './campaignState';

export interface CreateCampaignInput {
  id: string;
  name: string;
  createdAt?: string;
}

export interface CampaignRepository {
  ensureCampaign(input: CreateCampaignInput): CampaignMetadata;
  listCampaigns(): CampaignMetadata[];
  getCampaign(campaignId: string): CampaignMetadata | null;
  getSnapshot(campaignId: string): CampaignSnapshot;
  appendEvent(campaignId: string, event: CampaignEventInput): CampaignEvent;
  getEvents(campaignId: string, afterVersion?: number): CampaignEvent[];
  storeAsset(campaignId: string, asset: AssetInput): StoredAsset;
  getAsset(campaignId: string, assetId: string): StoredAsset | null;
  readAssetContent(campaignId: string, assetId: string): { asset: StoredAsset; content: Buffer } | null;
}
