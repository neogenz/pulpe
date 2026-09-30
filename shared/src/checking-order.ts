/** Mirrors iOS CheckingOrder: due forecasts → unknown → future. Presentation only. */
export function checkingPriority(
  expectedDay: number | undefined,
  today: number,
): number {
  if (
    expectedDay === undefined ||
    !Number.isInteger(expectedDay) ||
    expectedDay < 1 ||
    expectedDay > 31
  )
    return 32;
  return expectedDay <= today ? expectedDay : 32 + expectedDay;
}
