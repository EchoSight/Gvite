import type { CampaignEvent, CampaignEventInput } from './campaignEvents';
import type { CampaignSnapshot, StoredAsset } from './campaignState';

export interface HostConnectionOptions {
  baseUrl: string;
  campaignId: string;
  fetchImpl?: typeof fetch;
  webSocketFactory?: (url: string) => WebSocket;
}

export type CampaignEventCallback = (event: CampaignEvent) => void;

export interface LobbyCreateResponse {
  code: string;
  campaignId: string;
  hostUrl: string;
  expiresAt: string;
}

export interface LobbyJoinResponse {
  code: string;
  campaignId: string;
  hostUrl: string;
  sessionId: string;
  playerName: string;
}

function resolveBrowserSafeBaseUrl(baseUrl: string): string {
  const normalized = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;

  if (typeof window === 'undefined') {
    return normalized;
  }

  let parsed: URL;
  try {
    parsed = new URL(normalized);
  } catch {
    return normalized;
  }

  if (parsed.hostname === '0.0.0.0') {
    parsed.hostname = '127.0.0.1';
    return parsed.toString().replace(/\/$/, '');
  }

  return normalized;
}

function normalizeBaseUrl(baseUrl: string): string {
  return resolveBrowserSafeBaseUrl(baseUrl);
}

function getFetchImpl(fetchImpl?: typeof fetch): typeof fetch {
  return (fetchImpl ?? globalThis.fetch).bind(globalThis);
}

function encodeBase64(bytes: Uint8Array): string {
  if (typeof btoa === 'function') {
    let binary = '';
    bytes.forEach(byte => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  }

  return Buffer.from(bytes).toString('base64');
}

function toWebSocketUrl(baseUrl: string, campaignId: string): string {
  const url = new URL(`${normalizeBaseUrl(baseUrl)}/ws`);
  url.protocol = url.protocol === 'https:' ? 'wss:' : 'ws:';
  url.searchParams.set('campaignId', campaignId);
  return url.toString();
}

export class NetworkCampaignClient {
  private readonly fetchImpl: typeof fetch;
  private readonly wsFactory?: (url: string) => WebSocket;
  private socket: WebSocket | null = null;
  private readonly listeners = new Set<CampaignEventCallback>();

  constructor(private readonly options: HostConnectionOptions) {
    this.fetchImpl = getFetchImpl(options.fetchImpl);
    this.wsFactory = options.webSocketFactory;
  }

  getBaseUrl(): string {
    return normalizeBaseUrl(this.options.baseUrl);
  }

  getCampaignId(): string {
    return this.options.campaignId;
  }

  getAssetUrl(assetId: string): string {
    return `${this.getBaseUrl()}/api/campaigns/${this.getCampaignId()}/assets/${assetId}`;
  }

  async fetchSnapshot(): Promise<CampaignSnapshot> {
    const response = await this.fetchImpl(`${normalizeBaseUrl(this.options.baseUrl)}/api/campaigns/${this.options.campaignId}/snapshot`);
    if (!response.ok) {
      throw new Error(`Failed to fetch campaign snapshot: ${response.status}`);
    }

    return response.json();
  }

  async fetchEvents(afterVersion?: number): Promise<CampaignEvent[]> {
    const url = new URL(`${normalizeBaseUrl(this.options.baseUrl)}/api/campaigns/${this.options.campaignId}/events`);
    if (typeof afterVersion === 'number') {
      url.searchParams.set('afterVersion', String(afterVersion));
    }

    const response = await this.fetchImpl(url.toString());
    if (!response.ok) {
      throw new Error(`Failed to fetch events: ${response.status}`);
    }

    return response.json();
  }

  async sendEvent(event: CampaignEventInput): Promise<CampaignEvent> {
    const response = await this.fetchImpl(`${normalizeBaseUrl(this.options.baseUrl)}/api/campaigns/${this.options.campaignId}/events`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify(event),
    });

    if (!response.ok) {
      throw new Error(`Failed to post event: ${response.status}`);
    }

    return response.json();
  }

  async uploadAsset(asset: { kind: StoredAsset['kind']; filename: string; mimeType: string; content: string | Uint8Array }): Promise<StoredAsset> {
    const response = await this.fetchImpl(`${normalizeBaseUrl(this.options.baseUrl)}/api/campaigns/${this.options.campaignId}/assets`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        ...asset,
        content: typeof asset.content === 'string' ? asset.content : encodeBase64(asset.content),
        encoding: typeof asset.content === 'string' ? 'utf8' : 'base64',
      }),
    });

    if (!response.ok) {
      throw new Error(`Failed to upload asset: ${response.status}`);
    }

    return response.json();
  }

  connect(): void {
    if (!this.wsFactory) {
      throw new Error('A webSocketFactory is required to connect to the host transport in this environment.');
    }

    const socket = this.wsFactory(toWebSocketUrl(this.options.baseUrl, this.options.campaignId));
    socket.onmessage = message => {
      if (typeof message.data !== 'string') return;
      const payload = JSON.parse(message.data) as { type: string; event?: CampaignEvent };
      if (payload.type !== 'campaign:event' || !payload.event) return;
      this.listeners.forEach(listener => listener(payload.event!));
    };

    this.socket = socket;
  }

  disconnect(): void {
    this.socket?.close();
    this.socket = null;
  }

  subscribe(listener: CampaignEventCallback): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }
}

export async function createLobbyInvite(baseUrl: string, campaignId: string, options?: {
  hostUrl?: string;
  ttlMinutes?: number;
  fetchImpl?: typeof fetch;
}): Promise<LobbyCreateResponse> {
  const fetcher = getFetchImpl(options?.fetchImpl);
  const response = await fetcher(`${normalizeBaseUrl(baseUrl)}/api/lobbies`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      campaignId,
      hostUrl: options?.hostUrl,
      ttlMinutes: options?.ttlMinutes,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to create lobby invite: ${response.status}`);
  }

  return response.json();
}

export async function joinLobbyInvite(baseUrl: string, code: string, playerName: string, fetchImpl?: typeof fetch): Promise<LobbyJoinResponse> {
  const fetcher = getFetchImpl(fetchImpl);
  const response = await fetcher(`${normalizeBaseUrl(baseUrl)}/api/lobbies/join`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      code,
      playerName,
    }),
  });

  if (!response.ok) {
    throw new Error(`Failed to join lobby invite: ${response.status}`);
  }

  return response.json();
}
