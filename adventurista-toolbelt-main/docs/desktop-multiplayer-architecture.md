# Desktop Multiplayer Architecture Plan

## Goal

Recreate Adventurista Toolbelt as a PC app while preserving the current feature set:

- the Dungeon Master hosts the session locally;
- campaign files, maps, resources, and saves live on the DM machine;
- players connect to the DM over the local network or internet;
- players can view and control only their own characters on shared maps;
- the DM remains authoritative for campaign state, fog of war, initiative, monsters, and file storage.

## Current constraints in this repo

The current app is a single-user browser app. State is stored directly in `localStorage`, including:

- characters and resources;
- role selection;
- map uploads;
- map tokens and grid settings;
- obstacles and fog-of-war related state.

That means the app already has useful UI and domain logic, but it does not yet have a shared state model, user identity, permissions, or a networking layer.

## Recommended packaging approach

### Use Electron first

The easiest path is to wrap the existing React + Vite app in Electron:

- **Renderer:** keep the current React UI with minimal changes.
- **Main process:** runs the desktop shell, manages local files, and starts the game server.
- **Preload bridge:** exposes safe APIs for file access, campaign management, and host controls.

This is the fastest route because it reuses nearly all existing UI code and lets the DM host from the same app window.

### Why not a browser-only host?

A browser-only host can work, but desktop packaging solves several problems cleanly:

- access to local files without awkward browser prompts;
- a predictable location for campaign saves and map assets;
- a bundled local server process;
- easier LAN hosting and better offline behavior.

## Multiplayer model

### Host-authoritative architecture

Use a **host-authoritative client/server model**.

- The **DM app** runs the server.
- **Players** run the client app.
- The server owns the canonical campaign state.
- Clients send intents, not direct state mutations.
- The server validates intents, updates state, persists it, and broadcasts changes.

This is the most important design choice. It keeps players from accidentally overwriting each other, makes permissions manageable, and ensures all saved files stay with the DM.

### Networking transport

Use:

- **HTTP** for login/session join, campaign metadata, asset download, and reconnect flows.
- **WebSocket** for live gameplay events such as movement, HP changes, initiative updates, fog changes, dice rolls, and resource updates.

This is simpler than WebRTC for a DM-hosted tabletop app.

## Suggested runtime structure

```text
DM Desktop App
├─ Electron main process
├─ Embedded local server (Node)
├─ SQLite database / JSON campaign files
├─ Asset folder (maps, portraits, handouts)
└─ React renderer

Player Desktop App
├─ Electron shell or web client
├─ React renderer
└─ WebSocket/HTTP connection to DM host
```

## Core data model changes

Replace direct browser storage with a shared campaign store.

### Campaign

A campaign should contain:

- campaign id and name;
- DM profile;
- player accounts or invite records;
- characters;
- maps;
- map instances and token placements;
- initiative/combat state;
- visibility state;
- handouts/resources;
- audit timestamps and version numbers.

### Users and permissions

Add explicit identities:

- **DM** can edit everything.
- **Player** can only edit allowed fields for assigned characters.
- A player may control one or multiple characters.

Each socket connection should map to a user session and permission set.

### Character ownership

Add ownership fields such as:

- `ownerPlayerId` on characters;
- `controlledBy` on tokens;
- visibility flags for private notes, hidden monsters, and DM-only resources.

That lets players move only their own tokens while still seeing shared public state.

## Persistence strategy

### Files stay on the DM machine

Store all campaign data under an app data directory such as:

```text
Adventurista/
  campaigns/
    <campaign-id>/
      campaign.db
      assets/
        maps/
        portraits/
        handouts/
      backups/
```

### Prefer SQLite + files

Recommended split:

- **SQLite** for structured state: characters, sessions, token positions, initiative, permissions, campaign metadata.
- **Filesystem assets** for large binary files: maps, portraits, handouts.

Why:

- easier backups;
- less fragile than giant JSON blobs;
- avoids embedding base64 images into live state;
- much better than storing large assets in browser local storage.

## Real-time synchronization

### State sync pattern

Model gameplay as event-driven updates.

Examples:

- `character:update`
- `map:token_move`
- `map:token_create`
- `combat:start`
- `combat:advance_turn`
- `fog:reveal`
- `resource:create`
- `dice:roll`

Recommended flow:

1. Client sends an intent.
2. Server validates user permissions and gameplay rules.
3. Server writes the change to storage.
4. Server emits the authoritative update.
5. Clients reconcile local UI state from server events.

### Snapshot + events

On connect or reconnect:

1. player fetches a campaign snapshot over HTTP;
2. player subscribes over WebSocket;
3. server streams live events after the snapshot version.

This makes reconnects and late joins much easier.

## Map control rules

### Token movement

Players should not directly edit token arrays locally.

Instead:

- a player requests movement for a token they control;
- the server validates ownership, turn order, movement limits, collision, and fog rules;
- the server broadcasts the accepted token position.

### Fog of war and hidden information

The DM server should calculate visibility.

Send different payloads to different users when needed:

- DM sees all monsters, fog, and hidden notes.
- Players see only what is visible to their owned or allied tokens.
- Hidden monsters should not be sent at all until revealed.

That is better than sending everything and hiding it in the UI.

## Joining a hosted game

### Connection options

Support two hosting modes:

1. **LAN mode** for players on the same network.
2. **Remote mode** using port forwarding, Tailscale, or a relay service.

For a first version, LAN mode is enough.

### Session join flow

A practical MVP flow:

1. DM starts host.
2. App shows local IP, port, and a short join code.
3. Player enters the code or host address.
4. Player authenticates with a lobby password or invite token.
5. DM approves the player and assigns a character.
6. Player receives snapshot and joins the live session.

## Security and trust model

Because the DM is hosting, full zero-trust security is unnecessary for the first release, but basic protections still matter:

- password or invite token for joining;
- per-player session ids;
- server-side permission checks for every mutation;
- optional TLS only if you later support internet hosting directly;
- sanitized file uploads and file size limits.

## Suggested implementation phases

### Phase 1: Desktop single-player parity

- Wrap the current app in Electron.
- Move storage from `localStorage` to local campaign files.
- Replace base64-heavy map storage with real files on disk.
- Keep the current UI behavior mostly unchanged.

### Phase 2: Host mode

- Add an embedded Node server to the DM app.
- Introduce campaign snapshots and WebSocket events.
- Move map/token/character mutations behind server APIs.

### Phase 3: Player client

- Add login/join screen.
- Add player identity and character assignment.
- Limit editable views to owned characters and allowed token controls.

### Phase 4: Authoritative gameplay rules

- Turn validation.
- Movement validation.
- Fog/visibility computed on the host.
- DM-only and player-only projections.

### Phase 5: Quality improvements

- reconnection support;
- campaign backups;
- import/export;
- optional relay hosting;
- auto-update packaging.

## Concrete technology recommendation

If you keep the current stack, the most direct build is:

- **Desktop shell:** Electron
- **UI:** existing React + TypeScript app
- **Server:** Node + WebSocket (`ws` or Socket.IO)
- **API:** Express or Fastify
- **Database:** SQLite
- **ORM/query layer:** Drizzle ORM or better-sqlite3 with a thin repository layer
- **Validation:** Zod

## What should change first in this repo

Before implementing multiplayer, the most valuable refactor is to separate domain state from browser persistence.

Suggested order:

1. introduce repository interfaces like `CharacterRepository`, `MapRepository`, and `CampaignRepository`;
2. stop reading/writing `localStorage` directly from UI components;
3. centralize mutations into actions/services;
4. define shared event payload types for map, combat, character, and resource updates;
5. add a host adapter backed by local files and sockets.

That refactor will make the later desktop and multiplayer work far easier.

## Recommended MVP

The best MVP is **DM-hosted over LAN with one campaign open at a time**.

Scope:

- DM hosts from desktop app;
- players connect by IP/join code;
- DM stores all files locally;
- players control assigned characters;
- shared tactical map with real-time token movement;
- character sheet edits limited by ownership;
- fog and monster state remain DM-authoritative.

That gets you to a usable tabletop session without overengineering the networking.

## Bottom line

Yes, this can be recreated as a PC app without changing the core user experience.

The key is **not** to think of it as “the same browser app with syncing.” Instead, think of it as:

- a desktop React app for presentation;
- a DM-hosted local server for authority;
- a proper campaign data store on the DM machine;
- WebSocket-driven real-time events for players.

That will give you the same functionality, keep ownership of files with the DM, and support real-time player interaction on shared maps.
