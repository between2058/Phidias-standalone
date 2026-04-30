/**
 * Feature Flags — single source of truth for toggleable features.
 *
 * ⚠️ For the TRELLIS2_BACKEND flag below: before flipping or deleting,
 * read `docs/TRELLIS2_BACKEND_SWITCH.md` — it documents the three product
 * scenarios (keep both / TRELLIS.2 only / ReconViaGen only) and the
 * exact steps + cross-cutting cleanup required for each.
 *
 * Flip a flag here and all UI + dispatch paths keyed off it switch together.
 * Use `as const` so TypeScript narrows each flag to its literal value,
 * letting the compiler dead-code-eliminate unused branches.
 *
 * Adding a new flag:
 *   1. Add the field below with a descriptive comment.
 *   2. Import `FEATURES` at the use site.
 *   3. Wrap UI with `{FEATURES.FLAG_NAME && (...)}` and dispatch with
 *      `if (FEATURES.FLAG_NAME) { ... } else { ... }`.
 */

export const FEATURES = {
  /**
   * Admin kill-switch for the Model-tab Fast/Quality backend switcher.
   *
   * Scenario A (landed 2026-04-17): both backends selectable at request time
   * via the in-panel `[Fast] [Quality]` switcher. This flag no longer
   * determines the default backend — the panel defaults to Quality (TRELLIS.2)
   * and the user can flip freely.
   *
   * When true (default):
   *   - Fast/Quality switcher renders in all non-batch input modes.
   *   - Dispatch honors `params.backend` at runtime.
   *
   * When false:
   *   - Switcher is hidden, `handleGenerate` coerces backend to ReconViaGen,
   *     every mode behaves like the pre-Scenario-A baseline. Use only for
   *     emergency rollback of the TRELLIS.2 path.
   */
  TRELLIS2_BACKEND: true,
} as const;
