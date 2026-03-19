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
}

interface WebSocketClient {
  campaignId: string;
  socket: Socket;
}

function textResponse(res: ServerResponse, status: number, body: string, contentType = 'text/plain'): void {
  res.writeHead(status, { 'content-type': contentType });
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

  constructor(private readonly options: HostServerOptions) {
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
    const campaignMatch = url.pathname.match(/^\/api\/campaigns\/([^/]+)(?:\/(snapshot|events|assets))?(?:\/([^/]+))?$/);

    if (url.pathname === '/health') {
      textResponse(response, 200, JSON.stringify({ ok: true }), 'application/json');
      return;
    }

    if (!campaignMatch) {
      textResponse(response, 404, 'Not found');
      return;
    }

    const [, campaignId, resource, resourceId] = campaignMatch;

    try {
      if (method === 'GET' && resource === 'snapshot') {
        textResponse(response, 200, JSON.stringify(this.options.repository.getSnapshot(campaignId)), 'application/json');
        return;
      }

      if (method === 'GET' && resource === 'events') {
        const afterVersion = Number(url.searchParams.get('afterVersion') ?? '0');
        textResponse(response, 200, JSON.stringify(this.options.repository.getEvents(campaignId, Number.isFinite(afterVersion) ? afterVersion : 0)), 'application/json');
        return;
      }

      if (method === 'POST' && resource === 'events') {
        const body = await readJsonBody(request);
        const event = this.options.repository.appendEvent(campaignId, eventSchema.parse(body) as CampaignEventInput);
        this.broadcast(campaignId, JSON.stringify({ type: 'campaign:event', event }));
        textResponse(response, 201, JSON.stringify(event), 'application/json');
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
        textResponse(response, 201, JSON.stringify(asset), 'application/json');
        return;
      }

      if (method === 'GET' && resource === 'assets' && resourceId) {
        const storedAsset = this.options.repository.readAssetContent(campaignId, resourceId);
        if (!storedAsset) {
          textResponse(response, 404, 'Asset not found');
          return;
        }

        response.writeHead(200, { 'content-type': storedAsset.asset.mimeType });
        response.end(storedAsset.content);
        return;
      }

      textResponse(response, 405, 'Method not allowed');
    } catch (error) {
      textResponse(response, 400, JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }), 'application/json');
    }
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
