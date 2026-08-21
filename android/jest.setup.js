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
    };
  },
}));
