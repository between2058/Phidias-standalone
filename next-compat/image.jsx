/**
 * next-compat/image.jsx
 *
 * Shim for `next/image` so the Phidias sub-app compiles inside Vite
 * without touching the original Next.js source files.
 *
 * When running standalone (Next.js), this file is never loaded —
 * Next.js resolves `next/image` from its own runtime.
 *
 * When embedded inside the Vite portal, Vite's `resolve.alias` maps
 * `next/image` → this file, giving us a drop-in <img> replacement.
 */

/**
 * Next.js Image component shim for Web Component mode.
 *
 * This replaces next/image's <Image> with a standard <img> element.
 * Note: next/image's optimization features (lazy loading, srcset, etc.)
 * are not available in this shim - it provides API compatibility only.
 */
export default function Image({ src, alt, width, height, className, style, priority, ...props }) {
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={src}
      alt={alt}
      width={width}
      height={height}
      className={className}
      style={style}
      {...props}
    />
  );
}
