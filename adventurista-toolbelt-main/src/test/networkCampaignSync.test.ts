import { describe, expect, it } from 'vitest';
import { createLobbyInvite, getLobbyInviteStatus, joinLobbyInvite, NetworkCampaignClient } from '@/lib/networkCampaignSync';

describe('NetworkCampaignClient', () => {
  it('binds fetch implementations so hosted browser fetch calls do not throw illegal invocation', async () => {
    const originalFetch = globalThis.fetch;

    globalThis.fetch = (async function stubbedFetch(this: typeof globalThis, input: RequestInfo | URL) {
      if (this !== globalThis) {
        throw new TypeError('Illegal invocation');
      }

      expect(String(input)).toBe('https://host.example/api/campaigns/camp-1/snapshot');
      return new Response(
        JSON.stringify({
          campaign: {
            id: 'camp-1',
            name: 'The Vale',
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z',
            version: 1,
          },
          characters: [],
          resources: [],
          maps: [],
          mapStates: {},
          events: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const client = new NetworkCampaignClient({
        baseUrl: 'https://host.example',
        campaignId: 'camp-1',
      });

      await expect(client.fetchSnapshot()).resolves.toMatchObject({
        campaign: expect.objectContaining({ id: 'camp-1', version: 1 }),
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('rewrites 0.0.0.0 to 127.0.0.1 for browser-hosted requests on the same device', async () => {
    const originalWindow = globalThis.window;
    const originalFetch = globalThis.fetch;

    Object.defineProperty(globalThis, 'window', {
      configurable: true,
      value: { location: { hostname: 'echosight.github.io' } },
    });

    globalThis.fetch = (async function stubbedFetch(input: RequestInfo | URL) {
      expect(String(input)).toBe('http://127.0.0.1:8787/api/campaigns/camp-1/snapshot');
      return new Response(
        JSON.stringify({
          campaign: {
            id: 'camp-1',
            name: 'The Vale',
            createdAt: '2026-03-19T00:00:00.000Z',
            updatedAt: '2026-03-19T00:00:00.000Z',
            version: 1,
          },
          characters: [],
          resources: [],
          maps: [],
          mapStates: {},
          events: [],
        }),
        {
          status: 200,
          headers: { 'content-type': 'application/json' },
        },
      );
    }) as typeof fetch;

    try {
      const client = new NetworkCampaignClient({
        baseUrl: 'http://0.0.0.0:8787',
        campaignId: 'camp-1',
      });

      expect(client.getBaseUrl()).toBe('http://127.0.0.1:8787');
      await expect(client.fetchSnapshot()).resolves.toMatchObject({
        campaign: expect.objectContaining({ id: 'camp-1', version: 1 }),
      });
    } finally {
      if (originalWindow === undefined) {
        // @ts-expect-error test cleanup for optional global
        delete globalThis.window;
      } else {
        Object.defineProperty(globalThis, 'window', {
          configurable: true,
          value: originalWindow,
        });
      }
      globalThis.fetch = originalFetch;
    }
  });

  it('creates and joins room-code lobbies via helper functions', async () => {
    const originalFetch = globalThis.fetch;
    const calls: Array<{ url: string; method: string }> = [];

    globalThis.fetch = (async function stubbedFetch(input: RequestInfo | URL, init?: RequestInit) {
      const url = String(input);
      calls.push({ url, method: init?.method ?? 'GET' });

      if (url.endsWith('/api/lobbies')) {
        return new Response(
          JSON.stringify({
            code: 'ABCD',
            campaignId: 'camp-2',
            hostUrl: 'https://host.example',
            expiresAt: '2026-03-28T12:00:00.000Z',
          }),
          { status: 201, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/lobbies/join')) {
        return new Response(
          JSON.stringify({
            code: 'ABCD',
            campaignId: 'camp-2',
            hostUrl: 'https://host.example',
            sessionId: 'sess-123',
            playerName: 'Aria',
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      if (url.endsWith('/api/lobbies/ABCD')) {
        return new Response(
          JSON.stringify({
            code: 'ABCD',
            campaignId: 'camp-2',
            hostUrl: 'https://host.example',
            createdAt: '2026-03-28T11:00:00.000Z',
            expiresAt: '2026-03-28T12:00:00.000Z',
            players: [{ sessionId: 'sess-123', playerName: 'Aria', joinedAt: '2026-03-28T11:30:00.000Z' }],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        );
      }

      return new Response('Not found', { status: 404 });
    }) as typeof fetch;

    try {
      await expect(createLobbyInvite('https://host.example', 'camp-2')).resolves.toMatchObject({
        code: 'ABCD',
        campaignId: 'camp-2',
      });
      await expect(joinLobbyInvite('https://host.example', 'ABCD', 'Aria')).resolves.toMatchObject({
        sessionId: 'sess-123',
        playerName: 'Aria',
      });
      await expect(getLobbyInviteStatus('https://host.example', 'ABCD')).resolves.toMatchObject({
        code: 'ABCD',
        players: [expect.objectContaining({ playerName: 'Aria' })],
      });
      expect(calls).toEqual([
        { url: 'https://host.example/api/lobbies', method: 'POST' },
        { url: 'https://host.example/api/lobbies/join', method: 'POST' },
        { url: 'https://host.example/api/lobbies/ABCD', method: 'GET' },
      ]);
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('surfaces lobby join websocket messages to generic subscribers', () => {
    const fakeSocket = { onmessage: null as ((event: MessageEvent) => void) | null, close: () => {} };
    const client = new NetworkCampaignClient({
      baseUrl: 'https://host.example',
      campaignId: 'camp-2',
      webSocketFactory: () => fakeSocket as unknown as WebSocket,
    });

    const messages: string[] = [];
    client.subscribeMessages(message => {
      if (message.type === 'lobby:player_joined') {
        messages.push(message.playerName);
      }
    });

    client.connect();
    fakeSocket.onmessage?.({
      data: JSON.stringify({ type: 'lobby:player_joined', lobbyCode: 'ABCD', playerName: 'Aria', sessionId: 'sess-123' }),
    } as MessageEvent);

    expect(messages).toEqual(['Aria']);
    client.disconnect();
  });

});
