/**
 * next-compat/dynamic.jsx
 *
 * Shim for `next/dynamic` (used for SSR-safe lazy loading in Next.js).
 * In Vite, we simply use React.lazy + Suspense.
 *
 * API supported:
 *   dynamic(() => import('./MyComponent'), { ssr: false, loading: () => <div/> })
 *
 * When running standalone (Next.js), this file is never loaded.
 */
import React, { lazy, Suspense } from 'react';

/**
 * @param {() => Promise<any>} importFn - Dynamic import factory
 * @param {{ ssr?: boolean, loading?: () => React.ReactNode }} [options]
 * @returns {React.ComponentType}
 */
export default function dynamic(importFn, options = {}) {
    const LazyComponent = lazy(() =>
        importFn().then((mod) => ({
            // next/dynamic expects the default export; handle both shapes
            default: mod.default ?? mod,
        }))
    );

    const LoadingFallback = options.loading ?? (() => null);

    // Return a wrapper that renders the Suspense boundary
    function DynamicComponent(props) {
        return (
            <Suspense fallback={<LoadingFallback />}>
                <LazyComponent {...props} />
            </Suspense>
        );
    }

    DynamicComponent.displayName = 'Dynamic';
    return DynamicComponent;
}
