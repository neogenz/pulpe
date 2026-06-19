/**
 * Numeric segment-by-segment comparison (`1.0.10` > `1.0.2`), web analog of
 * the iOS gate's `String.isSemVerBelow`. Both inputs are strict `x.y.z`
 * semver — enforced by `appVersionResponseSchema` server-side and the
 * build-info generator client-side.
 */
export function isVersionBelow(current: string, minimum: string): boolean {
  const currentParts = current.split('.').map(Number);
  const minimumParts = minimum.split('.').map(Number);
  const length = Math.max(currentParts.length, minimumParts.length);

  for (let i = 0; i < length; i++) {
    const currentPart = currentParts[i] ?? 0;
    const minimumPart = minimumParts[i] ?? 0;
    if (currentPart !== minimumPart) {
      return currentPart < minimumPart;
    }
  }

  return false;
}
