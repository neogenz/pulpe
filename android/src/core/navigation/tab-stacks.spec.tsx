import { router, Stack, Tabs } from "expo-router";
import {
  act,
  fireEvent,
  renderRouter,
  screen,
} from "expo-router/testing-library";
import { Pressable, View } from "react-native";

import TabStackLayout, {
  unstable_settings,
} from "@/app/(main)/(tabs)/(home,budgets,goals,templates)/_layout";
import { NavigationBar } from "@/core/ui/navigation-bar";
import {
  leaveDeletedMonth,
  useOpenMonthInOpeningTab,
} from "@/features/budgets/month-navigation";

/**
 * The real per-tab stack layout on the real router, with the app's route
 * tree: what is observed is which tab a detail screen lands in, which only
 * the router's shared-route matching decides.
 */
function MainLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}

function TabsLayout() {
  return (
    <Tabs
      tabBar={(props) => <NavigationBar {...props} />}
      screenOptions={{ headerShown: false }}
    />
  );
}

function stub(testID: string) {
  return function Screen() {
    return <View testID={testID} />;
  };
}

function CreateForm() {
  const openMonth = useOpenMonthInOpeningTab();
  return <Pressable testID="create" onPress={() => openMonth("new")} />;
}

const SHARED = "(main)/(tabs)/(home,budgets,goals,templates)";

const context = {
  "(main)/_layout": MainLayout,
  "(main)/budget/create": CreateForm,
  "(main)/budget/plan": stub("budget-plan"),
  "(main)/(tabs)/_layout": TabsLayout,
  "(main)/(tabs)/net-worth": stub("net-worth"),
  [`${SHARED}/_layout`]: { default: TabStackLayout, unstable_settings },
  [`${SHARED}/budget/[id]`]: stub("budget-detail"),
  [`${SHARED}/budget/[id]/line/[lineId]`]: stub("line-detail"),
  [`${SHARED}/goal/[id]`]: stub("goal-detail"),
  "(main)/(tabs)/(home)/home": stub("home"),
  "(main)/(tabs)/(home)/settings/index": stub("settings"),
  "(main)/(tabs)/(budgets)/budgets": stub("budgets"),
  "(main)/(tabs)/(goals)/goals": stub("goals"),
  "(main)/(tabs)/(templates)/templates": stub("templates"),
  "(main)/(tabs)/(templates)/template/[id]": stub("template-detail"),
};

const TABS = ["(main)", "(tabs)"];

// RNTL 14 renders asynchronously: `renderRouter` hands back the pending render
// with the router getters attached, so the promise is awaited and kept.

it.each([
  ["/budgets", "(budgets)"],
  ["/home", "(home)"],
  ["/goals", "(goals)"],
  ["/templates", "(templates)"],
])("a month opened from %s stays in that tab", async (tab, group) => {
  const view = renderRouter(context, { initialUrl: tab });
  await view;

  await act(() => router.push("/budget/nov"));

  expect(screen.getByTestId("budget-detail")).toBeTruthy();
  expect(view.getSegments()).toEqual([...TABS, group, "budget", "[id]"]);

  await act(() => router.push("/budget/nov/line/rent"));
  expect(view.getSegments()).toEqual([
    ...TABS,
    group,
    "budget",
    "[id]",
    "line",
    "[lineId]",
  ]);

  await act(() => router.back());
  await act(() => router.back());
  expect(view.getPathname()).toBe(tab);
});

it("opens a link from outside any tab in Budgets, over its list", async () => {
  const view = renderRouter(context, {
    initialUrl: "/(budgets)/budget/nov",
  });
  await view;

  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budget", "[id]"]);

  await act(() => router.back());
  expect(screen.getByTestId("budgets")).toBeTruthy();
});

it("keeps the screens of one tab in that tab", async () => {
  const view = renderRouter(context, { initialUrl: "/home" });
  await view;

  await act(() => router.push("/settings"));
  expect(view.getSegments()).toEqual([...TABS, "(home)", "settings"]);

  await act(() => router.navigate("/templates"));
  await act(() => router.push("/template/t1"));
  expect(view.getSegments()).toEqual([
    ...TABS,
    "(templates)",
    "template",
    "[id]",
  ]);
});

it("still covers the bar with the create and plan forms", async () => {
  const view = renderRouter(context, { initialUrl: "/budgets" });
  await view;

  await act(() => router.push("/budget/create"));
  expect(screen.getByTestId("create")).toBeTruthy();
  expect(view.getSegments()).toEqual(["(main)", "budget", "create"]);

  await act(() => router.back());
  await act(() => router.push("/budget/plan"));
  expect(view.getSegments()).toEqual(["(main)", "budget", "plan"]);
});

// Paper keeps the bar at `pointerEvents="none"` until it has measured itself,
// which needs the layout event the test renderer never sends.
async function pressTab(tab: string) {
  await fireEvent(screen.getByTestId("bottom-navigation-bar"), "layout", {
    nativeEvent: { layout: { width: 400, height: 80 } },
  });
  await fireEvent.press(screen.getByTestId(`tab-${tab}`));
  // The stack pops to its root on the frame after the press.
  await act(() => jest.runOnlyPendingTimers());
}

it("keeps a tab's screens across a switch, and pops them on a second tap", async () => {
  const view = renderRouter(context, { initialUrl: "/budgets" });
  await view;
  await act(() => router.push("/budget/nov"));

  await pressTab("home");
  expect(view.getSegments()).toEqual([...TABS, "(home)", "home"]);

  await pressTab("budgets");
  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budget", "[id]"]);

  await pressTab("budgets");
  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budgets"]);
});

it.each([
  ["/budgets", "(budgets)"],
  ["/home", "(home)"],
])(
  "opens a month created from %s in that tab, the form closed",
  async (tab, group) => {
    const view = renderRouter(context, { initialUrl: tab });
    await view;
    await act(() => router.push("/budget/create"));

    await fireEvent.press(screen.getByTestId("create"));

    expect(view.getSegments()).toEqual([...TABS, group, "budget", "[id]"]);
    await act(() => router.back());
    expect(view.getPathname()).toBe(tab);
    expect(screen.queryByTestId("create")).toBeNull();
  },
);

it("opens a link in Budgets from any tab", async () => {
  const view = renderRouter(context, { initialUrl: "/goals" });
  await view;

  await act(() => router.push("/(budgets)/budget/nov", { withAnchor: true }));

  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budget", "[id]"]);
  await act(() => router.back());
  expect(view.getPathname()).toBe("/budgets");
});

it.each([["/budgets"], ["/home"]])(
  "leaves a month deleted from %s for the Budgets list",
  async (tab) => {
    const view = renderRouter(context, { initialUrl: tab });
    await view;
    await act(() => router.push("/budget/nov"));

    await act(() => leaveDeletedMonth());

    expect(view.getPathname()).toBe("/budgets");
    expect(view.getSearchParams()).toEqual({ deletedMonth: "1" });
    expect(screen.queryByTestId("budget-detail")).toBeNull();

    // The tab the month was deleted from no longer holds it either.
    await pressTab("home");
    expect(view.getPathname()).toBe("/home");
  },
);

it("closes the plan form onto the Budgets list with its counts", async () => {
  const view = renderRouter(context, { initialUrl: "/budgets" });
  await view;
  await act(() => router.push("/budget/plan"));

  await act(() =>
    router.dismissTo({ pathname: "/budgets", params: { createdCount: "2" } }),
  );

  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budgets"]);
  expect(view.getSearchParams()).toEqual({ createdCount: "2" });
});

it("closes the create form onto the Modèles tab", async () => {
  const view = renderRouter(context, { initialUrl: "/home" });
  await view;
  await act(() => router.push("/budget/create"));

  await act(() => router.dismissTo("/templates"));

  expect(view.getSegments()).toEqual([...TABS, "(templates)", "templates"]);
  expect(screen.queryByTestId("create")).toBeNull();
});
