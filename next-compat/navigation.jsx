/**
 * next-compat/navigation.jsx
 *
 * Shim for `next/navigation` (useRouter, usePathname, useSearchParams)
 * using react-router-dom equivalents.
 *
 * When running standalone (Next.js), this file is never loaded.
 * When embedded inside the Vite portal, Vite's `resolve.alias` maps
 * `next/navigation` → this file.
 */
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';

/**
 * Mimics next/navigation's useRouter().
 * Provides push / replace / back / forward / refresh.
 */
export function useRouter() {
    const navigate = useNavigate();
    return {
        push: (href) => navigate(href),
        replace: (href) => navigate(href, { replace: true }),
        back: () => navigate(-1),
        forward: () => navigate(1),
        refresh: () => window.location.reload(),
        prefetch: () => { },     // no-op
    };
}

/**
 * Mimics next/navigation's usePathname().
 * Returns the current pathname string (e.g. "/phidias/workspace/model").
 */
export function usePathname() {
    const location = useLocation();
    return location.pathname;
}

/**
 * Mimics next/navigation's useSearchParams().
 * Returns a URLSearchParams-compatible object.
 */
export { useSearchParams };

/**
 * Mimics next/navigation's notFound().
 * In Vite context we simply throw — callers should catch if needed.
 */
export function notFound() {
    throw new Error('Not found');
}

/**
 * Mimics next/navigation's redirect().
 */
export function redirect(url) {
    window.location.href = url;
}
