import { captureEvent } from "./analytics";
import {
  authErrorKind,
  captureLoginFailed,
  captureOnboardingHandoffCompleted,
  captureReminderToggled,
  captureSignupFailed,
} from "./product-events";

jest.mock("./analytics", () => ({ captureEvent: jest.fn() }));

describe("authErrorKind", () => {
  it("shares iOS's value space for provider codes", () => {
    expect(authErrorKind({ code: "invalid_credentials" })).toBe(
      "invalidCredentials",
    );
    expect(authErrorKind({ code: "account_exists" })).toBe(
      "userAlreadyRegistered",
    );
    expect(authErrorKind({ name: "AuthRetryableFetchError" })).toBe("network");
  });

  it("falls back to unknown rather than sending the message", () => {
    expect(authErrorKind(new Error("boom"))).toBe("unknown");
    expect(authErrorKind("boom")).toBe("unknown");
  });
});

describe("product events", () => {
  it("sends the kind of a failure, never its message", () => {
    captureLoginFailed("email", {
      code: "invalid_credentials",
      message: "secret",
    });
    captureSignupFailed("email", new Error("boom"));

    expect(captureEvent).toHaveBeenCalledWith("login_failed", {
      method: "email",
      error_kind: "invalidCredentials",
    });
    expect(captureEvent).toHaveBeenCalledWith("signup_failed", {
      method: "email",
      error_kind: "unknown",
    });
  });

  it("keeps the iOS payload shapes", () => {
    captureReminderToggled("monthly", true);
    captureOnboardingHandoffCompleted();

    expect(captureEvent).toHaveBeenCalledWith("reminder_toggled", {
      enabled: true,
      reminder: "monthly",
    });
    expect(captureEvent).toHaveBeenCalledWith("onboarding_handoff_completed", {
      widget_help_opened: false,
    });
  });
});
