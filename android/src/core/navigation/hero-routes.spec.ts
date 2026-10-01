import { isHeroPath } from "./hero-routes";

describe("isHeroPath", () => {
  it.each(["/home", "/budgets", "/budget/b-1", "/goal/g-1"])(
    "puts %s on the forest",
    (path) => {
      expect(isHeroPath(path)).toBe(true);
    },
  );

  it.each([
    "/goals",
    "/templates",
    "/budget/plan",
    "/budget/create",
    "/budget/b-1/line/l-1",
    "/template/t-1",
    "/settings",
    "/settings/preferences",
  ])("leaves %s on the canvas", (path) => {
    expect(isHeroPath(path)).toBe(false);
  });
});
