/**
 * src/lib/shadow-portal.tsx
 *
 * Provides the Shadow DOM portal target element via React Context.
 *
 * In Web Component mode, this context holds the <div> inside the shadow root
 * that Radix UI portal-based components (Dialog, DropdownMenu, Popover, etc.)
 * should render into. This keeps all rendered content inside the shadow
 * boundary so shadow-scoped CSS variables remain available.
 *
 * In Next.js Standalone mode the context value is null, which causes Radix UI
 * to fall back to its default behaviour (rendering into document.body).
 *
 * Usage:
 *   // In any component that uses a Radix UI portal:
 *   import { useShadowPortal } from '@/lib/shadow-portal';
 *
 *   function MyDropdown() {
 *     const portalContainer = useShadowPortal();
 *     return (
 *       <DropdownMenu>
 *         <DropdownMenuPortal container={portalContainer ?? undefined}>
 *           ...
 *         </DropdownMenuPortal>
 *       </DropdownMenu>
 *     );
 *   }
 */

import { createContext, useContext } from 'react';

export const ShadowPortalContext = createContext<HTMLElement | null>(null);

/**
 * Returns the shadow root's portal target element, or null when running in
 * Next.js Standalone mode (no shadow DOM).
 */
export function useShadowPortal(): HTMLElement | null {
  return useContext(ShadowPortalContext);
}
