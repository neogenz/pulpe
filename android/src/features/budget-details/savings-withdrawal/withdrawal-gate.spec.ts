import { repaymentPeriod, shouldOfferWithdrawal } from "./withdrawal-gate";

jest.mock("react-native-mmkv", () => ({
  createMMKV: () => ({ getString: () => "", set: () => undefined }),
}));

const NOW = new Date();
const CURRENT = { year: NOW.getFullYear(), month: NOW.getMonth() + 1 };
const PAST =
  CURRENT.month === 1
    ? { year: CURRENT.year - 1, month: 12 }
    : { year: CURRENT.year, month: CURRENT.month - 1 };

describe("shouldOfferWithdrawal", () => {
  it("offers on a month in deficit", () => {
    expect(
      shouldOfferWithdrawal({
        available: -120,
        viewedPeriod: CURRENT,
        payDayOfMonth: null,
        isDismissed: false,
      }),
    ).toBe(true);
  });

  it("says nothing when the month holds", () => {
    expect(
      shouldOfferWithdrawal({
        available: 40,
        viewedPeriod: CURRENT,
        payDayOfMonth: null,
        isDismissed: false,
      }),
    ).toBe(false);
  });

  // A month already lived through cannot be covered after the fact.
  it("stays quiet on a month that is behind", () => {
    expect(
      shouldOfferWithdrawal({
        available: -120,
        viewedPeriod: PAST,
        payDayOfMonth: null,
        isDismissed: false,
      }),
    ).toBe(false);
  });

  it("respects a « plus tard »", () => {
    expect(
      shouldOfferWithdrawal({
        available: -120,
        viewedPeriod: CURRENT,
        payDayOfMonth: null,
        isDismissed: true,
      }),
    ).toBe(false);
  });
});

describe("repaymentPeriod", () => {
  it("takes the next month", () => {
    expect(repaymentPeriod({ year: 2026, month: 8 })).toEqual({
      year: 2026,
      month: 9,
    });
  });

  it("rolls over the year in December", () => {
    expect(repaymentPeriod({ year: 2026, month: 12 })).toEqual({
      year: 2027,
      month: 1,
    });
  });
});
