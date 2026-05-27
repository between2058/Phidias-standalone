export function encodePose(pose: Record<string, number>): string {
  if (Object.keys(pose).length === 0) return '';
  return btoa(JSON.stringify(pose));
}

export function decodePose(encoded: string | null | undefined): Record<string, number> {
  if (!encoded) return {};
  try {
    return JSON.parse(atob(encoded)) as Record<string, number>;
  } catch {
    return {};
  }
}
