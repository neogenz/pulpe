import { shouldLeaveNetWorthTab, withoutNetWorthTab } from "./net-worth-tab";

const routes = ["home", "budgets", "goals", "net-worth", "templates"].map(
  (name) => ({ key: `${name}-k`, name }),
);

describe("withoutNetWorthTab", () => {
  it("keeps four tabs and the focused one", () => {
    const state = withoutNetWorthTab({ index: 4, routes });

    expect(state.routes.map((r) => r.name)).toEqual([
      "home",
      "budgets",
      "goals",
      "templates",
    ]);
    expect(state.index).toBe(3);
  });

  it("falls back to the first tab when the hidden one was focused", () => {
    expect(withoutNetWorthTab({ index: 3, routes }).index).toBe(0);
  });
});

describe("shouldLeaveNetWorthTab", () => {
  it("only when the flag is off and the tab is the current screen", () => {
    expect(
      shouldLeaveNetWorthTab(false, ["(main)", "(tabs)", "net-worth"]),
    ).toBe(true);
    expect(
      shouldLeaveNetWorthTab(true, ["(main)", "(tabs)", "net-worth"]),
    ).toBe(false);
    expect(shouldLeaveNetWorthTab(false, ["(main)", "(tabs)", "home"])).toBe(
      false,
    );
  });
});
