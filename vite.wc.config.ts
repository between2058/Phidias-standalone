/**
 * vite.wc.config.ts
 *
 * Vite build config for the Phidias Web Component bundle.
 * Produces: dist/phidias-wc.js  (ESM, React externalized)
 *
 * Usage:
 *   npx vite build --config vite.wc.config.ts
 *   npx vite build --config vite.wc.config.ts --watch   (dev watch mode)
 */

import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

export default defineConfig({
    plugins: [react()],
    define: {
        'process.env.NODE_ENV': JSON.stringify('production')
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

            // ── PlayCanvas / Spark: same stubs as next.config.mjs ─────────────────
            'sync-ammo': path.resolve(__dirname, 'src/lib/stubs/sync-ammo.js'),
        },
    },

    build: {
        // Library mode: emit a single ESM bundle
        lib: {
            entry: path.resolve(__dirname, 'src/wc-entry.tsx'),
            name: 'PhidiasApp',
            fileName: 'phidias-wc',
            formats: ['es'],
        },

        rollupOptions: {
            // Externalize React so the portal's React instance is shared.
            // The portal (Vite) provides these as globals.
            // [TEMPORARY FIX] Bundling React to avoid bare specifier resolution errors in browser.
            // external: ['react', 'react-dom', 'react/jsx-runtime', 'react-dom/client'],

            output: {
                // Tell consumers where to find the externalized packages.
                globals: {
                    react: 'React',
                    'react-dom': 'ReactDOM',
                    'react/jsx-runtime': 'ReactJSXRuntime',
                    'react-dom/client': 'ReactDOMClient',
                },
            },
        },

        // Output directory (copy dist/phidias-wc.js to portal public/phidias/ in CI)
        outDir: 'dist',
        emptyOutDir: true,
        sourcemap: true,
    },

    // CSS is injected into the JS bundle (inlined as <style> at runtime).
    // This keeps dist/ to a single file without a separate .css artifact.
    css: {
        modules: false,
    },
});
