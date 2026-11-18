import { router, useNavigation, useNavigationContainerRef } from "expo-router";

import {
  closeScreensOverBar,
  popTabsToRoot,
  tabGroupUnder,
} from "@/core/navigation/tab-route";

/**
 * Closes a form pushed over the bar and opens a month in the tab the form was
 * opened from, as iOS does after creating one from the Budgets list. The tab
 * is named outright: until the back lands the router still reads the form's
 * own position, which belongs to no tab, and would pick one on its own.
 * `replace` is no way round it: it mints a second tabs navigator.
 */
export function useOpenMonthInOpeningTab(): (budgetId: string) => void {
  const navigation = useNavigation();
  return (budgetId) => {
    const tab = tabGroupUnder(navigation.getState()) ?? "(budgets)";
    router.back();
    router.push(`/${tab}/budget/${budgetId}`);
  };
}

/**
 * Leaves a month that no longer exists. Every tab goes back to its root, as
 * iOS pops the one showing it, so no page of the month stays behind to come
 * back to: a month can be open in several tabs, and twice in one (a rollover
 * push, then the pager's replace). The Budgets list then says « Mois
 * supprimé », as web and iOS do.
 */
export function useLeaveDeletedMonth(): () => void {
  const navigation = useNavigationContainerRef();
  return () => {
    popTabsToRoot(navigation);
    router.navigate({ pathname: "/budgets", params: { deletedMonth: "1" } });
  };
}

/**
 * Opens a month a link names, as iOS `openBudgetMonth` does: in Budgets,
 * right over its list, whichever tab is showing, since a link names a month
 * and not the tab it was shared from. A screen over the bar closes first, or
 * the push would open a second tabs navigator on top of it.
 */
export function useOpenLinkedMonth(): (budgetId: string) => void {
  const navigation = useNavigationContainerRef();
  return (budgetId) => {
    closeScreensOverBar(navigation);
    popTabsToRoot(navigation, ["(budgets)"]);
    router.push(`/(budgets)/budget/${budgetId}`, { withAnchor: true });
  };
}
