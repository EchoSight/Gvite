/** @vitest-environment node */
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { formatDevHostSummary, resolveDevHostConfig, startDevHost } from '@/server/devHost';

describe('devHost bootstrap', () => {
  const closers: Array<() => Promise<void>> = [];

  afterEach(async () => {
    await Promise.all(closers.splice(0).map(close => close()));
  });

  it('resolves defaults for local development', () => {
    const config = resolveDevHostConfig({}, '/workspace/Gvite/adventurista-toolbelt-main');

    expect(config.host).toBe('127.0.0.1');
    expect(config.port).toBe(8787);
    expect(config.campaignId).toBe('campaign-dev');
    expect(config.rootDir).toBe('/workspace/Gvite/adventurista-toolbelt-main/.adventurista-host');
    expect(config.allowedOrigins).toEqual(['*']);
  });

  it('accepts environment overrides', () => {
    const config = resolveDevHostConfig({
      HOST: '0.0.0.0',
      PORT: '9000',
      CAMPAIGN_ID: 'camp-42',
      CAMPAIGN_NAME: 'Storm Keep',
      HOST_ROOT_DIR: 'tmp/host-data',
      CORS_ALLOWED_ORIGINS: 'https://echosight.github.io,https://example.com',
    }, '/repo');

    expect(config).toEqual({
      host: '0.0.0.0',
      port: 9000,
      campaignId: 'camp-42',
      campaignName: 'Storm Keep',
      rootDir: '/repo/tmp/host-data',
      allowedOrigins: ['https://echosight.github.io', 'https://example.com'],
    });
  });

  it('starts the host and formats a copyable summary', async () => {
    const cwd = mkdtempSync(join(tmpdir(), 'adventurista-dev-host-'));
    const started = await startDevHost({
      HOST: '127.0.0.1',
      PORT: '0',
      CAMPAIGN_ID: 'camp-dev',
      CAMPAIGN_NAME: 'Camp Dev',
      HOST_ROOT_DIR: '.runtime',
    }, cwd);
    closers.push(() => started.server.close());

    expect(started.address.host).toBe('127.0.0.1');
    expect(started.address.port).toBeGreaterThan(0);

    const summary = formatDevHostSummary(started.config, started.address);
    expect(summary).toContain(`Host URL: http://127.0.0.1:${started.address.port}`);
    expect(summary).toContain('Campaign ID: camp-dev');
    expect(summary).toContain('Allowed Origins: *');

    const snapshotResponse = await fetch(`http://127.0.0.1:${started.address.port}/api/campaigns/camp-dev/snapshot`);
    expect(snapshotResponse.status).toBe(200);
  });
});
