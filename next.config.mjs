import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  // PlayCanvas and its React wrapper are ESM-only packages
  transpilePackages: ['@playcanvas/react', 'playcanvas'],

  webpack: (config) => {
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
