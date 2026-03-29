/** @vitest-environment node */
import { createHash } from 'node:crypto';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Socket } from 'node:net';
import { afterEach, describe, expect, it } from 'vitest';
import { CampaignHostServer } from '@/server/campaignHostServer';
import { SqliteCampaignRepository } from '@/server/sqliteCampaignRepository';

function decodeServerTextFrame(frame: Buffer): string {
  const length = frame[1] & 0x7f;
  const offset = length === 126 ? 4 : 2;
  return frame.subarray(offset, offset + length).toString('utf8');
}

describe('CampaignHostServer', () => {
  const servers: CampaignHostServer[] = [];

  afterEach(async () => {
    await Promise.all(servers.splice(0).map(server => server.close()));
  });

  it('serves snapshots, accepts events, and broadcasts websocket updates', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'adventurista-host-'));
    const repository = new SqliteCampaignRepository({ rootDir });
    const server = new CampaignHostServer({ repository, allowedOrigins: ['https://echosight.github.io'] });
    servers.push(server);

    const { port } = await server.listen();
    repository.ensureCampaign({ id: 'camp-1', name: 'The Vale' });

    const wsKey = Buffer.from('test-websocket-key').toString('base64');
    const socket = new Socket();
    const messagePromise = new Promise<string>((resolve, reject) => {
      let stage: 'handshake' | 'message' = 'handshake';
      socket.on('data', chunk => {
        if (stage === 'handshake') {
          stage = 'message';
          return;
        }
        resolve(decodeServerTextFrame(chunk));
      });
      socket.on('error', reject);
    });

    await new Promise<void>((resolve, reject) => {
      socket.connect(port, '127.0.0.1', () => {
        const expectedAccept = createHash('sha1')
          .update(`${wsKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
          .digest('base64');
        socket.write([
          'GET /ws?campaignId=camp-1 HTTP/1.1',
          'Host: 127.0.0.1',
          'Upgrade: websocket',
          'Connection: Upgrade',
          `Sec-WebSocket-Key: ${wsKey}`,
          'Sec-WebSocket-Version: 13',
          '',
          '',
        ].join('\r\n'));
        expect(expectedAccept).toBeTruthy();
        resolve();
      });
      socket.on('error', reject);
    });

    const snapshotResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/snapshot`);
    expect(snapshotResponse.status).toBe(200);

    const preflightResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/events`, {
      method: 'OPTIONS',
      headers: {
        origin: 'https://echosight.github.io',
        'access-control-request-method': 'POST',
        'access-control-request-headers': 'content-type',
      },
    });
    expect(preflightResponse.status).toBe(204);
    expect(preflightResponse.headers.get('access-control-allow-origin')).toBe('https://echosight.github.io');


    const assetResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/assets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://echosight.github.io' },
      body: JSON.stringify({
        kind: 'handouts',
        filename: 'rumors.txt',
        mimeType: 'text/plain',
        content: 'Vines move at night.',
        encoding: 'utf8',
      }),
    });
    expect(assetResponse.status).toBe(201);
    expect(assetResponse.headers.get('access-control-allow-origin')).toBe('https://echosight.github.io');
    const asset = await assetResponse.json();

    const assetFetchResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/assets/${asset.id}`, {
      headers: { origin: 'https://echosight.github.io' },
    });
    expect(assetFetchResponse.status).toBe(200);
    expect(await assetFetchResponse.text()).toBe('Vines move at night.');

    const eventResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', origin: 'https://echosight.github.io' },
      body: JSON.stringify({
        type: 'resource:created',
        source: 'local-ui',
        payload: {
          resource: {
            id: 'res-1',
            title: 'Lore',
            description: 'Village rumors',
            tags: ['lore'],
            type: 'lore',
            content: 'The well glows at dusk.',
            createdAt: '2026-03-19T00:00:00.000Z',
          },
        },
      }),
    });

    expect(eventResponse.status).toBe(201);
    expect(eventResponse.headers.get('access-control-allow-origin')).toBe('https://echosight.github.io');
    const wsMessage = await messagePromise;
    expect(wsMessage).toContain('campaign:event');

    socket.destroy();
  });

  it('creates and joins room-code lobbies for jackbox-style player entry', async () => {
    const rootDir = mkdtempSync(join(tmpdir(), 'adventurista-host-'));
    const repository = new SqliteCampaignRepository({ rootDir });
    const server = new CampaignHostServer({ repository });
    servers.push(server);

    const { port } = await server.listen();
    repository.ensureCampaign({ id: 'camp-jackbox', name: 'Arcane Night' });

    const createResponse = await fetch(`http://127.0.0.1:${port}/api/lobbies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        campaignId: 'camp-jackbox',
        hostUrl: `http://127.0.0.1:${port}`,
        ttlMinutes: 30,
      }),
    });

    expect(createResponse.status).toBe(201);
    const createdLobby = await createResponse.json();
    expect(createdLobby).toMatchObject({
      campaignId: 'camp-jackbox',
      hostUrl: `http://127.0.0.1:${port}`,
    });
    expect(createdLobby.code).toMatch(/^[A-Z0-9]{4}$/);
    expect(createdLobby.hostSessionId).toMatch(/^sess-/);

    const joinResponse = await fetch(`http://127.0.0.1:${port}/api/lobbies/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        code: createdLobby.code,
        playerName: 'Aria',
      }),
    });

    expect(joinResponse.status).toBe(200);
    const joinedLobby = await joinResponse.json();
    expect(joinedLobby).toMatchObject({
      code: createdLobby.code,
      campaignId: 'camp-jackbox',
      hostUrl: `http://127.0.0.1:${port}`,
      playerName: 'Aria',
      role: 'player',
    });
    expect(joinedLobby.sessionId).toMatch(/^sess-/);

    const inspectResponse = await fetch(`http://127.0.0.1:${port}/api/lobbies/${createdLobby.code}`);
    expect(inspectResponse.status).toBe(200);
    const inspectedLobby = await inspectResponse.json();
    expect(inspectedLobby.players).toEqual([
      expect.objectContaining({
        role: 'dm',
      }),
      expect.objectContaining({
        playerName: 'Aria',
        sessionId: joinedLobby.sessionId,
        role: 'player',
      }),
    ]);

    const unauthorizedEvent = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-jackbox/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        type: 'resource:created',
        source: 'local-ui',
        payload: { resource: { id: 'res-2' } },
      }),
    });
    expect(unauthorizedEvent.status).toBe(401);

    const playerForbiddenEvent = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-jackbox/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': joinedLobby.sessionId },
      body: JSON.stringify({
        type: 'resource:created',
        source: 'local-ui',
        payload: { resource: { id: 'res-3' } },
      }),
    });
    expect(playerForbiddenEvent.status).toBe(403);

    const dmAllowedEvent = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-jackbox/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-session-id': createdLobby.hostSessionId },
      body: JSON.stringify({
        type: 'resource:created',
        source: 'local-ui',
        payload: { resource: { id: 'res-4' } },
      }),
    });
    expect(dmAllowedEvent.status).toBe(201);
  });
});
