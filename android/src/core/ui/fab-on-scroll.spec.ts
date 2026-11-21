import { nextFabScrollState } from "./fab-on-scroll";

function run(offsets: number[], end = Number.POSITIVE_INFINITY) {
  return offsets.reduce(
    (state, offset) => nextFabScrollState(state, offset, offset >= end),
    { isVisible: true, anchor: 0 },
  ).isVisible;
}

it("steps aside once the list has gone down far enough", () => {
  expect(run([4, 8, 12, 16, 20])).toBe(true);
  expect(run([10, 20, 30])).toBe(false);
});

it("comes back as soon as the list goes up", () => {
  expect(run([10, 40, 80, 70, 60, 50])).toBe(true);
  expect(run([10, 40, 80, 75])).toBe(false);
});

it("is always there at the top and at the end", () => {
  expect(run([40, 80, 0])).toBe(true);
  expect(run([40, 80, 120], 120)).toBe(true);
});
