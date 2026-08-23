const DIGITS = /^\d+$/;

/** `null` when any segment is not a plain number — including an empty string. */
function parseVersion(version: string): number[] | null {
  const segments = version.split(".");
  if (!segments.every((segment) => DIGITS.test(segment))) return null;
  return segments.map(Number);
}

/**
 * `1.9.0` is below `1.10.0`. A string comparison would say the opposite, which
 * is exactly the kind of mistake that either bricks a supported build or lets
 * an unsupported one through.
 *
 * An unparseable version on either side answers "not below": the gate this
 * feeds locks the app out of the user's own data, so a version string nobody
 * can read must not be the thing that trips it.
 */
export function isVersionBelow(version: string, other: string): boolean {
  const left = parseVersion(version);
  const right = parseVersion(other);
  if (left === null || right === null) return false;

  for (let index = 0; index < Math.max(left.length, right.length); index += 1) {
    const a = left[index] ?? 0;
    const b = right[index] ?? 0;
    if (a !== b) return a < b;
  }
  return false;
}
