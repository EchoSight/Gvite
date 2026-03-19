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
    const server = new CampaignHostServer({ repository });
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

    const assetResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/assets`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        kind: 'handouts',
        filename: 'rumors.txt',
        mimeType: 'text/plain',
        content: 'Vines move at night.',
        encoding: 'utf8',
      }),
    });
    expect(assetResponse.status).toBe(201);
    const asset = await assetResponse.json();

    const assetFetchResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/assets/${asset.id}`);
    expect(assetFetchResponse.status).toBe(200);
    expect(await assetFetchResponse.text()).toBe('Vines move at night.');

    const eventResponse = await fetch(`http://127.0.0.1:${port}/api/campaigns/camp-1/events`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
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
    const wsMessage = await messagePromise;
    expect(wsMessage).toContain('campaign:event');

    socket.destroy();
  });
});
