import {
  buildAdjustmentPayload,
  parseAccountAmount,
  reconciliationVerdict,
  summarizeAccounts,
} from "./reconciliation";

describe("parseAccountAmount", () => {
  it.each([
    ["1234.56", 123456],
    ["1234,56", 123456],
    ["0.1", 10],
    ["-0.01", -1],
    ["-80.5", -8050],
    ["−12", -1200],
    [" 42 ", 4200],
    ["999999999.99", 99999999999],
  ])("reads %j as %d cents", (text, cents) => {
    expect(parseAccountAmount(text)).toEqual({ status: "valid", cents });
  });

  it.each(["", "   "])("treats %j as a blank amount", (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: "blank" });
  });

  it.each([
    "-",
    "12.",
    ",5",
    "1.234",
    "1e3",
    "Infinity",
    "NaN",
    "12abc",
    "1 000",
    "1.2.3",
    "--5",
    "+5",
    "1000000000",
  ])("refuses %j instead of reading it as zero", (text) => {
    expect(parseAccountAmount(text)).toEqual({ status: "invalid" });
  });
});

describe("summarizeAccounts", () => {
  it("totals several accounts, overdraft included, to the cent", () => {
    expect(summarizeAccounts(["0.1", "0.2", "-0.3", "1500", "-0.01"])).toEqual({
      totalCents: 149999,
      canContinue: true,
    });
  });

  it("ignores blank rows next to a valid amount", () => {
    expect(summarizeAccounts(["", "250.40", "  "])).toEqual({
      totalCents: 25040,
      canContinue: true,
    });
  });

  it("holds the user back while no amount is typed", () => {
    expect(summarizeAccounts(["", " "])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });

  it("does not let a valid or blank row conceal an invalid one", () => {
    expect(summarizeAccounts(["1200", "", "12."])).toEqual({
      totalCents: null,
      canContinue: false,
    });
  });
});

describe("reconciliationVerdict", () => {
  it("proposes an income for what the accounts hold beyond the balance", () => {
    expect(reconciliationVerdict(150_000, 1499.99)).toEqual({
      kind: "income",
      amount: 0.01,
    });
  });

  it("proposes an expense for what the accounts are missing", () => {
    expect(reconciliationVerdict(-5_000, 120.3)).toEqual({
      kind: "expense",
      amount: 170.3,
    });
  });

  it("settles 0.1 + 0.2 against 0.30 as up to date, with no tolerance", () => {
    expect(reconciliationVerdict(30, 0.1 + 0.2)).toEqual({ kind: "upToDate" });
    expect(reconciliationVerdict(31, 0.3)).toEqual({
      kind: "income",
      amount: 0.01,
    });
    expect(reconciliationVerdict(29, 0.3)).toEqual({
      kind: "expense",
      amount: 0.01,
    });
  });
});

describe("buildAdjustmentPayload", () => {
  it("writes one checked, free entry on the active budget", () => {
    const now = new Date("2026-10-02T09:30:00.000Z");

    expect(
      buildAdjustmentPayload({
        budgetId: "budget-1",
        name: "  Ajustement ",
        adjustment: { kind: "expense", amount: 170.3 },
        now,
      }),
    ).toEqual({
      budgetId: "budget-1",
      name: "Ajustement",
      amount: 170.3,
      kind: "expense",
      transactionDate: "2026-10-02T09:30:00.000Z",
      checkedAt: "2026-10-02T09:30:00.000Z",
    });
  });
});
