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

## Available scripts

- `npm run dev` - start the Vite development server
- `npm run host:dev` - start the DM-hosted multiplayer development server
- `npm run build` - create a production build
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

Start the DM host in a separate terminal:

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
