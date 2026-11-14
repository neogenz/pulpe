import {
  isFeedbackPromptEligible,
  markFeedbackPromptShown,
  markFeedbackSubmitted,
  recordActiveDay,
} from "./feedback-prompt";

const day = (n: number) => new Date(2026, 10, n, 12);

function activeDays(userId: string, count: number, from = 1) {
  for (let n = from; n < from + count; n += 1) recordActiveDay(userId, day(n));
}

describe("automatic feedback prompt cadence", () => {
  it("waits for the third active day", () => {
    activeDays("a", 2);
    expect(isFeedbackPromptEligible("a")).toBe(false);

    activeDays("a", 1, 3);
    expect(isFeedbackPromptEligible("a")).toBe(true);
  });

  it("counts a day once however often the app opens", () => {
    recordActiveDay("b", day(1));
    recordActiveDay("b", day(1));
    recordActiveDay("b", day(1));
    expect(isFeedbackPromptEligible("b")).toBe(false);
  });

  it("asks again every three active days, numbering each invitation", () => {
    activeDays("c", 3);
    expect(markFeedbackPromptShown("c")).toBe(1);
    expect(isFeedbackPromptEligible("c")).toBe(false);

    activeDays("c", 2, 4);
    expect(isFeedbackPromptEligible("c")).toBe(false);

    activeDays("c", 1, 6);
    expect(isFeedbackPromptEligible("c")).toBe(true);
    expect(markFeedbackPromptShown("c")).toBe(2);
  });

  it("stops for good once the account answered, and keeps accounts apart", () => {
    activeDays("d", 3);
    activeDays("e", 3);
    markFeedbackSubmitted("d");

    expect(isFeedbackPromptEligible("d")).toBe(false);
    expect(isFeedbackPromptEligible("e")).toBe(true);
  });
});
