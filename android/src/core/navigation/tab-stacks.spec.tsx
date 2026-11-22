import { router, Slot, Stack, Tabs } from "expo-router";
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
import { useShowTabRoot } from "@/core/navigation/tab-route";
import { sourceFiles } from "@/core/testing/source-files";
import { NavigationBar } from "@/core/ui/navigation-bar";
import {
  useLeaveDeletedMonth,
  useOpenLinkedMonth,
  useOpenMonthInOpeningTab,
} from "@/features/budgets/month-navigation";

/**
 * The real per-tab stack layout on the real router, with the app's route
 * tree: what is observed is which tab a detail screen lands in, which only
 * the router's shared-route matching decides.
 */
// Stands for the deep-link router, the delete action and the Accueil
// shortcuts, which can fire on any screen.
function RootLayout() {
  const openLinkedMonth = useOpenLinkedMonth();
  const leaveDeletedMonth = useLeaveDeletedMonth();
  const showTabRoot = useShowTabRoot();
  return (
    <>
      <Slot />
      <Pressable testID="follow-link" onPress={() => openLinkedMonth("nov")} />
      <Pressable testID="leave-deleted" onPress={leaveDeletedMonth} />
      <Pressable testID="show-goals" onPress={() => showTabRoot("goals")} />
      <Pressable testID="show-home" onPress={() => showTabRoot("home")} />
    </>
  );
}

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
  _layout: RootLayout,
  "(main)/_layout": MainLayout,
  "(main)/budget/create": CreateForm,
  "(main)/budget/plan": stub("budget-plan"),
  "(main)/(tabs)/_layout": TabsLayout,
  "(main)/(tabs)/net-worth": stub("net-worth"),
  [`${SHARED}/_layout`]: { default: TabStackLayout, unstable_settings },
  [`${SHARED}/budget/[id]`]: stub("budget-detail"),
  [`${SHARED}/budget/[id]/line/[lineId]`]: stub("line-detail"),
  [`${SHARED}/goal/[id]`]: stub("goal-detail"),
  [`${SHARED}/to-point`]: stub("to-point"),
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

interface RouteNode {
  name: string;
  state?: { routes: RouteNode[] };
}

/** The route names of the navigator under the route `name`, top-down. */
function routesUnder(view: ReturnType<typeof renderRouter>, name: string) {
  const find = (routes: RouteNode[]): RouteNode | undefined =>
    routes.reduce<RouteNode | undefined>(
      (found, route) =>
        found ??
        (route.name === name ? route : find(route.state?.routes ?? [])),
      undefined,
    );
  const root = view.getRouterState() as { routes: RouteNode[] } | undefined;
  return find(root?.routes ?? [])?.state?.routes.map((route) => route.name);
}

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

it("opens « À pointer » from a month inside that month's tab, and goes back to it", async () => {
  // The stub stands for the real route: back under (home), it would leave Budgets again.
  expect(sourceFiles(`src/app/${SHARED}`)).toContain(
    `src/app/${SHARED}/to-point.tsx`,
  );
  const view = renderRouter(context, { initialUrl: "/budgets" });
  await view;

  await act(() => router.push("/budget/nov"));
  await act(() => router.push("/to-point"));
  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "to-point"]);

  await act(() => router.back());
  expect(screen.getByTestId("budget-detail")).toBeTruthy();
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

it("opens a link in Budgets over its list, from any tab", async () => {
  const view = renderRouter(context, { initialUrl: "/goals" });
  await view;

  await fireEvent.press(screen.getByTestId("follow-link"));

  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budget", "[id]"]);
  await act(() => router.back());
  expect(view.getPathname()).toBe("/budgets");
});

it("opens a link right over the Budgets list, whatever Budgets held", async () => {
  const view = renderRouter(context, { initialUrl: "/budgets" });
  await view;
  await act(() => router.push("/budget/dec/line/rent"));
  await act(() => router.navigate("/home"));

  await fireEvent.press(screen.getByTestId("follow-link"));

  expect(routesUnder(view, "(budgets)")).toEqual(["budgets", "budget/[id]"]);
});

it("closes a form over the bar before opening a link", async () => {
  const view = renderRouter(context, { initialUrl: "/home" });
  await view;
  await act(() => router.push("/budget/create"));

  await fireEvent.press(screen.getByTestId("follow-link"));

  expect(view.getSegments()).toEqual([...TABS, "(budgets)", "budget", "[id]"]);
  // One tabs navigator: the form is gone, not covered by a second one.
  expect(routesUnder(view, "(main)")).toEqual(["(tabs)"]);
});

it.each([["/budgets"], ["/home"]])(
  "leaves a month deleted from %s for the Budgets list",
  async (tab) => {
    const view = renderRouter(context, { initialUrl: "/home" });
    await view;
    // The month is open in both tabs, Budgets with a page over it.
    await act(() => router.navigate("/budgets"));
    await act(() => router.push("/budget/nov/line/rent"));
    await act(() => router.navigate(tab));
    await act(() => router.push("/budget/nov"));

    await fireEvent.press(screen.getByTestId("leave-deleted"));

    expect(view.getPathname()).toBe("/budgets");
    expect(view.getSearchParams()).toEqual({ deletedMonth: "1" });
    expect(routesUnder(view, "(budgets)")).toEqual(["budgets"]);
    expect(routesUnder(view, "(home)")).toEqual(["home"]);
  },
);

it("shows the Objectifs list from Accueil, whatever Objectifs held", async () => {
  const view = renderRouter(context, { initialUrl: "/goals" });
  await view;
  await act(() => router.push("/goal/g1"));
  await act(() => router.navigate("/home"));

  await fireEvent.press(screen.getByTestId("show-goals"));

  expect(view.getSegments()).toEqual([...TABS, "(goals)", "goals"]);
  expect(routesUnder(view, "(goals)")).toEqual(["goals"]);
});

it("shows Accueil at its root, a form over the bar closed", async () => {
  const view = renderRouter(context, { initialUrl: "/home" });
  await view;
  await act(() => router.push("/settings"));
  await act(() => router.push("/budget/create"));

  await fireEvent.press(screen.getByTestId("show-home"));
  // A second press, as a double tap would, stacks nothing.
  await fireEvent.press(screen.getByTestId("show-home"));

  expect(view.getSegments()).toEqual([...TABS, "(home)", "home"]);
  expect(routesUnder(view, "(main)")).toEqual(["(tabs)"]);
  expect(routesUnder(view, "(home)")).toEqual(["home"]);
});

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
