/**
 * Preserves concurrent toggle updates during mutation reconciliation.
 *
 * Use case: User toggles items while a mutation is in-flight.
 * Merges mutation result with latest toggle states to prevent data loss.
 *
 * @param items - Items with mutation applied
 * @param latestItems - Items with latest toggle states from current resource
 * @returns Merged items preserving both mutation + toggle states
 */
export function mergeToggleStates<
  T extends { id: string; checkedAt: string | null },
>(items: T[], latestItems: T[]): T[] {
  const latestCheckedAtMap = new Map(
    latestItems.map((item) => [item.id, item.checkedAt]),
  );

  return items.map((item) => {
    const latestCheckedAt = latestCheckedAtMap.get(item.id);
    if (latestCheckedAt !== undefined) {
      return { ...item, checkedAt: latestCheckedAt };
    }
    return item;
  });
}
