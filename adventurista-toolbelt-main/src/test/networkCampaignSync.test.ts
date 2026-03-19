import { describe, expect, it } from 'vitest';
import { NetworkCampaignClient } from '@/lib/networkCampaignSync';

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
});
