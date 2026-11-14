import { captureFirstTransactionCreated } from "@/core/observability/product-events";

import {
  loadFirstMovementState,
  recordMovementCreated,
  resetFirstMovementTracker,
} from "./first-movement-tracker";

jest.mock("@/core/observability/product-events", () => ({
  captureFirstTransactionCreated: jest.fn(),
}));

beforeEach(() => {
  jest.clearAllMocks();
  resetFirstMovementTracker();
});

describe("first movement tracker", () => {
  it("should emit once when the server says the account has no movement yet", async () => {
    await loadFirstMovementState(() => Promise.resolve(false));

    recordMovementCreated("expense", "add_button");
    recordMovementCreated("expense", "add_button");

    expect(captureFirstTransactionCreated).toHaveBeenCalledTimes(1);
    expect(captureFirstTransactionCreated).toHaveBeenCalledWith(
      "expense",
      "add_button",
    );
  });

  it("should not emit for an account another device already used", async () => {
    await loadFirstMovementState(() => Promise.resolve(true));

    recordMovementCreated("income", "budget_details");

    expect(captureFirstTransactionCreated).not.toHaveBeenCalled();
  });

  it("should not emit while the answer is unknown", async () => {
    await loadFirstMovementState(() => Promise.reject(new Error("offline")));

    recordMovementCreated("expense", "budget_details");

    expect(captureFirstTransactionCreated).not.toHaveBeenCalled();
  });

  it("should start over after the identity changes", async () => {
    await loadFirstMovementState(() => Promise.resolve(false));
    recordMovementCreated("expense", "budget_details");
    resetFirstMovementTracker();

    await loadFirstMovementState(() => Promise.resolve(false));
    recordMovementCreated("saving", "budget_details");

    expect(captureFirstTransactionCreated).toHaveBeenCalledTimes(2);
  });
});
