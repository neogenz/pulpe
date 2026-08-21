import { armTip, dismissTip, useTipsStore } from "./tips-store";

beforeEach(() => {
  useTipsStore.setState({ dismissedIds: [], armedIds: [] });
});

describe("tips store", () => {
  it("should keep a dismissed tip dismissed", () => {
    dismissTip("gestures");

    expect(useTipsStore.getState().dismissedIds).toEqual(["gestures"]);
  });

  it("should not duplicate a tip dismissed twice", () => {
    dismissTip("checking");
    dismissTip("checking");

    expect(useTipsStore.getState().dismissedIds).toEqual(["checking"]);
  });

  it("should leave the other tips alone", () => {
    dismissTip("gestures");
    armTip("pessimistic-check");

    expect(useTipsStore.getState().dismissedIds).not.toContain(
      "pessimistic-check",
    );
    expect(useTipsStore.getState().armedIds).toEqual(["pessimistic-check"]);
  });
});
