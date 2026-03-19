import { mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SqliteCampaignRepository } from './sqliteCampaignRepository';
import { CampaignHostServer } from './campaignHostServer';

export interface DevHostConfig {
  host: string;
  port: number;
  campaignId: string;
  campaignName: string;
  rootDir: string;
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value "${value}". Expected an integer between 0 and 65535.`);
  }
  return parsed;
}

export function resolveDevHostConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): DevHostConfig {
  const rootDir = resolve(cwd, env.HOST_ROOT_DIR?.trim() || '.adventurista-host');

  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port: parsePort(env.PORT, 8787),
    campaignId: env.CAMPAIGN_ID?.trim() || 'campaign-dev',
    campaignName: env.CAMPAIGN_NAME?.trim() || 'Campaign Dev',
    rootDir,
  };
}

export function formatDevHostSummary(config: DevHostConfig, address: { host: string; port: number }): string {
  return [
    'Adventurista multiplayer host is running.',
    `Host URL: http://${address.host}:${address.port}`,
    `Campaign ID: ${config.campaignId}`,
    `Campaign Name: ${config.campaignName}`,
    `Data Root: ${config.rootDir}`,
    'Maps page settings:',
    `  Mode: Hosted`,
    `  Host URL: http://${address.host}:${address.port}`,
    `  Campaign ID: ${config.campaignId}`,
  ].join('\n');
}

export async function startDevHost(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()) {
  const config = resolveDevHostConfig(env, cwd);
  mkdirSync(config.rootDir, { recursive: true });

  const repository = new SqliteCampaignRepository({ rootDir: config.rootDir, defaultCampaignName: config.campaignName });
  repository.ensureCampaign({ id: config.campaignId, name: config.campaignName });

  const server = new CampaignHostServer({
    repository,
    host: config.host,
    port: config.port,
  });

  const address = await server.listen();

  return {
    config,
    address,
    server,
    summary: formatDevHostSummary(config, address),
  };
}

async function main() {
  const { server, summary } = await startDevHost();
  console.log(summary);

  const shutdown = async (signal: string) => {
    console.log(`\nReceived ${signal}; shutting down multiplayer host...`);
    await server.close();
    process.exit(0);
  };

  process.on('SIGINT', () => {
    void shutdown('SIGINT');
  });
  process.on('SIGTERM', () => {
    void shutdown('SIGTERM');
  });
}

const isEntrypoint = process.argv[1] && resolve(process.argv[1]) === resolve(fileURLToPath(import.meta.url));

if (isEntrypoint) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : error);
    process.exit(1);
  });
}
