/**
 * MMKV binds to a Nitro native module, which no JS test environment can load.
 * The store it backs is a plain key-value map, so an in-memory one is a
 * faithful stand-in — and without it every spec that transitively imports a
 * persisted preference fails on the require, not on anything it tests.
 */
jest.mock("react-native-mmkv", () => ({
  createMMKV: () => {
    const values = new Map();
    return {
      set: (key, value) => values.set(key, value),
      getBoolean: (key) => values.get(key),
      getString: (key) => values.get(key),
      getNumber: (key) => values.get(key),
      delete: (key) => values.delete(key),
      remove: (key) => values.delete(key),
    };
  },
}));

/**
 * The swipeable runs on Reanimated's worklets, whose native module no JS test
 * environment can load. No spec can drag a finger anyway, so every row renders
 * its content as is; `swipe-to-point.spec.tsx` replaces this to drive the
 * swipeable's callbacks directly.
 */
jest.mock("react-native-gesture-handler/ReanimatedSwipeable", () => {
  const { forwardRef, useImperativeHandle } = jest.requireActual("react");
  const Swipeable = forwardRef(({ children }, ref) => {
    useImperativeHandle(ref, () => ({
      close: () => undefined,
      openLeft: () => undefined,
      openRight: () => undefined,
      reset: () => undefined,
    }));
    return children;
  });
  return { __esModule: true, default: Swipeable };
});
