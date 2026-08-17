import { readFileSync } from "@/core/testing/source-files";

const route = readFileSync("src/app/reset-password.tsx", "utf8");

describe("password reset route", () => {
  it("revokes the recovery session before showing success", () => {
    const update = route.indexOf("await updatePassword(password)");
    const revoke = route.indexOf("await endRecovery()", update);
    const done = route.indexOf('setPhase({ kind: "done" })', revoke);

    expect(update).toBeGreaterThan(-1);
    expect(revoke).toBeGreaterThan(update);
    expect(done).toBeGreaterThan(revoke);
  });

  it("routes Android Back through the same recovery exit", () => {
    const backHandler = route.indexOf('"hardwareBackPress"');
    const leave = route.indexOf("void leave()", backHandler);

    expect(backHandler).toBeGreaterThan(-1);
    expect(leave).toBeGreaterThan(backHandler);
  });
});
