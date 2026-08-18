import { readFileSync } from "@/core/testing/source-files";

const route = readFileSync("src/app/reset-password.tsx", "utf8");

describe("password reset route", () => {
  it("revokes the recovery session before showing success", () => {
    const update = route.indexOf("await updatePassword(password)");
    const revoke = route.indexOf("await endRecovery()", update);
    const done = route.indexOf('providerError === null ? "done"', revoke);

    expect(update).toBeGreaterThan(-1);
    expect(revoke).toBeGreaterThan(update);
    expect(done).toBeGreaterThan(revoke);
  });

  it("does not submit a changed password twice when teardown fails", () => {
    const guard = route.indexOf("if (hasChangedPassword.current) return");
    const update = route.indexOf("await updatePassword(password)", guard);
    const changed = route.indexOf("hasChangedPassword.current = true", update);
    const failure = route.indexOf(
      'setPhase({ kind: "securityError" })',
      changed,
    );

    expect(guard).toBeGreaterThan(-1);
    expect(update).toBeGreaterThan(guard);
    expect(changed).toBeGreaterThan(update);
    expect(failure).toBeGreaterThan(changed);
  });

  it("routes Android Back through the same recovery exit", () => {
    const backHandler = route.indexOf('"hardwareBackPress"');
    const leave = route.indexOf("void leave()", backHandler);

    expect(backHandler).toBeGreaterThan(-1);
    expect(leave).toBeGreaterThan(backHandler);
  });
});
