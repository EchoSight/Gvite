import { mkdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { AssetInput, StoredAsset } from '@/lib/campaignState';

function sanitizeFilename(filename: string): string {
  return filename.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '') || 'asset.bin';
}

function createAssetId(): string {
  return `asset-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export class FilesystemAssetStorage {
  constructor(private readonly rootDir: string) {}

  store(campaignId: string, asset: AssetInput): StoredAsset {
    const assetId = createAssetId();
    const safeFilename = sanitizeFilename(asset.filename);
    const relativePath = join('campaigns', campaignId, 'assets', asset.kind, `${assetId}-${safeFilename}`);
    const absolutePath = join(this.rootDir, relativePath);
    mkdirSync(join(this.rootDir, 'campaigns', campaignId, 'assets', asset.kind), { recursive: true });

    const content = typeof asset.content === 'string'
      ? Buffer.from(asset.content, 'utf8')
      : Buffer.from(asset.content);
    writeFileSync(absolutePath, content);
    const stats = statSync(absolutePath);
    const createdAt = new Date().toISOString();

    return {
      id: assetId,
      campaignId,
      kind: asset.kind,
      filename: safeFilename,
      mimeType: asset.mimeType,
      relativePath,
      size: stats.size,
      createdAt,
    };
  }
}
