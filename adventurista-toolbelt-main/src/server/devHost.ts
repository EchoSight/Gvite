import { mkdirSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
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
  allowedOrigins: string[];
}

function parseAllowedOrigins(value: string | undefined): string[] {
  if (!value || !value.trim()) return ['*'];
  const parsed = value.split(',').map(origin => origin.trim()).filter(Boolean);
  return parsed.length > 0 ? parsed : ['*'];
}

function parsePort(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 65535) {
    throw new Error(`Invalid PORT value "${value}". Expected an integer between 0 and 65535.`);
  }
  return parsed;
}

function isWildcardHost(host: string): boolean {
  return host === '0.0.0.0' || host === '::';
}

function getLanUrls(port: number, interfaces = networkInterfaces()): string[] {
  const urls = new Set<string>();

  Object.values(interfaces).forEach(addresses => {
    addresses?.forEach(address => {
      if (address.internal || address.family !== 'IPv4') return;
      urls.add(`http://${address.address}:${port}`);
    });
  });

  return [...urls].sort();
}

export function getReachableHostUrls(host: string, port: number, interfaces = networkInterfaces()): { primaryUrl: string; lanUrls: string[] } {
  if (isWildcardHost(host)) {
    const lanUrls = getLanUrls(port, interfaces);
    return {
      primaryUrl: lanUrls[0] ?? `http://127.0.0.1:${port}`,
      lanUrls,
    };
  }

  return {
    primaryUrl: `http://${host}:${port}`,
    lanUrls: [],
  };
}

export function resolveDevHostConfig(env: NodeJS.ProcessEnv = process.env, cwd = process.cwd()): DevHostConfig {
  const rootDir = resolve(cwd, env.HOST_ROOT_DIR?.trim() || '.adventurista-host');

  return {
    host: env.HOST?.trim() || '127.0.0.1',
    port: parsePort(env.PORT, 8787),
    campaignId: env.CAMPAIGN_ID?.trim() || 'campaign-dev',
    campaignName: env.CAMPAIGN_NAME?.trim() || 'Campaign Dev',
    rootDir,
    allowedOrigins: parseAllowedOrigins(env.CORS_ALLOWED_ORIGINS),
  };
}

export function formatDevHostSummary(config: DevHostConfig, address: { host: string; port: number }, interfaces = networkInterfaces()): string {
  const { primaryUrl, lanUrls } = getReachableHostUrls(config.host, address.port, interfaces);
  const lines = [
    'Adventurista multiplayer host is running.',
    `Bind Address: http://${address.host}:${address.port}`,
    `Host URL: ${primaryUrl}`,
    `Campaign ID: ${config.campaignId}`,
    `Campaign Name: ${config.campaignName}`,
    `Data Root: ${config.rootDir}`,
    `Allowed Origins: ${config.allowedOrigins.join(', ')}`,
  ];

  if (lanUrls.length > 0) {
    lines.push('LAN URLs:');
    lanUrls.forEach(url => lines.push(`  - ${url}`));
  }

  lines.push(
    'Maps page settings:',
    '  Mode: Hosted',
    `  Host URL: ${primaryUrl}`,
    `  Campaign ID: ${config.campaignId}`,
  );

  if (lanUrls.length > 0) {
    lines.push('LAN tip: share one of the LAN URLs above with other devices on the same network.');
  }

  return lines.join('\n');
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
    allowedOrigins: config.allowedOrigins,
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
