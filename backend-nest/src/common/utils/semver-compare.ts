const SEMVER_SEGMENT_COUNT = 3;

/**
 * Returns true when `version <= ceiling`, comparing the three numeric
 * `MAJOR.MINOR.PATCH` segments. Callers shape-validate inputs with the
 * `/^\d+\.\d+\.\d+$/` regex first, so each split yields exactly three numbers.
 */
export function isVersionAtMost(version: string, ceiling: string): boolean {
  const parts = version.split('.').map(Number);
  const ceilingParts = ceiling.split('.').map(Number);
  for (let i = 0; i < SEMVER_SEGMENT_COUNT; i++) {
    if (parts[i] !== ceilingParts[i]) {
      return parts[i] < ceilingParts[i];
    }
  }
  return true;
}
