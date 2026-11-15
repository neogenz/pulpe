jest.mock("@/core/observability/product-events", () => ({
  captureStoreReviewRequested: jest.fn(),
}));

type PromptModule = typeof import("./store-review-prompt");
type EventsModule = typeof import("@/core/observability/product-events");

/** A fresh module per test: the in-memory MMKV store lives as long as the module. */
function loadPrompt(): { prompt: PromptModule; events: EventsModule } {
  let loaded: { prompt: PromptModule; events: EventsModule } | undefined;
  jest.isolateModules(() => {
    loaded = {
      prompt: jest.requireActual<PromptModule>("./store-review-prompt"),
      events: jest.requireMock<EventsModule>(
        "@/core/observability/product-events",
      ),
    };
  });
  return loaded!;
}

async function recordMovements(
  prompt: PromptModule,
  times: number,
  appVersion: string,
  requestReview: () => Promise<boolean>,
): Promise<void> {
  for (let i = 0; i < times; i += 1) {
    await prompt.recordMovementForStoreReview({
      appVersion,
      waitForCalmMoment: () => Promise.resolve(),
      requestReview,
    });
  }
}

describe("store review prompt", () => {
  it("should ask on the fifth movement, then not again on the same version", async () => {
    const { prompt, events } = loadPrompt();
    const requestReview = jest.fn(() => Promise.resolve(true));
    const threshold = prompt.MOVEMENTS_BEFORE_REQUEST;

    await recordMovements(prompt, threshold - 1, "0.61.0", requestReview);
    expect(requestReview).not.toHaveBeenCalled();

    await recordMovements(prompt, 1, "0.61.0", requestReview);
    expect(requestReview).toHaveBeenCalledTimes(1);
    expect(events.captureStoreReviewRequested).toHaveBeenCalledWith(
      "automatic",
    );

    await recordMovements(prompt, 10, "0.61.0", requestReview);
    expect(requestReview).toHaveBeenCalledTimes(1);
  });

  it("should ask again after five movements on the next version", async () => {
    const { prompt } = loadPrompt();
    const requestReview = jest.fn(() => Promise.resolve(true));
    const threshold = prompt.MOVEMENTS_BEFORE_REQUEST;

    await recordMovements(prompt, threshold, "0.61.0", requestReview);
    await recordMovements(prompt, threshold - 1, "0.62.0", requestReview);
    expect(requestReview).toHaveBeenCalledTimes(1);

    await recordMovements(prompt, 1, "0.62.0", requestReview);
    expect(requestReview).toHaveBeenCalledTimes(2);
  });

  it("should retry on the next movement when no card could be asked for", async () => {
    const { prompt, events } = loadPrompt();
    const requestReview = jest
      .fn<Promise<boolean>, []>()
      .mockResolvedValueOnce(false)
      .mockResolvedValue(true);

    await recordMovements(
      prompt,
      prompt.MOVEMENTS_BEFORE_REQUEST,
      "0.61.0",
      requestReview,
    );
    expect(events.captureStoreReviewRequested).not.toHaveBeenCalled();

    await recordMovements(prompt, 1, "0.61.0", requestReview);
    expect(requestReview).toHaveBeenCalledTimes(2);
    expect(events.captureStoreReviewRequested).toHaveBeenCalledTimes(1);
  });
});
