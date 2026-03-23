# Adventurista Toolbelt

Adventurista Toolbelt is a Vite + React + TypeScript app for managing tabletop RPG characters, dice, resources, and tactical maps.

## Getting started

Prerequisites:

- Node.js 20+
- npm 10+

Install dependencies and start the development server:

```sh
npm install
npm run dev
```

Use those commands directly in PowerShell, Command Prompt, or Git Bash. Do **not** prefix them with `sh` in PowerShell; for example, run `npm run stack`, not `sh npm run stack`.

If you want the frontend and multiplayer host running together with one command, use:

```sh
npm run stack
```

That command works the same way in macOS/Linux shells and in Windows PowerShell/CMD.

## Available scripts

- `npm run dev` - start the Vite development server
- `npm run host:dev` - start the DM-hosted multiplayer development server
- `HOST=0.0.0.0 npm run host:dev` - bind the host for LAN play and print shareable LAN URLs
- `npm run host:start` - start the multiplayer host with production-style env vars
- `npm run stack` - start the Vite app and local multiplayer host together
- `npm run stack:lan` - start the Vite app plus a LAN-shareable multiplayer host
- `npm run stack:host` - start only the local multiplayer host helper
- `npm run build` - create a production build
- `npm run build:pages` - create a GitHub Pages-friendly static build
- `npm run preview` - preview the production build locally
- `npm run lint` - run ESLint
- `npm run test` - run the Vitest suite once
- `npm run test:watch` - run Vitest in watch mode

## Tech stack

- Vite
- React
- TypeScript
- Tailwind CSS
- shadcn/ui
- Vitest
- Playwright
## Planning docs

- [Desktop multiplayer architecture plan](docs/desktop-multiplayer-architecture.md)
- [Multiplayer host scaffolding notes](src/server/README.md)
- [Phase 2 multiplayer checklist](docs/phase-2-multiplayer-checklist.md)

## Multiplayer scaffolding

The repo now includes an initial host-side multiplayer scaffold:

- SQLite-backed campaign repository (`src/server/sqliteCampaignRepository.ts`)
- Filesystem asset storage (`src/server/fileAssetStorage.ts`)
- HTTP + WebSocket host transport (`src/server/campaignHostServer.ts`)
- Browser/client transport helper (`src/lib/networkCampaignSync.ts`)

Run the node-focused checks with:

```sh
npm run test:node
```

## Running the development multiplayer host

For the simplest local workflow, start both the frontend and DM host together:

```sh
npm run stack
```

This starts:

- the Vite frontend on port `8080`
- the multiplayer host on port `8787`

If you only want the backend host, keep using:

```sh
npm run host:dev
```

By default, the host:

- listens on `http://127.0.0.1:8787`
- uses campaign id `campaign-dev`
- stores SQLite data and uploaded assets under `.adventurista-host/`

Optional environment overrides:

- `HOST`
- `PORT`
- `CAMPAIGN_ID`
- `CAMPAIGN_NAME`
- `HOST_ROOT_DIR`

### Windows troubleshooting

If PowerShell reports that `npm.cmd` is not a valid application for your OS, that usually points to a local Node.js / npm installation issue rather than this project. In that case:

1. Run `node -v` and `Get-Command npm` in PowerShell to confirm which executables are being used.
2. Reinstall the standard Windows x64 build of Node.js from nodejs.org if `npm.cmd` is missing or corrupted.
3. Open a new PowerShell window after reinstalling, then retry `npm install` and `npm run stack`.

### LAN play

To let other devices on the same network join the host and keep the frontend running locally:

```sh
npm run stack:lan
```

If you only need the backend host for LAN play, you can still run:

```sh
HOST=0.0.0.0 npm run host:dev
```

Then:

1. Copy one of the printed `LAN URLs` from the host terminal.
2. Open the app on each player device.
3. In **Maps → Multiplayer Host Connection**, set **Mode** to `Hosted`.
4. Paste the LAN URL into **Host URL** and use the same **Campaign ID** on every device.

Notes:

- `127.0.0.1` / `localhost` only work on the same machine that is running the host.
- For phone/tablet/laptop players, use the DM machine's LAN IP such as `http://192.168.1.42:8787`.
- If you later want internet play, use a remote-safe setup such as Render, Tailscale, or port forwarding.


## GitHub Pages deployment

This repo includes a GitHub Actions workflow that deploys the app from `adventurista-toolbelt-main/` to GitHub Pages.

For a local Pages-style build, run:

```sh
npm run build:pages
```

Notes:

- The app uses `HashRouter` so route navigation works on GitHub Pages without custom rewrite rules.
- The Pages workflow installs dependencies, builds the app, and uploads `dist/` instead of the whole repository.


## Render deployment for multiplayer sync

GitHub Pages only hosts the static frontend. To sync maps across devices, deploy the multiplayer host separately.

This repo now includes:

- `render.yaml` to create a Render web service for the host
- `adventurista-toolbelt-main/Dockerfile.render` so the service has the `sqlite3` CLI available
- `CORS_ALLOWED_ORIGINS` support so the Pages frontend can call the host from another origin

Recommended Render setup:

1. Create a new **Blueprint** or **Web Service** from this repository.
2. Use `adventurista-toolbelt-main/Dockerfile.render` if you create the service manually.
3. Attach a persistent disk mounted at `/var/data`.
4. Set `HOST_ROOT_DIR=/var/data/adventurista-host`.
5. Set `CORS_ALLOWED_ORIGINS=https://echosight.github.io`.
6. After deploy, copy the Render service URL into the Maps page as **Host URL** and use the same **Campaign ID** on every device. For this deployment, use `https://gvite.onrender.com` as the **Host URL**.

The host exposes `/health` for Render health checks and stores campaign data plus uploaded map assets under the configured host root directory.
