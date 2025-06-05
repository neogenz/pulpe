export function removeUndefinedFields<T extends Record<string, unknown>>(
  obj: T
): Record<string, NonNullable<T[keyof T]>> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (value !== undefined) {
      result[key] = value;
    }
  }

  return result as Record<string, NonNullable<T[keyof T]>>;
}
