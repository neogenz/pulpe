import { currentTab, screenName, tabGroupUnder, tabKey } from "./tab-route";

describe("tabKey", () => {
  it("reads a stack tab and a single-screen tab the same way", () => {
    expect(tabKey("(budgets)")).toBe("budgets");
    expect(tabKey("budgets")).toBe("budgets");
    expect(tabKey("net-worth")).toBe("net-worth");
  });
});

describe("currentTab", () => {
  it("is the tab under (tabs), not the last segment", () => {
    expect(currentTab(["(main)", "(tabs)", "(budgets)", "budgets"])).toBe(
      "budgets",
    );
    expect(
      currentTab(["(main)", "(tabs)", "(budgets)", "budget", "[id]"]),
    ).toBe("budgets");
    expect(currentTab(["(main)", "(tabs)", "net-worth"])).toBe("net-worth");
  });

  it("is undefined on a screen pushed over the bar", () => {
    expect(currentTab(["(main)", "budget", "create"])).toBeUndefined();
    expect(currentTab([])).toBeUndefined();
  });
});

describe("screenName", () => {
  // Each pair: segments once the details live inside the tabs, and the name
  // analytics received before the move.
  it.each([
    [["(main)", "(tabs)", "(home)", "home"], "(main)/(tabs)/home"],
    [["(main)", "(tabs)", "(budgets)", "budgets"], "(main)/(tabs)/budgets"],
    [["(main)", "(tabs)", "net-worth"], "(main)/(tabs)/net-worth"],
    [["(main)", "(tabs)", "(budgets)", "budget", "[id]"], "(main)/budget/[id]"],
    [["(main)", "(tabs)", "(home)", "budget", "[id]"], "(main)/budget/[id]"],
    [
      ["(main)", "(tabs)", "(goals)", "budget", "[id]", "line", "[lineId]"],
      "(main)/budget/[id]/line/[lineId]",
    ],
    [["(main)", "(tabs)", "(home)", "settings"], "(main)/settings"],
    [
      ["(main)", "(tabs)", "(templates)", "template", "[id]"],
      "(main)/template/[id]",
    ],
    [["(main)", "budget", "create"], "(main)/budget/create"],
    [["(auth)", "sign-in"], "(auth)/sign-in"],
  ])("%j → %s", (segments, name) => {
    expect(screenName(segments)).toBe(name);
  });
});

describe("tabGroupUnder", () => {
  const under = (index: number) => ({
    routes: [
      {
        name: "(tabs)",
        state: {
          index,
          routes: [
            { name: "(home)" },
            { name: "(budgets)" },
            { name: "net-worth" },
          ],
        },
      },
      { name: "budget/create" },
    ],
  });

  it("is the tab group focused under a screen pushed over the bar", () => {
    expect(tabGroupUnder(under(1))).toBe("(budgets)");
    expect(tabGroupUnder(under(0))).toBe("(home)");
  });

  it("is undefined for a single-screen tab or no tabs at all", () => {
    expect(tabGroupUnder(under(2))).toBeUndefined();
    expect(
      tabGroupUnder({ routes: [{ name: "budget/create" }] }),
    ).toBeUndefined();
    expect(tabGroupUnder(undefined)).toBeUndefined();
  });
});
