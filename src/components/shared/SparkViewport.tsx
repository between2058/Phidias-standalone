'use client';

import {
  useEffect,
  useRef,
  useImperativeHandle,
  forwardRef,
  useCallback,
} from 'react';
import * as THREE from 'three';
import { cn } from '@/lib/utils';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SparkViewportHandle {
  loadSplat: (url: string) => Promise<void>;
  clearSplat: () => void;
  getScene: () => THREE.Scene | null;
  getCamera: () => THREE.PerspectiveCamera | null;
  resetCamera: () => void;
}

export interface SparkViewportProps {
  splatUrl?: string;
  showGrid?: boolean;
  enableFirstPerson?: boolean;
  className?: string;
  onSplatLoaded?: () => void;
  onSplatLoadError?: (err: unknown) => void;
  onReady?: () => void;
}

// ─── SparkViewport ────────────────────────────────────────────────────────────

const SparkViewport = forwardRef<SparkViewportHandle, SparkViewportProps>(
  (
    {
      splatUrl,
      showGrid = true,
      enableFirstPerson = false,
      className,
      onSplatLoaded,
      onSplatLoadError,
      onReady,
    },
    ref,
  ) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    // THREE objects
    const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
    const sceneRef = useRef<THREE.Scene | null>(null);
    const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
    const gridRef = useRef<THREE.GridHelper | null>(null);
    const currentSplatRef = useRef<THREE.Object3D | null>(null);

    // spark.js refs (dynamic-imported)
    const sparkRendererRef = useRef<unknown>(null);
    const sparkControlsRef = useRef<unknown>(null);
    const animFrameIdRef = useRef<number | null>(null);

    // Callbacks (stable refs to avoid dep-loop restarts)
    const onSplatLoadedRef = useRef(onSplatLoaded);
    const onSplatLoadErrorRef = useRef(onSplatLoadError);
    const onReadyRef = useRef(onReady);
    useEffect(() => {
      onSplatLoadedRef.current = onSplatLoaded;
    }, [onSplatLoaded]);
    useEffect(() => {
      onSplatLoadErrorRef.current = onSplatLoadError;
    }, [onSplatLoadError]);
    useEffect(() => {
      onReadyRef.current = onReady;
    }, [onReady]);

    // ── Load a splat into the scene ─────────────────────────────────────────────
    const loadSplatIntoScene = useCallback(async (url: string) => {
      const scene = sceneRef.current;
      if (!scene) return;

      // Remove existing splat
      if (currentSplatRef.current) {
        scene.remove(currentSplatRef.current);
        currentSplatRef.current = null;
      }

      try {
        const { SplatMesh } = await import('@sparkjsdev/spark');
        const splat = new SplatMesh({
          url,
          onFrame: ({ mesh }: { mesh: { needsUpdate: boolean } }) => {
            mesh.needsUpdate = true;
          },
        });
        await splat.initialized;
        scene.add(splat as unknown as THREE.Object3D);
        currentSplatRef.current = splat as unknown as THREE.Object3D;
        onSplatLoadedRef.current?.();
      } catch (err) {
        console.error('[SparkViewport] Failed to load splat:', err);
        onSplatLoadErrorRef.current?.(err);
      }
    }, []);

    // ── Imperative handle ───────────────────────────────────────────────────────
    useImperativeHandle(
      ref,
      () => ({
        loadSplat: loadSplatIntoScene,
        clearSplat: () => {
          if (currentSplatRef.current && sceneRef.current) {
            sceneRef.current.remove(currentSplatRef.current);
            currentSplatRef.current = null;
          }
        },
        getScene: () => sceneRef.current,
        getCamera: () => cameraRef.current,
        resetCamera: () => {
          const cam = cameraRef.current;
          if (cam) {
            cam.position.set(0, 1.6, 4);
            cam.lookAt(0, 0, 0);
          }
        },
      }),
      [loadSplatIntoScene],
    );

    // ── Main setup effect ───────────────────────────────────────────────────────
    useEffect(() => {
      const canvas = canvasRef.current;
      const container = containerRef.current;
      if (!canvas || !container) return;

      let disposed = false;

      const init = async () => {
        // Renderer — antialias MUST be false for spark.js performance
        const renderer = new THREE.WebGLRenderer({
          canvas,
          antialias: false,
          alpha: true,
        });
        renderer.setClearColor(0x1a1a2e, 1);
        renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
        renderer.setSize(container.clientWidth, container.clientHeight, false);
        rendererRef.current = renderer;

        // Scene
        const scene = new THREE.Scene();
        scene.background = new THREE.Color(0x1a1a2e);
        sceneRef.current = scene;

        // Camera
        const camera = new THREE.PerspectiveCamera(
          70,
          container.clientWidth / container.clientHeight,
          0.01,
          2000,
        );
        camera.position.set(0, 1.6, 4);
        camera.lookAt(0, 0, 0);
        scene.add(camera);
        cameraRef.current = camera;

        // Ambient light
        scene.add(new THREE.AmbientLight(0xffffff, 0.6));
        const dir = new THREE.DirectionalLight(0xffffff, 0.8);
        dir.position.set(5, 10, 5);
        scene.add(dir);

        // Grid
        const grid = new THREE.GridHelper(40, 40, 0x333355, 0x1e1e36);
        grid.visible = showGrid;
        scene.add(grid);
        gridRef.current = grid;

        // SparkRenderer
        const { SparkRenderer, SparkControls } = await import(
          '@sparkjsdev/spark'
        );
        if (disposed) {
          renderer.dispose();
          return;
        }

        const sparkRenderer = new SparkRenderer({ renderer });
        scene.add(sparkRenderer as unknown as THREE.Object3D);
        sparkRendererRef.current = sparkRenderer;

        // SparkControls
        const sparkControls = new SparkControls({ canvas });
        // Orbit-like feel (not locked FPS by default)
        (
          sparkControls as { fpsMovement: { moveSpeed: number } }
        ).fpsMovement.moveSpeed = 3;
        sparkControlsRef.current = sparkControls;

        // Animate
        let last = 0;
        const tick = (rawTime: number) => {
          animFrameIdRef.current = requestAnimationFrame(tick);
          const t = rawTime * 0.001;
          const dt = t - last;
          last = t;
          (
            sparkControls as { update: (cam: THREE.PerspectiveCamera) => void }
          ).update(camera);
          renderer.render(scene, camera);
          void dt; // used implicitly by SparkRenderer
        };
        animFrameIdRef.current = requestAnimationFrame(tick);

        onReadyRef.current?.();
      };

      init();

      // Resize observer
      const ro = new ResizeObserver(() => {
        const cam = cameraRef.current;
        const ren = rendererRef.current;
        if (!cam || !ren || !container) return;
        const w = container.clientWidth;
        const h = container.clientHeight;
        cam.aspect = w / h;
        cam.updateProjectionMatrix();
        ren.setSize(w, h, false);
      });
      ro.observe(container);

      return () => {
        disposed = true;
        ro.disconnect();
        if (animFrameIdRef.current !== null)
          cancelAnimationFrame(animFrameIdRef.current);
        rendererRef.current?.dispose();
        rendererRef.current = null;
        sceneRef.current = null;
        cameraRef.current = null;
        sparkRendererRef.current = null;
        sparkControlsRef.current = null;
        currentSplatRef.current = null;
      };
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // Run once

    // ── Sync showGrid ───────────────────────────────────────────────────────────
    useEffect(() => {
      if (gridRef.current) gridRef.current.visible = showGrid;
    }, [showGrid]);

    // ── Sync splatUrl ───────────────────────────────────────────────────────────
    useEffect(() => {
      if (!splatUrl) {
        if (currentSplatRef.current && sceneRef.current) {
          sceneRef.current.remove(currentSplatRef.current);
          currentSplatRef.current = null;
        }
        return;
      }
      loadSplatIntoScene(splatUrl);
    }, [splatUrl, loadSplatIntoScene]);

    // ── Sync enableFirstPerson ─────────────────────────────────────────────────
    useEffect(() => {
      const sc = sparkControlsRef.current as {
        fpsMovement?: { enable: boolean };
        pointerControls?: { enable: boolean };
      } | null;
      if (!sc) return;
      if (sc.fpsMovement) sc.fpsMovement.enable = enableFirstPerson;
      if (sc.pointerControls) sc.pointerControls.enable = true; // always allow orbit
    }, [enableFirstPerson]);

    return (
      <div
        ref={containerRef}
        className={cn('relative w-full h-full overflow-hidden', className)}
      >
        <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" />
      </div>
    );
  },
);

SparkViewport.displayName = 'SparkViewport';

export default SparkViewport;
