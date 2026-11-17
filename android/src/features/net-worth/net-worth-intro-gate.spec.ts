import {
  hasSeenNetWorthIntro,
  markNetWorthIntroSeen,
} from "./net-worth-intro-gate";

jest.mock("react-native-mmkv", () => {
  const storage = new Map<string, boolean>();
  return {
    createMMKV: () => ({
      getBoolean: (key: string) => storage.get(key),
      set: (key: string, value: boolean) => storage.set(key, value),
    }),
  };
});

describe("net-worth intro gate", () => {
  it("is unseen until marked, then stays seen", () => {
    expect(hasSeenNetWorthIntro()).toBe(false);

    markNetWorthIntroSeen();

    expect(hasSeenNetWorthIntro()).toBe(true);
  });
});
