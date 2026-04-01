import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const host = process.env.ELECTRON_DEV_HOST || '127.0.0.1';
const port = Number(process.env.ELECTRON_DEV_PORT || 8080);
const url = `http://${host}:${port}`;

const children = [];
const projectRoot = fileURLToPath(new URL('..', import.meta.url));
const viteCliPath = join(projectRoot, 'node_modules', 'vite', 'bin', 'vite.js');
const electronCliPath = join(projectRoot, 'node_modules', 'electron', 'cli.js');

function terminateChildren(exitCode = 0) {
  for (const child of children) {
    if (!child.killed) {
      child.kill('SIGTERM');
    }
  }

  setTimeout(() => process.exit(exitCode), 25);
}

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForServer(maxAttempts = 120) {
  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await fetch(url);
      if (response.ok || response.status >= 300) {
        return;
      }
    } catch {
      // Keep retrying until Vite server is ready.
    }
    await wait(250);
  }

  throw new Error(`Vite dev server did not become reachable at ${url}`);
}

async function main() {
  if (!existsSync(viteCliPath)) {
    throw new Error('Vite CLI not found. Run "npm install" before starting electron:dev.');
  }
  if (!existsSync(electronCliPath)) {
    throw new Error('Electron CLI not found. Install it first with "npm i -D electron".');
  }

  const vite = spawn(process.execPath, [viteCliPath, '--host', host, '--port', String(port)], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: process.env,
  });
  children.push(vite);

  vite.on('exit', (code, signal) => {
    if (signal) {
      terminateChildren(1);
      return;
    }

    if (code && code !== 0) {
      terminateChildren(code);
    }
  });

  await waitForServer();

  const electronEnv = {
    ...process.env,
    ELECTRON_RENDERER_URL: url,
  };

  const electron = spawn(process.execPath, [electronCliPath, '.'], {
    cwd: projectRoot,
    stdio: 'inherit',
    env: electronEnv,
  });
  children.push(electron);

  electron.on('exit', code => {
    terminateChildren(code ?? 0);
  });
}

process.on('SIGINT', () => terminateChildren(0));
process.on('SIGTERM', () => terminateChildren(0));

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  terminateChildren(1);
});
