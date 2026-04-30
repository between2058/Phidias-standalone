'use client';

import { useEffect, useRef, useCallback } from 'react';
import { useWorkspace } from '@/lib/workspace-context';

const MCP_BRIDGE_URL = 'ws://localhost:9800';
const RECONNECT_INTERVAL_MS = 5_000;

interface McpCommand {
  type: string;
  requestId?: string;
  [key: string]: unknown;
}

/**
 * Hook that connects to the Phidias MCP bridge server via WebSocket.
 * Handles incoming commands:
 * - load_model: adds a GLB asset and sets it active in the viewport
 * - capture_screenshot: captures the current viewport and sends back base64 PNG
 *
 * @param canvasRef - ref to the Three.js renderer's canvas element (for screenshot)
 */
export function useMcpBridge(canvasRef?: React.RefObject<HTMLCanvasElement | null>) {
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { assets, activeAssetId, addAsset, setActiveAssetId } = useWorkspace();

  const send = useCallback((msg: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(msg));
    }
  }, []);

  const handleMessage = useCallback((event: MessageEvent) => {
    let cmd: McpCommand;
    try {
      cmd = JSON.parse(event.data);
    } catch {
      console.warn('[McpBridge] Invalid message:', event.data);
      return;
    }

    switch (cmd.type) {
      case 'load_model': {
        const url = cmd.url as string;
        const name = (cmd.name as string) || 'MCP Model';

        console.log(`[McpBridge] Loading model: ${name} from ${url}`);

        const assetId = addAsset({
          name,
          modelUrl: url,
          type: 'textured',
          status: 'ready',
          pipelineUsed: 'unknown',
        });
        setActiveAssetId(assetId);
        break;
      }

      case 'get_viewport_state': {
        const activeAsset = assets.find(a => a.id === activeAssetId) ?? null;
        send({
          type: 'response',
          requestId: cmd.requestId,
          activeAsset: activeAsset ? {
            id: activeAsset.id,
            name: activeAsset.name,
            modelUrl: activeAsset.modelUrl,
            type: activeAsset.type,
            status: activeAsset.status,
            faces: activeAsset.faces,
            vertices: activeAsset.vertices,
            segmentation: activeAsset.segmentation,
            isOrganized: activeAsset.isOrganized,
          } : null,
          totalAssets: assets.length,
        });
        break;
      }

      case 'capture_screenshot': {
        console.log('[McpBridge] Screenshot requested');

        // Find the WebGL canvas in the viewport
        const canvas = canvasRef?.current
          ?? document.querySelector<HTMLCanvasElement>('canvas[data-engine]')
          ?? document.querySelector<HTMLCanvasElement>('canvas');

        if (!canvas) {
          send({
            type: 'response',
            requestId: cmd.requestId,
            screenshot: null,
            error: 'No canvas found in viewport',
          });
          break;
        }

        try {
          const dataUrl = canvas.toDataURL('image/png');
          // Strip the data:image/png;base64, prefix
          const base64 = dataUrl.split(',')[1] || '';

          send({
            type: 'response',
            requestId: cmd.requestId,
            screenshot: base64,
          });
        } catch (err) {
          send({
            type: 'response',
            requestId: cmd.requestId,
            screenshot: null,
            error: err instanceof Error ? err.message : 'Screenshot failed',
          });
        }
        break;
      }

      case 'smart_organize': {
        console.log('[McpBridge] Smart organize requested');

        // Dispatch a custom event for the segment page to pick up.
        // The segment page has all the Three.js scene context needed to
        // capture multi-angle screenshots and call the VLM API.
        const requestId = cmd.requestId;
        const resultHandler = (e: Event) => {
          const detail = (e as CustomEvent).detail;
          send({
            type: 'response',
            requestId,
            ...detail,
          });
          window.removeEventListener('phidias:smart-organize-result', resultHandler);
        };
        window.addEventListener('phidias:smart-organize-result', resultHandler);

        // Timeout: if no response in 2 minutes, clean up
        setTimeout(() => {
          window.removeEventListener('phidias:smart-organize-result', resultHandler);
        }, 120_000);

        window.dispatchEvent(new CustomEvent('phidias:smart-organize-request', {
          detail: { requestId },
        }));
        break;
      }

      default:
        console.log(`[McpBridge] Unknown command: ${cmd.type}`);
    }
  }, [addAsset, setActiveAssetId, canvasRef, send]);

  useEffect(() => {
    function connect() {
      // Don't connect if already connected
      if (wsRef.current?.readyState === WebSocket.OPEN ||
          wsRef.current?.readyState === WebSocket.CONNECTING) {
        return;
      }

      try {
        const ws = new WebSocket(MCP_BRIDGE_URL);

        ws.onopen = () => {
          console.log('[McpBridge] Connected to MCP bridge server');
        };

        ws.onmessage = handleMessage;

        ws.onclose = () => {
          console.log('[McpBridge] Disconnected, will retry...');
          wsRef.current = null;
          // Schedule reconnect
          reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
        };

        ws.onerror = () => {
          // onclose will fire after this, which handles reconnect
        };

        wsRef.current = ws;
      } catch {
        // Schedule reconnect on connection failure
        reconnectTimerRef.current = setTimeout(connect, RECONNECT_INTERVAL_MS);
      }
    }

    connect();

    return () => {
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current);
      }
      if (wsRef.current) {
        wsRef.current.onclose = null; // Prevent reconnect on intentional close
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, [handleMessage]);

  return { send };
}
