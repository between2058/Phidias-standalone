import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PlayCanvas and its React wrapper are ESM-only packages
  transpilePackages: ['@playcanvas/react', 'playcanvas'],

  // Enable standalone output for optimized docker builds
  output: 'standalone',

  // Skip ESLint during builds (fix lint errors incrementally later)
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Rewrites for standalone mode: map /phidias/* to /api/phidias/*
  // This allows the frontend to call /phidias/... and hit our API routes
  async rewrites() {
    return [
      // 3dgrut rewrite must come first — more specific path takes priority
      { source: '/phidias/3dgrut/:path*', destination: `${process.env.THREEDGRUT_API_URL || 'http://localhost:8191'}/:path*` },
      {
        source: '/phidias/:path*',
        destination: '/api/phidias/:path*',
      },
    ];
  },

  webpack: (config, { isServer }) => {
    // WASM support for occt-import-js
    config.experiments = { ...config.experiments, asyncWebAssembly: true };

    // Exclude occt-import-js from SSR bundling (browser-only WASM)
    if (isServer) {
      config.externals = config.externals || [];
      config.externals.push('occt-import-js');
    }

    // Stub physics engine — we don't use PlayCanvas physics
    config.resolve.alias['sync-ammo'] = path.resolve(__dirname, 'src/lib/stubs/sync-ammo.js');

    const sparkCjsPath = path.resolve(
      __dirname,
      'node_modules/@sparkjsdev/spark/dist/spark.cjs.js'
    );

    // 1. Point the package import at the CJS bundle (avoids the ESM
    //    spark.module.js which uses an incompatible webpack asset-module
    //    generator `filename` property).
    config.resolve.alias['@sparkjsdev/spark'] = sparkCjsPath;

    // 2. The CJS file uses `exports`/`require` BUT the package has
    //    "type":"module" in package.json, so webpack treats every .js as
    //    ESM and omits the CommonJS shim.  `javascript/auto` tells webpack
    //    to use its legacy CommonJS wrapper for this specific file.
    config.module.rules.push({
      test: sparkCjsPath,
      type: 'javascript/auto',
    });

    return config;
  },
};

export default nextConfig;
