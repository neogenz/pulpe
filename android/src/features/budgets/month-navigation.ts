import { router, useNavigation } from "expo-router";

import { tabGroupUnder } from "@/core/navigation/tab-route";

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
 * Leaves a month that no longer exists. The tab showing it goes back to its
 * root, as iOS pops it, so no page of the month stays behind to come back to
 * (the stack can even hold it twice: a rollover push, then the pager's
 * replace). The Budgets list then says « Mois supprimé », as web and iOS do.
 */
export function leaveDeletedMonth(): void {
  router.dismissAll();
  router.navigate({ pathname: "/budgets", params: { deletedMonth: "1" } });
}
