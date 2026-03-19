# Phase 2 Multiplayer Checklist

This checklist focuses on the first usable multiplayer slice: a DM-hosted tactical map session backed by the host transport introduced in Phase 1 scaffolding.

## Goal

Ship a development-ready hosted map workflow where:

- the DM can point the Maps UI at a host URL and campaign id;
- maps uploaded from the UI are stored as host assets;
- hosted snapshots populate the map list and map canvas;
- token/grid/obstacle updates are sent to the host and replayed to connected clients;
- reconnecting clients can recover from the authoritative snapshot/event log.

## Implementation checklist

### Host runtime

- [ ] Add a development host bootstrap command that constructs `SqliteCampaignRepository` + `CampaignHostServer`.
- [ ] Decide the host data root directory for local development and for the future desktop build.
- [ ] Expose the active host address/port in the UI or logs.

### Frontend wiring

- [x] Add persisted multiplayer connection settings (`mode`, `hostUrl`, `campaignId`).
- [x] Add a Maps page connection panel so the DM can switch between local and hosted mode.
- [x] Fetch hosted map collection snapshots from the server.
- [x] Upload map files as host assets before creating hosted map records.
- [x] Refetch map snapshots after live map create/delete events.
- [x] Refetch hosted map state after live per-map events.
- [ ] Promote the hosted connection controls into a global app-level session provider.
- [ ] Reuse the same host session for characters/resources/combat pages.

### Gameplay authority

- [ ] Replace broad `map:tokens_updated` events with narrow movement/update intents.
- [ ] Validate token ownership and allowed actions on the host.
- [ ] Validate movement distance / collision / turn order on the host.
- [ ] Compute fog-of-war visibility on the host.

### Identity and lobby

- [ ] Add a join screen with host address / invite code entry.
- [ ] Add player display names and session ids.
- [ ] Add character assignment to a player session.
- [ ] Restrict edits based on role and ownership.

### Resilience

- [ ] Add reconnect logic that uses `fetchEvents(afterVersion)` before falling back to a full snapshot.
- [ ] Add retry / offline / reconnect indicators in the UI.
- [ ] Add host-side persistence tests for multi-event replay and reconnect.

## Recommended manual test flow

1. Start the DM host.
2. In the Maps page, switch to Hosted mode and save the host URL + campaign id.
3. Upload a map and verify it appears in the host-backed map list.
4. Open the same campaign from a second client.
5. Move tokens / change grid / edit obstacles on client A.
6. Verify client B updates from the host broadcast.
7. Refresh client B and verify the hosted snapshot restores the same map state.
8. Disconnect and reconnect client B and verify it catches up cleanly.

## Automated tests to add next

- two-client hosted map sync test;
- reconnect / replay test using `afterVersion`;
- invalid movement / unauthorized mutation rejection test;
- asset upload + map creation end-to-end browser test.
