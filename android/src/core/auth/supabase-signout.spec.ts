import { signOutEverywhere, signOutThisDevice, supabase } from "./supabase";

const mockSignOut = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: () => ({ auth: {} }),
}));
jest.mock("@/core/config/env", () => ({
  ENV: { supabaseUrl: "https://example.supabase.co", supabaseAnonKey: "anon" },
}));

describe("Supabase sign-out", () => {
  beforeEach(() => {
    mockSignOut.mockReset();
    supabase.auth.signOut = mockSignOut;
  });

  it.each([
    ["local", signOutThisDevice],
    ["global", signOutEverywhere],
  ] as const)(
    "throws an error returned by the %s sign-out",
    async (scope, act) => {
      const error = new Error(`${scope} failed`);
      mockSignOut.mockResolvedValueOnce({ error });

      await expect(act()).rejects.toBe(error);
      expect(mockSignOut).toHaveBeenCalledWith({ scope });
    },
  );

  it("preserves an exception thrown by the auth client", async () => {
    const error = new Error("storage failed");
    mockSignOut.mockRejectedValueOnce(error);

    await expect(signOutThisDevice()).rejects.toBe(error);
  });
});
