import { createHash } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { Socket } from 'node:net';
import { URL } from 'node:url';
import { z } from 'zod';
import type { CampaignRepository } from '@/lib/campaignRepository';
import type { CampaignEventInput } from '@/lib/campaignEvents';

const eventSchema = z.object({
  type: z.string(),
  source: z.enum(['local-ui', 'sync']),
  payload: z.record(z.any()),
});

const assetSchema = z.object({
  kind: z.enum(['maps', 'portraits', 'handouts']),
  filename: z.string().min(1),
  mimeType: z.string().min(1),
  content: z.string(),
  encoding: z.enum(['utf8', 'base64']).default('utf8'),
});

interface HostServerOptions {
  repository: CampaignRepository;
  host?: string;
  port?: number;
  allowedOrigins?: string[];
}

interface WebSocketClient {
  campaignId: string;
  socket: Socket;
}

interface LobbyPlayerSession {
  sessionId: string;
  playerName: string;
  role: 'dm' | 'player';
  joinedAt: string;
}

interface LobbyRecord {
  code: string;
  campaignId: string;
  hostUrl: string;
  createdAt: string;
  expiresAt: string;
  sessions: LobbyPlayerSession[];
}

const lobbyCreateSchema = z.object({
  campaignId: z.string().min(1),
  hostUrl: z.string().url().optional(),
  ttlMinutes: z.number().int().min(1).max(24 * 60).optional(),
});

const lobbyJoinSchema = z.object({
  code: z.string().min(4).max(12),
  playerName: z.string().min(1).max(80),
  role: z.enum(['dm', 'player']).default('player'),
});

const tokenMoveIntentSchema = z.object({
  mapId: z.string().min(1),
  tokenId: z.string().min(1),
  x: z.number().finite(),
  y: z.number().finite(),
});

const LOBBY_CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const DEFAULT_LOBBY_TTL_MINUTES = 240;
const DM_ONLY_EVENT_TYPES = new Set([
  'role:set',
  'resource:created',
  'resource:deleted',
  'map:created',
  'map:deleted',
  'map:obstacles_updated',
  'map:spell_templates_updated',
]);

function buildCorsHeaders(origin: string | undefined, allowedOrigins: string[]): Record<string, string> {
  const hasWildcard = allowedOrigins.includes('*');
  if (!origin) {
    return hasWildcard ? { 'access-control-allow-origin': '*' } : {};
  }

  if (hasWildcard || allowedOrigins.includes(origin)) {
    return {
      'access-control-allow-origin': hasWildcard ? '*' : origin,
      vary: 'Origin',
    };
  }

  return {};
}

function textResponse(
  res: ServerResponse,
  status: number,
  body: string,
  contentType = 'text/plain',
  corsHeaders: Record<string, string> = {},
): void {
  res.writeHead(status, { 'content-type': contentType, ...corsHeaders });
  res.end(body);
}

async function readJsonBody(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  if (!chunks.length) return null;
  return JSON.parse(Buffer.concat(chunks).toString('utf8'));
}

function encodeTextFrame(message: string): Buffer {
  const payload = Buffer.from(message, 'utf8');
  const length = payload.length;

  if (length < 126) {
    return Buffer.concat([Buffer.from([0x81, length]), payload]);
  }

  if (length < 65536) {
    const header = Buffer.alloc(4);
    header[0] = 0x81;
    header[1] = 126;
    header.writeUInt16BE(length, 2);
    return Buffer.concat([header, payload]);
  }

  const header = Buffer.alloc(10);
  header[0] = 0x81;
  header[1] = 127;
  header.writeBigUInt64BE(BigInt(length), 2);
  return Buffer.concat([header, payload]);
}

function decodeFrame(buffer: Buffer): string | null {
  if (buffer.length < 2) return null;
  const secondByte = buffer[1];
  const masked = (secondByte & 0x80) === 0x80;
  let offset = 2;
  let length = secondByte & 0x7f;

  if (length === 126) {
    if (buffer.length < 4) return null;
    length = buffer.readUInt16BE(2);
    offset = 4;
  } else if (length === 127) {
    if (buffer.length < 10) return null;
    length = Number(buffer.readBigUInt64BE(2));
    offset = 10;
  }

  let maskingKey: Buffer | null = null;
  if (masked) {
    maskingKey = buffer.subarray(offset, offset + 4);
    offset += 4;
  }

  const payload = buffer.subarray(offset, offset + length);
  if (masked && maskingKey) {
    for (let index = 0; index < payload.length; index += 1) {
      payload[index] ^= maskingKey[index % 4];
    }
  }

  return payload.toString('utf8');
}

export class CampaignHostServer {
  private readonly server = createServer(this.handleRequest.bind(this));
  private readonly clients = new Set<WebSocketClient>();
  private readonly allowedOrigins: string[];
  private readonly lobbies = new Map<string, LobbyRecord>();
  private readonly sessionToCampaign = new Map<string, { campaignId: string; role: 'dm' | 'player' }>();

  constructor(private readonly options: HostServerOptions) {
    this.allowedOrigins = options.allowedOrigins && options.allowedOrigins.length > 0 ? options.allowedOrigins : ['*'];
    this.server.on('upgrade', this.handleUpgrade.bind(this));
  }

  async listen(): Promise<{ host: string; port: number }> {
    const host = this.options.host ?? '127.0.0.1';
    const port = this.options.port ?? 0;

    await new Promise<void>((resolve, reject) => {
      this.server.once('error', reject);
      this.server.listen(port, host, () => {
        this.server.off('error', reject);
        resolve();
      });
    });

    const address = this.server.address();
    if (!address || typeof address === 'string') {
      throw new Error('Unable to determine host server address.');
    }

    return { host: address.address, port: address.port };
  }

  async close(): Promise<void> {
    this.clients.forEach(client => client.socket.destroy());
    await new Promise<void>((resolve, reject) => {
      this.server.close(error => error ? reject(error) : resolve());
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const method = request.method ?? 'GET';
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    const corsHeaders = buildCorsHeaders(request.headers.origin, this.allowedOrigins);
    const campaignMatch = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(snapshot|events|assets))?(?:\/([^/]+))?$/);
    const lobbyMatch = url.pathname.match(/^\/api\/lobbies(?:\/([A-Za-z0-9]+))?$/);

    if (method === 'OPTIONS') {
      response.writeHead(204, {
        ...corsHeaders,
        'access-control-allow-methods': 'GET,POST,OPTIONS',
        'access-control-allow-headers': 'content-type',
        'access-control-max-age': '86400',
      });
      response.end();
      return;
    }

    if (url.pathname === '/health') {
      textResponse(response, 200, JSON.stringify({ ok: true }), 'application/json', corsHeaders);
      return;
    }

    if (lobbyMatch) {
      this.pruneExpiredLobbies();
      await this.handleLobbyRequest(method, request, response, lobbyMatch[1], corsHeaders);
      return;
    }

    if (!campaignMatch) {
      textResponse(response, 404, 'Not found', 'text/plain', corsHeaders);
      return;
    }

    const [, campaignId, resource, resourceId] = campaignMatch;

    try {
      if (method === 'GET' && resource === 'snapshot') {
        textResponse(response, 200, JSON.stringify(this.options.repository.getSnapshot(campaignId)), 'application/json', corsHeaders);
        return;
      }

      if (method === 'GET' && resource === 'events') {
        const afterVersion = Number(url.searchParams.get('afterVersion') ?? '0');
        textResponse(response, 200, JSON.stringify(this.options.repository.getEvents(campaignId, Number.isFinite(afterVersion) ? afterVersion : 0)), 'application/json', corsHeaders);
        return;
      }

      if (method === 'POST' && resource === 'events') {
        const body = await readJsonBody(request);
        const parsedEvent = eventSchema.parse(body) as CampaignEventInput;
        const sessionId = request.headers['x-session-id'];
        const sessionAuth = this.validateEventSession(campaignId, sessionId);
        if (!sessionAuth.ok) {
          textResponse(response, sessionAuth.status, JSON.stringify({ error: sessionAuth.error }), 'application/json', corsHeaders);
          return;
        }
        if (sessionAuth.role === 'player' && DM_ONLY_EVENT_TYPES.has(parsedEvent.type)) {
          textResponse(response, 403, JSON.stringify({ error: `Event type "${parsedEvent.type}" requires a DM session.` }), 'application/json', corsHeaders);
          return;
        }
        const authzError = this.authorizePlayerEvent(campaignId, sessionAuth.role, typeof sessionId === 'string' ? sessionId : '', parsedEvent);
        if (authzError) {
          textResponse(response, authzError.status, JSON.stringify({ error: authzError.error }), 'application/json', corsHeaders);
          return;
        }

        const event = this.options.repository.appendEvent(campaignId, parsedEvent);
        this.broadcast(campaignId, JSON.stringify({ type: 'campaign:event', event }));
        textResponse(response, 201, JSON.stringify(event), 'application/json', corsHeaders);
        return;
      }

      if (method === 'POST' && resource === 'assets') {
        const body = assetSchema.parse(await readJsonBody(request));
        const content = body.encoding === 'base64' ? Buffer.from(body.content, 'base64') : body.content;
        const asset = this.options.repository.storeAsset(campaignId, {
          kind: body.kind,
          filename: body.filename,
          mimeType: body.mimeType,
          content,
        });
        textResponse(response, 201, JSON.stringify(asset), 'application/json', corsHeaders);
        return;
      }

      if (method === 'GET' && resource === 'assets' && resourceId) {
        const storedAsset = this.options.repository.readAssetContent(campaignId, resourceId);
        if (!storedAsset) {
          textResponse(response, 404, 'Asset not found', 'text/plain', corsHeaders);
          return;
        }

        response.writeHead(200, { 'content-type': storedAsset.asset.mimeType, ...corsHeaders });
        response.end(storedAsset.content);
        return;
      }

      textResponse(response, 405, 'Method not allowed', 'text/plain', corsHeaders);
    } catch (error) {
      textResponse(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 'application/json', corsHeaders);
    }
  }

  private async handleLobbyRequest(
    method: string,
    request: IncomingMessage,
    response: ServerResponse,
    lobbyCode: string | undefined,
    corsHeaders: Record<string, string>,
  ): Promise<void> {
    try {
      if (method === 'POST' && !lobbyCode) {
        const body = lobbyCreateSchema.parse(await readJsonBody(request));
        const campaignId = body.campaignId.trim();
        const lobby = this.createLobby({
          campaignId,
          hostUrl: body.hostUrl ? body.hostUrl.trim() : this.getDefaultHostUrl(request),
          ttlMinutes: body.ttlMinutes ?? DEFAULT_LOBBY_TTL_MINUTES,
        });
        const dmSession = this.createSession(lobby, 'Dungeon Master', 'dm');
        textResponse(response, 201, JSON.stringify({
          code: lobby.code,
          campaignId: lobby.campaignId,
          hostUrl: lobby.hostUrl,
          expiresAt: lobby.expiresAt,
          hostSessionId: dmSession.sessionId,
        }), 'application/json', corsHeaders);
        return;
      }

      if (method === 'POST' && lobbyCode?.toUpperCase() === 'JOIN') {
        const body = lobbyJoinSchema.parse(await readJsonBody(request));
        const joined = this.joinLobby(body.code.toUpperCase(), body.playerName.trim(), body.role);
        if (!joined) {
          textResponse(response, 404, JSON.stringify({ error: 'Lobby not found or expired.' }), 'application/json', corsHeaders);
          return;
        }

        textResponse(response, 200, JSON.stringify(joined), 'application/json', corsHeaders);
        return;
      }

      if (method === 'GET' && lobbyCode) {
        const lobby = this.lobbies.get(lobbyCode.toUpperCase());
        if (!lobby) {
          textResponse(response, 404, JSON.stringify({ error: 'Lobby not found or expired.' }), 'application/json', corsHeaders);
          return;
        }

        textResponse(response, 200, JSON.stringify({
          code: lobby.code,
          campaignId: lobby.campaignId,
          hostUrl: lobby.hostUrl,
          createdAt: lobby.createdAt,
          expiresAt: lobby.expiresAt,
          players: lobby.sessions.map(session => ({
            sessionId: session.sessionId,
            playerName: session.playerName,
            role: session.role,
            joinedAt: session.joinedAt,
          })),
        }), 'application/json', corsHeaders);
        return;
      }

      textResponse(response, 405, 'Method not allowed', 'text/plain', corsHeaders);
    } catch (error) {
      textResponse(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 'application/json', corsHeaders);
    }
  }

  private createLobby(options: { campaignId: string; hostUrl: string; ttlMinutes: number }): LobbyRecord {
    const now = Date.now();
    const expiresAt = new Date(now + (options.ttlMinutes * 60_000)).toISOString();
    const code = this.generateUniqueLobbyCode();
    const lobby: LobbyRecord = {
      code,
      campaignId: options.campaignId,
      hostUrl: options.hostUrl,
      createdAt: new Date(now).toISOString(),
      expiresAt,
      sessions: [],
    };
    this.lobbies.set(code, lobby);
    return lobby;
  }

  private joinLobby(code: string, playerName: string, role: 'dm' | 'player'): { code: string; campaignId: string; hostUrl: string; sessionId: string; playerName: string; role: 'dm' | 'player' } | null {
    const lobby = this.lobbies.get(code);
    if (!lobby) return null;
    if (new Date(lobby.expiresAt).getTime() <= Date.now()) {
      this.lobbies.delete(code);
      return null;
    }

    const session = this.createSession(lobby, playerName, role);

    this.broadcast(lobby.campaignId, JSON.stringify({
      type: 'lobby:player_joined',
      lobbyCode: lobby.code,
      playerName,
      sessionId: session.sessionId,
    }));

    return {
      code: lobby.code,
      campaignId: lobby.campaignId,
      hostUrl: lobby.hostUrl,
      sessionId: session.sessionId,
      playerName,
      role: session.role,
    };
  }

  private createSession(lobby: LobbyRecord, playerName: string, role: 'dm' | 'player'): LobbyPlayerSession {
    const sessionId = `sess-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const session: LobbyPlayerSession = {
      sessionId,
      playerName,
      role,
      joinedAt: new Date().toISOString(),
    };
    lobby.sessions.push(session);
    this.sessionToCampaign.set(sessionId, { campaignId: lobby.campaignId, role });
    return session;
  }

  private generateUniqueLobbyCode(): string {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const candidate = this.generateLobbyCode();
      if (!this.lobbies.has(candidate)) {
        return candidate;
      }
    }

    throw new Error('Unable to generate a unique lobby code. Please retry.');
  }

  private generateLobbyCode(length = 4): string {
    let code = '';
    for (let index = 0; index < length; index += 1) {
      const charIndex = Math.floor(Math.random() * LOBBY_CODE_ALPHABET.length);
      code += LOBBY_CODE_ALPHABET[charIndex];
    }
    return code;
  }

  private pruneExpiredLobbies(): void {
    const now = Date.now();
    this.lobbies.forEach((lobby, code) => {
      if (new Date(lobby.expiresAt).getTime() <= now) {
        lobby.sessions.forEach(session => this.sessionToCampaign.delete(session.sessionId));
        this.lobbies.delete(code);
      }
    });
  }

  private validateEventSession(
    campaignId: string,
    sessionIdHeader: string | string[] | undefined,
  ): { ok: true; role: 'dm' | 'player' | 'local' } | { ok: false; status: number; error: string } {
    const hasSessionBoundCampaign = [...this.sessionToCampaign.values()].some(session => session.campaignId === campaignId);
    const normalizedSessionId = typeof sessionIdHeader === 'string' ? sessionIdHeader.trim() : '';

    if (!normalizedSessionId) {
      if (hasSessionBoundCampaign) {
        return { ok: false, status: 401, error: 'Missing x-session-id header for hosted campaign mutation.' };
      }
      return { ok: true, role: 'local' };
    }

    const session = this.sessionToCampaign.get(normalizedSessionId);
    if (!session || session.campaignId !== campaignId) {
      return { ok: false, status: 403, error: 'Invalid session for campaign mutation.' };
    }

    return { ok: true, role: session.role };
  }

  private authorizePlayerEvent(
    campaignId: string,
    role: 'dm' | 'player' | 'local',
    sessionId: string,
    event: CampaignEventInput,
  ): { status: number; error: string } | null {
    if (role !== 'player') return null;

    if (event.type === 'map:tokens_updated') {
      return { status: 403, error: 'Players must use map:token_move_intent instead of broad map:tokens_updated mutations.' };
    }

    if (event.type !== 'map:token_move_intent') {
      return null;
    }

    const intent = tokenMoveIntentSchema.parse(event.payload);
    const snapshot = this.options.repository.getSnapshot(campaignId);
    const token = snapshot.mapStates[intent.mapId]?.tokens.find(candidate => candidate.id === intent.tokenId);
    if (!token) {
      return { status: 404, error: `Token "${intent.tokenId}" was not found on map "${intent.mapId}".` };
    }

    if (token.type !== 'character') {
      return { status: 403, error: 'Players can only move character tokens they control.' };
    }

    if (!token.ownerPlayerId || token.ownerPlayerId !== sessionId) {
      return { status: 403, error: 'Players can only move character tokens they control.' };
    }

    return null;
  }

  private getDefaultHostUrl(request: IncomingMessage): string {
    const host = request.headers.host ?? '127.0.0.1:8787';
    const forwardedProto = request.headers['x-forwarded-proto'];
    const protocol = typeof forwardedProto === 'string' && forwardedProto.length > 0
      ? forwardedProto.split(',')[0].trim()
      : 'http';
    return `${protocol}://${host}`;
  }

  private handleUpgrade(request: IncomingMessage, socket: Socket): void {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);
    if (url.pathname !== '/ws') {
      socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
      socket.destroy();
      return;
    }

    const websocketKey = request.headers['sec-websocket-key'];
    const campaignId = url.searchParams.get('campaignId');
    if (!websocketKey || !campaignId) {
      socket.write('HTTP/1.1 400 Bad Request\r\n\r\n');
      socket.destroy();
      return;
    }

    const acceptKey = createHash('sha1')
      .update(`${websocketKey}258EAFA5-E914-47DA-95CA-C5AB0DC85B11`)
      .digest('base64');

    socket.write([
      'HTTP/1.1 101 Switching Protocols',
      'Upgrade: websocket',
      'Connection: Upgrade',
      `Sec-WebSocket-Accept: ${acceptKey}`,
      '',
      '',
    ].join('\r\n'));

    const client: WebSocketClient = { campaignId, socket };
    this.clients.add(client);

    socket.on('data', buffer => {
      const message = decodeFrame(buffer);
      if (message === 'ping') {
        socket.write(encodeTextFrame('pong'));
      }
    });
    socket.on('close', () => this.clients.delete(client));
    socket.on('end', () => this.clients.delete(client));
    socket.on('error', () => this.clients.delete(client));
  }

  private broadcast(campaignId: string, message: string): void {
    const frame = encodeTextFrame(message);
    this.clients.forEach(client => {
      if (client.campaignId !== campaignId) return;
      client.socket.write(frame);
    });
  }
}
