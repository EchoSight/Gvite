# Multiplayer host scaffolding

This folder contains the first host-side multiplayer building blocks:

- `sqliteCampaignRepository.ts` persists campaign snapshots and event history in SQLite via the system `sqlite3` CLI.
- `fileAssetStorage.ts` stores binary assets on disk under `campaigns/<campaign-id>/assets/<kind>/`.
- `campaignHostServer.ts` exposes:
  - `GET /api/campaigns/:campaignId/snapshot`
  - `GET /api/campaigns/:campaignId/events?afterVersion=...`
  - `POST /api/campaigns/:campaignId/events`
  - `POST /api/campaigns/:campaignId/assets`
  - `GET /health`
  - WebSocket upgrades on `/ws?campaignId=<id>`

The current implementation is deliberately minimal:

- SQLite storage is synchronous and shell-backed so it works without adding native npm dependencies.
- Assets are written to the filesystem and their metadata is indexed in SQLite.
- WebSocket transport is text-frame only and optimized for campaign event broadcasts.

This is enough to prove the server-side persistence and transport boundaries needed for a DM-hosted multiplayer MVP.

## Development host bootstrap

Run the host locally with:

```sh
npm run host:dev
```

Defaults:

- host: `127.0.0.1`
- port: `8787`
- campaign id: `campaign-dev`
- root directory: `.adventurista-host/`

For local development, keeping host data under the repo-local `.adventurista-host/` directory makes the SQLite database and uploaded assets easy to inspect. For the future desktop build, this root should move to the platform app-data directory instead of the project folder.

Supported environment variables:

- `HOST`
- `PORT`
- `CAMPAIGN_ID`
- `CAMPAIGN_NAME`
- `HOST_ROOT_DIR`
