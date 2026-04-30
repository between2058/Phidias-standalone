/**
 * vite.wc.config.ts
 *
 * Vite build config for the Phidias Web Component bundle.
 *
 * Three build modes:
 *
 *   latest  (default)  → dist/phidias-wc.js
 *     ON PUSH only. Fixed filename, replaced in-place on every deploy.
 *     Reads scripts/phidias-manifest.json (git-tracked, has all historical entries),
 *     updates the 'latest' entry, writes dist/phidias-manifest.json.
 *     Preserves all historical entries.
 *     Usage: vite build --config vite.wc.config.ts
 *            vite build --config vite.wc.config.ts --watch   (dev watch mode)
 *
 *   steady             → dist/phidias-wc-<tag>.<hash>.js  (CI tag build)
 *                      → dist/phidias-wc-steady.<hash>.js  (local/no-tag build)
 *     Content-hashed filename for immutable CDN caching.
 *
 *     ON PUSH: Reads dist/phidias-manifest.json (produced by preceding 'latest' build),
 *              merges 'steady' entry + tag-specific entry (if CI_COMMIT_TAG is set),
 *              writes updated dist/phidias-manifest.json. Preserves all historical entries.
 *
 *     ON TAG:  Creates CLEAN manifest with ONLY 'steady' entry.
 *              No historical entries, no 'latest', no tag-specific key.
 *
 *     Usage: vite build --config vite.wc.config.ts --mode steady
 *
 * Recommended CI order on every push:
 *   1. npm run build:wc          (produces phidias-wc.js + manifest with latest entry)
 *   2. npm run build:wc:steady   (produces hashed bundle + updated manifest with steady + tag)
 *
 * Recommended CI order on tag push:
 *   1. npm run build:wc:steady   (produces hashed bundle + CLEAN manifest with ONLY steady)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { readFileSync, writeFileSync } from 'fs';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import cssInjectedByJsPlugin from 'vite-plugin-css-injected-by-js';
import {
  PHIDIAS_WC_FILENAME,
  PHIDIAS_WC_STEADY_FILENAME_PREFIX,
  PHIDIAS_MANIFEST_FILENAME,
  PHIDIAS_CHANNELS,
  type PhidiasManifest,
  type PhidiasManifestEntry,
} from '@pegaverse/phidias-sdk';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

// ─── Helpers ──────────────────────────────────────────────────────────────────

function readJsonSafe<T>(filePath: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(filePath, 'utf-8')) as T;
  } catch {
    return fallback;
  }
}

// ─── Manifest plugin ──────────────────────────────────────────────────────────

/**
 * Writes (or updates) phidias-manifest.json after each build so any call to
 * loadPhidias() can resolve the correct filename from a single manifest fetch.
 *
 * latest build — reads scripts/phidias-manifest.json (git-tracked, all historical tags),
 *   updates the 'latest' entry, writes dist/phidias-manifest.json.
 *
 * steady build — reads dist/phidias-manifest.json (produced by the preceding latest build),
 *   updates 'steady' entry, and — when CI_COMMIT_TAG is set — adds a tag-specific entry.
 *   Example result:
 *   {
 *     "latest": { "filename": "phidias-wc.js", ... },
 *     "steady": { "filename": "phidias-wc-v1.2.3.a1b2c3d4.js", ... },
 *     "v1.2.3": { "filename": "phidias-wc-v1.2.3.a1b2c3d4.js", ... },
 *     "v1.2.0": { "filename": "phidias-wc-v1.2.0.e5f6a7b8.js", ... }  ← from git history
 *   }
 */
function generateManifestPlugin(isSteady: boolean): Plugin {
  return {
    name: 'phidias-generate-manifest',
    writeBundle(options, bundle) {
      const outDir = options.dir ?? 'dist';
      const now = new Date().toISOString();
      const tagName = process.env.CI_COMMIT_TAG; // e.g. "v1.2.3" or undefined
      const isOnTag = !!tagName;

      // In inlineDynamicImports mode there is exactly one entry chunk
      const entryChunk = Object.entries(bundle).find(
        ([, chunk]) => chunk.type === 'chunk' && chunk.isEntry,
      );
      const steadyFilename = entryChunk?.[0];

      let manifest: PhidiasManifest;

      if (isSteady && isOnTag) {
        // ─── on TAG steady build ──────────────────────────────────────────────
        // Clean manifest with ONLY 'steady' entry
        // No historical entries, no 'latest', no tag-specific key
        manifest = {
          [PHIDIAS_CHANNELS.STEADY]: {
            filename: steadyFilename ?? `${PHIDIAS_WC_STEADY_FILENAME_PREFIX}.js`,
            updatedAt: now,
          } satisfies PhidiasManifestEntry,
        };
        console.log(`[Phidias] Tag build (${tagName}): generating CLEAN manifest with only 'steady' entry`);
      } else if (isSteady) {
        // ─── on PUSH steady build ─────────────────────────────────────────────
        // Inherits from dist/ manifest, updates 'steady' and adds tag-specific entry
        const sourceManifestPath = path.join(outDir, PHIDIAS_MANIFEST_FILENAME);
        const existingManifest = readJsonSafe<PhidiasManifest>(sourceManifestPath, {});

        manifest = {
          ...existingManifest,
          [PHIDIAS_CHANNELS.STEADY]: {
            filename: steadyFilename ?? `${PHIDIAS_WC_STEADY_FILENAME_PREFIX}.js`,
            updatedAt: now,
          } satisfies PhidiasManifestEntry,
        };

        // Add tag-specific entry if tag exists (allows host apps to pin to exact release)
        if (tagName) {
          manifest[tagName] = {
            filename: steadyFilename ?? `${PHIDIAS_WC_STEADY_FILENAME_PREFIX}.js`,
            updatedAt: now,
          } satisfies PhidiasManifestEntry;
        }
      } else {
        // ─── on PUSH latest build ─────────────────────────────────────────────
        // Inherits from git-tracked manifest, updates 'latest' only
        const sourceManifestPath = path.join(__dirname, 'scripts', PHIDIAS_MANIFEST_FILENAME);
        const existingManifest = readJsonSafe<PhidiasManifest>(sourceManifestPath, {});

        manifest = {
          ...existingManifest,
          [PHIDIAS_CHANNELS.LATEST]: {
            filename: PHIDIAS_WC_FILENAME,
            updatedAt: now,
          } satisfies PhidiasManifestEntry,
        };
      }

      const manifestPath = path.join(outDir, PHIDIAS_MANIFEST_FILENAME);
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
      console.log(`\n[Phidias] Manifest written → ${manifestPath}`);
      Object.entries(manifest).forEach(([k, v]) => {
        console.log(`[Phidias]   ${k}: ${(v as PhidiasManifestEntry).filename} (${(v as PhidiasManifestEntry).updatedAt})`);
      });
    },
  };
}

// ─── Config ──────────────────────────────────────────────────────────────────

export default defineConfig(({ mode }) => {
  const isSteady = mode === 'steady';
  const tagName = process.env.CI_COMMIT_TAG; // e.g. "v1.2.3" or undefined

  // Tag build:   "phidias-wc-v1.2.3"  → output "phidias-wc-v1.2.3.<hash>.js"
  // Local steady (no tag): "phidias-wc-steady" → output "phidias-wc-steady.<hash>.js"
  const steadyFilePrefix = tagName
    ? `phidias-wc-${tagName}`
    : PHIDIAS_WC_STEADY_FILENAME_PREFIX;

  return {
    plugins: [
      react(),
      // Store the bundled CSS in window.__PHIDIAS_CSS__ instead of injecting
      // a <style> into document.head.  The PhidiasWebComponent._mount() reads
      // this value and injects it into the shadow root, keeping all styles
      // scoped to the Web Component and preventing global CSS pollution.
      //
      // NOTE: vite-plugin-css-injected-by-js v4 changed the injectCodeFunction
      // API: the function is now embedded in the bundle and executed at runtime
      // (its return value is discarded). It must perform the side effect directly
      // instead of returning a JS code string as in v3.
      cssInjectedByJsPlugin({
        injectCodeFunction: function(cssCode: string) {
          if (typeof window !== 'undefined') {
            (window as unknown as Record<string, unknown>).__PHIDIAS_CSS__ =
              (((window as unknown as Record<string, unknown>).__PHIDIAS_CSS__ as string) || '') + cssCode;
          }
        },
      }),
      // Manifest generation runs on every build:
      // - latest build: writes { latest: ... } to dist/phidias-manifest.json
      // - steady build: reads dist/manifest (from latest build) and merges steady + tag entries
      generateManifestPlugin(isSteady),
    ],

    define: {
      'process.env.NODE_ENV': JSON.stringify('production'),
    },

    resolve: {
      alias: {
        // ── Path alias: mirror the Next.js @/ → src/ convention ──────────────
        '@': path.resolve(__dirname, 'src'),

        // ── next/* shims: redirect Next.js-specific imports to our compat layer
        // These are only used by the WC Vite build; Next.js standalone is unaffected.
        'next/link': path.resolve(__dirname, 'next-compat/link.jsx'),
        'next/navigation': path.resolve(__dirname, 'next-compat/navigation.jsx'),
        'next/dynamic': path.resolve(__dirname, 'next-compat/dynamic.jsx'),
        'next/image': path.resolve(__dirname, 'next-compat/image.jsx'),

        // ── PlayCanvas / Spark: same stubs as next.config.mjs ─────────────────
        'sync-ammo': path.resolve(__dirname, 'src/lib/stubs/sync-ammo.js'),
      },
    },

    build: {
      lib: {
        entry: path.resolve(__dirname, 'src/wc-entry.tsx'),
        name: 'PhidiasApp',
        formats: ['es'],
        // For the latest build, pin the output filename to the known constant.
        // For steady, omit fileName so rollupOptions.output.entryFileNames
        // (which includes [hash]) takes effect instead.
        ...(isSteady ? {} : { fileName: () => PHIDIAS_WC_FILENAME }),
      },

      rollupOptions: {
        // All dependencies are bundled into the WC artifact.
        // The ESM format does not support the Rollup `globals` mechanism —
        // bare specifiers (react, three, etc.) cannot be resolved by the
        // browser without an importmap, and the host app does not provide one.
        // Bundling everything keeps the WC self-contained and avoids runtime
        // module resolution errors at the cost of ~190 KB extra (gzipped).
        external: [],

        output: {
          inlineDynamicImports: true,
          // steady → content-hashed filename for immutable CDN Cache-Control headers
          // latest → fixed filename (no hash), hot-swapped on each deploy
          ...(isSteady ? { entryFileNames: `${steadyFilePrefix}.[hash].js` } : {}),
        },
      },

      // Output directory.
      outDir: 'dist',

      // latest build cleans dist so stale files don't accumulate.
      // steady build keeps existing files so phidias-wc.js (latest) is preserved
      // alongside the new steady bundle; the manifest is overwritten in full.
      emptyOutDir: !isSteady,

      // Disable source maps for steady (tag/production) builds to keep the
      // image lean and avoid shipping source code. Latest (dev/push) builds
      // keep source maps for easier debugging.
      sourcemap: !isSteady,
    },

    // CSS is injected into the JS bundle (inlined as <style> at runtime).
    // This keeps dist/ to a single file without a separate .css artifact.
    css: {
      modules: false,
    },
  };
});
