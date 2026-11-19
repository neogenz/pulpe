import { router, useNavigationContainerRef } from "expo-router";
import { StackActions } from "expo-router/react-navigation";

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

interface NavigatorState {
  key?: string;
  index?: number;
  routes: readonly { name: string; state?: NavigatorState }[];
}

type ContainerRef = ReturnType<typeof useNavigationContainerRef>;

/** The stack that holds the tabs and the screens pushed over the bar. */
function stackOverTabs(
  state: NavigatorState | undefined,
): NavigatorState | undefined {
  if (state === undefined) return undefined;
  if (state.routes.some((route) => route.name === TABS_SEGMENT)) return state;
  for (const route of state.routes) {
    const found = stackOverTabs(route.state);
    if (found !== undefined) return found;
  }
  return undefined;
}

function tabsState(state: NavigatorState | undefined) {
  return stackOverTabs(state)?.routes.find(
    (route) => route.name === TABS_SEGMENT,
  )?.state;
}

/**
 * The tab left focused under the screens pushed over the bar: `(budgets)`
 * under a form opened from Budgets. Only a tab holding a stack is one: a
 * single-screen tab has nothing to push a page onto.
 */
export function tabGroupUnder(
  state: NavigatorState | undefined,
): string | undefined {
  const tabs = tabsState(state);
  const name = tabs?.routes[tabs.index ?? 0]?.name;
  return name !== undefined && GROUP.test(name) ? name : undefined;
}

/** Pops a stack to its first screen; a stack already there is left alone. */
function popToRoot(
  navigation: ContainerRef,
  stack: NavigatorState | undefined,
): void {
  if (stack?.key === undefined || (stack.index ?? 0) === 0) return;
  navigation.dispatch({ ...StackActions.popToTop(), target: stack.key });
}

/** Closes every screen pushed over the bar: a form, the post-onboarding step. */
export function closeScreensOverBar(navigation: ContainerRef): void {
  popToRoot(navigation, stackOverTabs(navigation.getRootState()));
}

/**
 * Takes tabs back to their root, whether or not they are showing; every tab
 * when none is named. A tab never opened has no stack and nothing to pop.
 */
export function popTabsToRoot(
  navigation: ContainerRef,
  groups?: readonly string[],
): void {
  for (const route of tabsState(navigation.getRootState())?.routes ?? []) {
    if (groups === undefined || groups.includes(route.name)) {
      popToRoot(navigation, route.state);
    }
  }
}

/**
 * Shows a tab at its root from anywhere: a shortcut to Objectifs from Accueil,
 * a link to the expense form on Accueil. The tab may still hold a page opened
 * earlier; going there as is would show that page, and pushing its root would
 * stack a second root over it for back to walk through.
 */
export function useShowTabRoot(): (tab: "home" | "goals") => void {
  const navigation = useNavigationContainerRef();
  return (tab) => {
    closeScreensOverBar(navigation);
    popTabsToRoot(navigation, [`(${tab})`]);
    router.navigate(`/${tab}`);
  };
}
