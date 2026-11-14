import type { User } from "@supabase/supabase-js";

import { sessionFirstName } from "./session-first-name";

const userWith = (user_metadata: Record<string, unknown>) =>
  ({ user_metadata }) as User;

describe("sessionFirstName", () => {
  it("reads the e-mail signup's name, then Google's", () => {
    expect(sessionFirstName(userWith({ firstName: " Léa " }))).toBe("Léa");
    expect(sessionFirstName(userWith({ full_name: "Léa Martin" }))).toBe("Léa");
  });

  it("answers null without a usable name", () => {
    expect(sessionFirstName(userWith({ firstName: "  " }))).toBeNull();
    expect(sessionFirstName(null)).toBeNull();
  });
});
