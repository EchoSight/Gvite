import { spawn, spawnSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

const rawMode = process.argv[2] ?? 'local';
const mode = rawMode.toLowerCase();
const scriptDir = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(scriptDir, '..');
const nodeExecutable = process.execPath;
const viteCli = resolve(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const viteNodeCli = resolve(projectRoot, 'node_modules', 'vite-node', 'vite-node.mjs');

if (mode === '--help' || mode === '-h' || mode === 'help') {
  printHelp();
  process.exit(0);
}

const supportedModes = new Set(['local', 'lan', 'host']);

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
  console.log(`Adventurista local stack helper\n\nUsage:\n  node scripts/serve-stack.mjs [local|lan|host]\n\nModes:\n  local  Start the Vite app and multiplayer host for same-machine testing.\n  lan    Start the Vite app and multiplayer host with LAN-friendly host binding.\n  host   Start only the multiplayer host.\n\nExamples:\n  npm run stack\n  node scripts/serve-stack.mjs\n  node scripts/serve-stack.mjs lan\n`);
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

if (mode !== 'host') {
  startProcess('frontend', nodeExecutable, [viteCli]);
}

const hostEnv = mode === 'lan' ? { HOST: '0.0.0.0' } : {};
startProcess('multiplayer host', nodeExecutable, [viteNodeCli, '--config', 'vite.config.ts', '--script', 'src/server/devHost.ts'], hostEnv);
