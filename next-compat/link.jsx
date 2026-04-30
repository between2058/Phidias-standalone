/**
 * next-compat/link.jsx
 *
 * Shim for `next/link` so the Phidias sub-app compiles inside Vite
 * without touching the original Next.js source files.
 *
 * When running standalone (Next.js), this file is never loaded —
 * Next.js resolves `next/link` from its own runtime.
 *
 * When embedded inside the Vite portal, Vite's `resolve.alias` maps
 * `next/link` → this file, giving us a drop-in react-router-dom <Link>.
 */
import { Link as RouterLink } from 'react-router-dom';

export default function Link({ href, children, ...props }) {
    return (
        // 必須用 react-router-dom 的 Link，才能在不重整頁面的情況下切換路由
        <RouterLink to={href} {...props}>
            {children}
        </RouterLink>
    );
}