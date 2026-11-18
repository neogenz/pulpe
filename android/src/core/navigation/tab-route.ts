const TABS_SEGMENT = "(tabs)";
const GROUP = /^\((.+)\)$/;

/**
 * The tab a navigator route stands for. A tab that holds its own stack is a
 * group (`(budgets)`), a tab that is a single screen is not (`net-worth`):
 * both answer to the bare name, which is what the bar, analytics and the flag
 * redirect compare against.
 */
export function tabKey(routeName: string): string {
  return routeName.replace(GROUP, "$1");
}

/**
 * The tab the focused screen lives in, read from the segment right under
 * `(tabs)` rather than the last one: a detail pushed inside a tab is still
 * that tab. `undefined` outside the tabs, on a screen pushed over the bar.
 */
export function currentTab(segments: readonly string[]): string | undefined {
  const index = segments.indexOf(TABS_SEGMENT);
  const segment = index === -1 ? undefined : segments[index + 1];
  return segment === undefined ? undefined : tabKey(segment);
}

/**
 * The screen name analytics has always received, before the detail screens
 * moved inside the tabs: a tab root keeps `(main)/(tabs)/budgets`, a detail
 * drops the tab it was opened from (`(main)/budget/[id]`), so one screen is
 * one name whichever tab shows it.
 */
export function screenName(segments: readonly string[]): string {
  const index = segments.indexOf(TABS_SEGMENT);
  const group = segments[index + 1];
  if (index === -1 || group === undefined || !GROUP.test(group)) {
    return segments.join("/");
  }

  const rest = segments.slice(index + 2);
  const isTabRoot = rest.length === 1 && rest[0] === tabKey(group);
  return [
    ...segments.slice(0, index),
    ...(isTabRoot ? [TABS_SEGMENT, ...rest] : rest),
  ].join("/");
}
