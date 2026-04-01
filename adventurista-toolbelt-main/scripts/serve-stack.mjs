import { spawn, spawnSync } from 'node:child_process';
import { networkInterfaces } from 'node:os';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import net from 'node:net';
import { fileURLToPath } from 'node:url';

const rawMode = process.argv[2] ?? 'local';
const mode = rawMode.toLowerCase();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const nodeExecutable = process.execPath;
const viteCli = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const viteNodeCli = resolve(projectRoot, 'node_modules', 'vite-node', 'vite-node.mjs');
const pagesBaseUrl = process.env.GVITE_PAGES_URL?.trim() || 'https://echosight.github.io/Gvite/';

if (mode === '--help' || mode === '-h' || mode === 'help') {
  printHelp();
  process.exit(0);
}

const supportedModes = new Set(['local', 'lan', 'host', 'dm']);

if (!supportedModes.has(mode)) {
  console.error(`[serve-stack] Unknown mode: ${rawMode}`);
  printHelp();
  process.exit(1);
}

const children = [];
let exiting = false;

function ensureSqliteCliAvailable() {
  const result = spawnSync('sqlite3', ['--version'], {
    cwd: projectRoot,
    stdio: 'ignore',
    shell: false,
  });

  if (result.error && 'code' in result.error && result.error.code === 'ENOENT') {
    console.error('[serve-stack] The multiplayer host requires the sqlite3 command line tool, but it was not found on your PATH.');
    console.error('[serve-stack] Install SQLite, make sure the sqlite3 executable is available in your terminal, then rerun the command.');
    console.error('[serve-stack] If you only want the frontend, run `npm run dev` instead.');
    process.exit(1);
  }
}

function printHelp() {
  console.log(`Adventurista local stack helper\n\nUsage:\n  node scripts/serve-stack.mjs [local|lan|host|dm]\n\nModes:\n  local  Start the Vite app and multiplayer host for same-machine testing.\n  lan    Start the Vite app and multiplayer host with LAN-friendly host binding.\n  host   Start only the multiplayer host.\n  dm     Start a LAN-ready multiplayer host, open the published app in your browser, and print share links for players.\n\nExamples:\n  npm run stack\n  npm run stack:dm\n  node scripts/serve-stack.mjs\n  node scripts/serve-stack.mjs lan\n`);
}


async function isPortAvailable(port, host) {
  return await new Promise((resolvePort) => {
    const server = net.createServer();
    server.unref();
    server.on('error', () => resolvePort(false));
    server.listen({ port, host }, () => {
      server.close(() => resolvePort(true));
    });
  });
}

async function findAvailablePort(startPort, hosts = ['127.0.0.1'], attempts = 20) {
  for (let offset = 0; offset <= attempts; offset += 1) {
    const candidate = startPort + offset;
    let allAvailable = true;

    for (const host of hosts) {
      // eslint-disable-next-line no-await-in-loop
      const available = await isPortAvailable(candidate, host);
      if (!available) {
        allAvailable = false;
        break;
      }
    }

    if (allAvailable) {
      return candidate;
    }
  }

  return null;
}

function parsePort(value, fallback = 8787) {
  const parsed = Number.parseInt(value ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 65535 ? parsed : fallback;
}

function isWildcardHost(host) {
  return host === '0.0.0.0' || host === '::';
}

function getLanUrls(host, port) {
  if (!isWildcardHost(host)) {
    return [`http://${host}:${port}`];
  }

  const urls = new Set();
  for (const addresses of Object.values(networkInterfaces())) {
    for (const address of addresses ?? []) {
      if (address.internal || address.family !== 'IPv4') continue;
      urls.add(`http://${address.address}:${port}`);
    }
  }

  if (urls.size === 0) {
    urls.add(`http://127.0.0.1:${port}`);
  }

  return [...urls].sort();
}

function buildHostedAppUrl({ hostUrl, campaignId, playerName, role = 'player', path = '/maps' }) {
  const url = new URL(pagesBaseUrl);
  url.searchParams.set('mode', 'hosted');
  url.searchParams.set('hostUrl', hostUrl);
  url.searchParams.set('campaignId', campaignId);
  url.searchParams.set('role', role);
  if (playerName) {
    url.searchParams.set('playerName', playerName);
  }
  url.hash = path;
  return url.toString();
}

function openInBrowser(targetUrl) {
  const platform = process.platform;
  const command = platform === 'win32' ? 'cmd' : platform === 'darwin' ? 'open' : 'xdg-open';
  const args = platform === 'win32' ? ['/c', 'start', '', targetUrl] : [targetUrl];
  const child = spawn(command, args, { detached: true, stdio: 'ignore' });

  child.on('error', (error) => {
    console.warn('[serve-stack] Failed to open a browser automatically. Open this URL manually instead:');
    console.warn(`[serve-stack]   ${targetUrl}`);
    console.warn(error);
  });
  child.unref();
}

function printDmGuide({ hostUrl, campaignId, dmUrl, playerUrl, lanUrls }) {
  console.log('\n[serve-stack] DM hosting assistant');
  console.log(`[serve-stack] Host URL: ${hostUrl}`);
  console.log(`[serve-stack] Campaign ID: ${campaignId}`);
  if (lanUrls.length > 1) {
    console.log('[serve-stack] Additional LAN URLs:');
    lanUrls.forEach(url => {
      if (url !== hostUrl) {
        console.log(`[serve-stack]   - ${url}`);
      }
    });
  }
  console.log('[serve-stack] Browser link for the DM:');
  console.log(`[serve-stack]   ${dmUrl}`);
  console.log('[serve-stack] Share this player join link with the rest of the table:');
  console.log(`[serve-stack]   ${playerUrl}`);
  console.log('[serve-stack] Quick steps:');
  console.log('[serve-stack]   1. Wait for the multiplayer host to finish booting.');
  console.log('[serve-stack]   2. The published app opens directly to Maps in hosted mode.');
  console.log('[serve-stack]   3. Confirm the sidebar says DM, then use SAVE CONNECTION if you adjust any fields.');
  console.log('[serve-stack]   4. Send the player join link above to the rest of your group.');
}

function startProcess(name, command, args, extraEnv = {}) {
  const child = spawn(command, args, {
    cwd: projectRoot,
    stdio: 'inherit',
    shell: false,
    env: {
      ...process.env,
      ...extraEnv,
    },
  });

  children.push(child);

  child.on('exit', (code, signal) => {
    if (exiting) {
      return;
    }

    const reason = signal ? `signal ${signal}` : `code ${code ?? 0}`;
    console.log(`[serve-stack] ${name} exited with ${reason}. Shutting down remaining processes.`);
    shutdown(code ?? 0);
  });

  child.on('error', (error) => {
    if (exiting) {
      return;
    }

    console.error(`[serve-stack] Failed to start ${name}:`, error);
    shutdown(1);
  });
}

function shutdown(exitCode = 0) {
  if (exiting) {
    return;
  }

  exiting = true;

  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => {
    for (const child of children) {
      if (!child.killed) {
        child.kill('SIGKILL');
      }
    }

    process.exit(exitCode);
  }, 250).unref();
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

console.log(`[serve-stack] Starting ${mode} stack...`);
ensureSqliteCliAvailable();

if (mode === 'local' || mode === 'lan') {
  startProcess('frontend', nodeExecutable, [viteCli]);
}

const defaultHost = mode === 'lan' || mode === 'dm' ? '0.0.0.0' : undefined;
const requestedHost = process.env.HOST ?? defaultHost ?? '127.0.0.1';
const requestedPort = parsePort(process.env.PORT, 8787);
const hostsForPortCheck = isWildcardHost(requestedHost) ? ['0.0.0.0', '::'] : [requestedHost];
const resolvedPort = await findAvailablePort(requestedPort, hostsForPortCheck);

if (resolvedPort === null) {
  console.error(`[serve-stack] Could not find an available host port starting at ${requestedPort}.`);
  console.error('[serve-stack] Set PORT to a free value and retry (example: PORT=8790 npm run stack:lan).');
  shutdown(1);
}

if (resolvedPort !== requestedPort) {
  console.warn(`[serve-stack] Port ${requestedPort} is in use. Falling back to ${resolvedPort} for multiplayer host.`);
}

const hostEnv = {
  ...(defaultHost ? { HOST: requestedHost } : {}),
  PORT: String(resolvedPort),
};
startProcess('multiplayer host', nodeExecutable, [viteNodeCli, '--config', 'vite.config.ts', '--script', 'src/server/devHost.ts'], hostEnv);

if (mode === 'dm') {
  const resolvedHost = requestedHost;
  const campaignId = (process.env.CAMPAIGN_ID ?? 'campaign-dev').trim();
  const dmName = (process.env.DM_PLAYER_NAME ?? 'Dungeon Master').trim();
  const lanUrls = getLanUrls(resolvedHost, resolvedPort);
  const primaryHostUrl = lanUrls[0];
  const dmUrl = buildHostedAppUrl({
    hostUrl: primaryHostUrl,
    campaignId,
    playerName: dmName,
    role: 'dm',
  });
  const playerUrl = buildHostedAppUrl({
    hostUrl: primaryHostUrl,
    campaignId,
    role: 'player',
  });

  printDmGuide({
    hostUrl: primaryHostUrl,
    campaignId,
    dmUrl,
    playerUrl,
    lanUrls,
  });

  setTimeout(() => {
    openInBrowser(dmUrl);
    console.log('[serve-stack] Opened the published app in your default browser.');
  }, 1200).unref();
}
