# Jackbox-style Website + Code Plan

## Objective

Make multiplayer feel like Jackbox:

- one host (DM) runs the game session;
- players join quickly from a browser using a short room code;
- host view and controller view stay synchronized in real time.

## Existing foundation in this repo

- Host-authoritative multiplayer architecture is already the target.
- HTTP + WebSocket sync boundaries are already present.
- Hosted mode settings already exist in the Maps UI and URL query-string overrides.

## Delivery plan

### Phase 1 (implemented in this change): room-code lobby bootstrap

1. Add lobby endpoints on the host server:
   - `POST /api/lobbies` creates a short join code for a campaign.
   - `POST /api/lobbies/join` resolves a room code + player name into a session.
   - `GET /api/lobbies/:code` reads lobby status for host diagnostics.
2. Keep lobby state in-memory with a TTL.
3. Broadcast `lobby:player_joined` over campaign WebSocket to support future host lobby UI.
4. Add browser-side helper functions:
   - `createLobbyInvite(...)`
   - `joinLobbyInvite(...)`

### Phase 2: host lobby UX

1. Add a host-side "Create Join Code" control.
2. Show QR code + short code in host view.
3. Render live player list driven by `lobby:player_joined`.

### Phase 3: controller join route

1. Add `/join` route for mobile-friendly player flow.
2. Submit code + display name.
3. Persist returned `sessionId`, `campaignId`, and `hostUrl` into multiplayer settings.

### Phase 4: permissioning hardening

1. Attach session token/id to event POSTs.
2. Validate ownership and role server-side per mutation.
3. Reject unauthorized intents and return structured errors.

### Phase 5: production polish

1. Add heartbeat/reconnect UX for mobile.
2. Add rate limits for join attempts.
3. Add optional persisted lobby storage if horizontal scaling is required.

## Notes

- This change intentionally keeps behavior backward compatible with direct host URL + campaign ID entry.
- Room-code lobby is additive and can be rolled out in UI incrementally.
