/**
 * Bridge server: WebSocket + HTTP static file serving.
 *
 * - WebSocket (ws://localhost:9800): sends commands to Phidias frontend
 * - HTTP (http://localhost:9800/files/*): serves generated assets for browser fetch
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { WebSocketServer, WebSocket } from 'ws';
import { getOutputDir } from './phidias-client.js';

const BRIDGE_PORT = 9800;

let wss: WebSocketServer | null = null;
let httpServer: http.Server | null = null;
let frontendSocket: WebSocket | null = null;

// Pending request callbacks for request-response patterns (e.g., screenshot)
const pendingRequests = new Map<string, {
  resolve: (data: unknown) => void;
  reject: (err: Error) => void;
  timer: ReturnType<typeof setTimeout>;
}>();

/**
 * MIME type lookup for static file serving.
 */
function getMimeType(ext: string): string {
  const mimeTypes: Record<string, string> = {
    '.html': 'text/html',
    '.js': 'application/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.glb': 'model/gltf-binary',
    '.gltf': 'model/gltf+json',
    '.usdz': 'model/vnd.usdz+zip',
  };
  return mimeTypes[ext] || 'application/octet-stream';
}

/**
 * Start the bridge server (HTTP + WebSocket on the same port).
 */
export function startBridge(): void {
  const outputDir = getOutputDir();

  httpServer = http.createServer((req, res) => {
    // CORS headers for browser access
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    // Health check
    if (req.url === '/health') {
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        status: 'ok',
        connected: frontendSocket !== null && frontendSocket.readyState === WebSocket.OPEN,
      }));
      return;
    }

    // Static file serving: /files/<filename>
    if (req.url?.startsWith('/files/')) {
      const token = process.env.MCP_HTTP_TOKEN;
      if (token) {
        const auth = req.headers.authorization;
        if (auth !== `Bearer ${token}`) {
          res.writeHead(401, { 'Content-Type': 'application/json' });
          res.end(JSON.stringify({ error: 'Unauthorized: missing or invalid bearer token' }));
          return;
        }
      }

      let fileName: string;
      try {
        fileName = decodeURIComponent(req.url.slice('/files/'.length));
      } catch {
        res.writeHead(400, { 'Content-Type': 'text/plain' });
        res.end('Bad request');
        return;
      }
      const safeName = path.basename(fileName);
      if (!safeName || safeName.startsWith('.') || safeName !== fileName) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const filePath = path.join(outputDir, safeName);

      if (!fs.existsSync(filePath)) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const ext = path.extname(filePath).toLowerCase();
      const stat = fs.statSync(filePath);

      res.writeHead(200, {
        'Content-Type': getMimeType(ext),
        'Content-Length': stat.size,
      });
      const stream = fs.createReadStream(filePath);
      stream.on('error', (err) => {
        process.stderr.write(`[bridge] file stream error: ${err.message}\n`);
        if (!res.headersSent) {
          res.writeHead(500);
          res.end();
        } else {
          res.destroy();
        }
      });
      stream.pipe(res);
      return;
    }

    res.writeHead(404);
    res.end('Not found');
  });

  // Error handler MUST be registered before listen() AND before WebSocketServer
  // to prevent unhandled 'error' events from crashing the process.
  httpServer.on('error', (err: NodeJS.ErrnoException) => {
    if (err.code === 'EADDRINUSE') {
      process.stderr.write(`[bridge] Port ${BRIDGE_PORT} already in use — bridge disabled (MCP tools still work, but no live viewport)\n`);
    } else {
      process.stderr.write(`[bridge] Server error: ${err.message}\n`);
    }
    // Don't crash the MCP server — tools still work without the bridge
  });

  httpServer.listen(BRIDGE_PORT, () => {
    process.stderr.write(`[bridge] Listening on port ${BRIDGE_PORT}\n`);
    process.stderr.write(`[bridge] Files: http://localhost:${BRIDGE_PORT}/files/\n`);
    process.stderr.write(`[bridge] WebSocket: ws://localhost:${BRIDGE_PORT}\n`);

    // Only create WebSocket server AFTER successful listen
    wss = new WebSocketServer({ server: httpServer! });

    wss.on('connection', (ws) => {
      frontendSocket = ws;
      process.stderr.write('[bridge] Frontend connected\n');

      ws.on('message', (raw) => {
        try {
          const msg = JSON.parse(raw.toString());
          handleFrontendMessage(msg);
        } catch {
          process.stderr.write(`[bridge] Invalid message from frontend: ${raw}\n`);
        }
      });

      ws.on('close', () => {
        process.stderr.write('[bridge] Frontend disconnected\n');
        if (frontendSocket === ws) frontendSocket = null;
      });
    });
  });
}

/**
 * Handle messages received from the frontend.
 */
function handleFrontendMessage(msg: { type: string; requestId?: string; [key: string]: unknown }) {
  // Response to a pending request (e.g., screenshot result)
  if (msg.type === 'response' && msg.requestId) {
    const pending = pendingRequests.get(msg.requestId);
    if (pending) {
      clearTimeout(pending.timer);
      pendingRequests.delete(msg.requestId);
      pending.resolve(msg);
    }
    return;
  }

  // Future: handle unsolicited messages from frontend
}

/**
 * Check if the frontend is connected.
 */
export function isFrontendConnected(): boolean {
  return frontendSocket !== null && frontendSocket.readyState === WebSocket.OPEN;
}

/**
 * Send a one-way command to the frontend (no response expected).
 */
export function sendToFrontend(msg: Record<string, unknown>): void {
  if (!frontendSocket || frontendSocket.readyState !== WebSocket.OPEN) {
    throw new Error('Frontend not connected. Make sure Phidias is open at http://localhost:3000');
  }
  frontendSocket.send(JSON.stringify(msg));
}

/**
 * Send a request to the frontend and wait for a response.
 * Used for capture_screenshot where we need data back.
 */
export function requestFromFrontend(
  msg: Record<string, unknown>,
  timeoutMs = 30_000,
): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    if (!frontendSocket || frontendSocket.readyState !== WebSocket.OPEN) {
      reject(new Error('Frontend not connected. Make sure Phidias is open at http://localhost:3000'));
      return;
    }

    const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

    const timer = setTimeout(() => {
      pendingRequests.delete(requestId);
      reject(new Error('Frontend request timed out'));
    }, timeoutMs);

    pendingRequests.set(requestId, {
      resolve: resolve as (data: unknown) => void,
      reject,
      timer,
    });

    frontendSocket.send(JSON.stringify({ ...msg, requestId }));
  });
}

/**
 * Get the HTTP URL for a file in the output directory.
 */
export function getFileUrl(filePath: string): string {
  const fileName = path.basename(filePath);
  return `http://localhost:${BRIDGE_PORT}/files/${encodeURIComponent(fileName)}`;
}
