import Foundation
@testable import Pulpe
import Testing

/// "Rapprocher mes comptes" (PUL-351): what a typed balance reads as, what the
/// accounts add up to, and what the gap against the checked balance becomes.
struct AccountReconciliationTests {
    // MARK: - Parsing

    @Test("a blank amount is neither valid nor invalid", arguments: ["", "   "])
    func parseAmount_blank_isBlank(text: String) {
        #expect(AccountReconciliation.parseAmount(text) == .blank)
    }

    @Test("an amount reads to the cent", arguments: [
        ("12", 1_200),
        ("12,5", 1_250),
        ("12.05", 1_205),
        ("0.01", 1),
        (" 7 ", 700),
        ("0", 0),
        ("999999999.99", 99_999_999_999),
    ])
    func parseAmount_valid_readsCents(text: String, cents: Int) {
        #expect(AccountReconciliation.parseAmount(text) == .valid(cents: cents))
    }

    @Test("a typed or pasted minus reads as an overdraft", arguments: [
        ("-0.01", -1),
        ("\u{2212}40", -4_000),
        ("-12,30", -1_230),
    ])
    func parseAmount_minus_readsNegativeCents(text: String, cents: Int) {
        #expect(AccountReconciliation.parseAmount(text) == .valid(cents: cents))
    }

    @Test("a partial, malformed or out-of-range amount is refused, never read as zero", arguments: [
        "12.", ".5", "12,345", "1,234.5", "1'234", "1 234", "abc", "1e3", "12.3.4",
        "--5", "+5", "-", "1234567890", "NaN", "inf", "\u{0661}\u{0662}",
    ])
    func parseAmount_invalid_isRefused(text: String) {
        #expect(AccountReconciliation.parseAmount(text) == .invalid)
    }

    // MARK: - Negative balance (the decimal pad has no minus key)

    @Test("the negative switch makes a typed balance negative, and keeps a pasted minus negative")
    func account_negative_isAlwaysNegative() {
        #expect(account("40", isNegative: true).amount == .valid(cents: -4_000))
        #expect(account("-40", isNegative: true).amount == .valid(cents: -4_000))
        #expect(account("-40").amount == .valid(cents: -4_000))
        #expect(account("40").amount == .valid(cents: 4_000))
    }

    @Test("the negative switch never turns a blank or refused amount into a number")
    func account_negative_keepsBlankAndInvalid() {
        #expect(account("", isNegative: true).amount == .blank)
        #expect(account("12.", isNegative: true).amount == .invalid)
    }

    // MARK: - Total

    @Test("accounts add up in cents, so 0.1 + 0.2 is exactly 0.30")
    func totalCents_sumsWithoutDrift() {
        #expect(AccountReconciliation.totalCents(of: [account("0.1"), account("0.2")]) == 30)
    }

    @Test("a negative account is subtracted from the total")
    func totalCents_subtractsNegativeAccount() {
        let accounts = [account("1500.25"), account("200,50", isNegative: true), account("0.01")]
        #expect(AccountReconciliation.totalCents(of: accounts) == 129_976)
    }

    @Test("blank rows are skipped, and a zero balance is still a balance")
    func totalCents_skipsBlankRows() {
        #expect(AccountReconciliation.totalCents(of: [account(""), account("12"), account("  ")]) == 1_200)
        #expect(AccountReconciliation.totalCents(of: [account("0")]) == 0)
    }

    @Test("without one filled amount there is no total to compare")
    func totalCents_allBlank_isNil() {
        #expect(AccountReconciliation.totalCents(of: [account("")]) == nil)
        #expect(AccountReconciliation.totalCents(of: [account(""), account(" ")]) == nil)
    }

    @Test("one refused amount withholds the total, even hidden among blank rows")
    func totalCents_invalidAmongBlanks_isNil() {
        #expect(AccountReconciliation.totalCents(of: [account("100"), account(""), account("12.")]) == nil)
        #expect(AccountReconciliation.totalCents(of: [account(""), account("abc")]) == nil)
    }

    @Test("nine-digit balances on many accounts stay exact")
    func totalCents_largeBalances_stayExact() {
        let accounts = Array(repeating: account("999999999.99"), count: 3)
        #expect(AccountReconciliation.totalCents(of: accounts) == 299_999_999_997)
    }

    // MARK: - Verdict

    @Test("accounts equal to the checked balance to the cent are up to date")
    func verdict_sameCents_isUpToDate() throws {
        let realized = try #require(Decimal(string: "0.3"))
        #expect(AccountReconciliation.difference(totalCents: 30, realizedBalance: realized) == 0)
        #expect(AccountReconciliation.verdict(totalCents: 30, realizedBalance: realized) == .upToDate)
    }

    @Test("float noise on the checked balance is quantized to the cent before comparing")
    func verdict_floatNoise_isUpToDate() throws {
        let noisy = try #require(Decimal(string: "0.30000000000000004"))
        #expect(AccountReconciliation.verdict(totalCents: 30, realizedBalance: noisy) == .upToDate)
    }

    @Test("one cent more on the accounts is an income of one cent, with no tolerance")
    func verdict_oneCentMore_isIncome() throws {
        let realized = try #require(Decimal(string: "1250.40"))
        let cent = try #require(Decimal(string: "0.01"))
        #expect(AccountReconciliation.difference(totalCents: 125_041, realizedBalance: realized) == cent)
        #expect(
            AccountReconciliation.verdict(totalCents: 125_041, realizedBalance: realized)
                == .adjustment(kind: .income, amount: cent)
        )
    }

    @Test("one cent less on the accounts is an expense of one cent, never a saving")
    func verdict_oneCentLess_isExpense() throws {
        let realized = try #require(Decimal(string: "1250.40"))
        let cent = try #require(Decimal(string: "0.01"))
        #expect(AccountReconciliation.difference(totalCents: 125_039, realizedBalance: realized) == -cent)
        #expect(
            AccountReconciliation.verdict(totalCents: 125_039, realizedBalance: realized)
                == .adjustment(kind: .expense, amount: cent)
        )
    }

    @Test("an overdraft held against a deeper checked deficit is an income")
    func verdict_negativeBalances_compareBySign() {
        #expect(
            AccountReconciliation.verdict(totalCents: -15_000, realizedBalance: -200)
                == .adjustment(kind: .income, amount: 50)
        )
    }

    @Test("a large gap stays exact to the cent")
    func verdict_largeGap_staysExact() throws {
        let gap = try #require(Decimal(string: "2999999999.97"))
        #expect(
            AccountReconciliation.verdict(totalCents: 299_999_999_997, realizedBalance: 0)
                == .adjustment(kind: .income, amount: gap)
        )
    }

    // MARK: - Payload

    @Test("an up-to-date verdict writes nothing")
    func adjustmentPayload_upToDate_isNil() {
        let payload = AccountReconciliation.adjustmentPayload(
            budgetId: "budget-current", label: "Ajustement", verdict: .upToDate, now: Self.now
        )
        #expect(payload == nil)
    }

    @Test("an adjustment is one checked, free entry on the loaded budget, dated now")
    func adjustmentPayload_isCheckedFreeEntryOnLoadedBudget() throws {
        let amount = try #require(Decimal(string: "12.34"))
        let payload = try #require(AccountReconciliation.adjustmentPayload(
            budgetId: "budget-current",
            label: "  Écart banque  ",
            verdict: .adjustment(kind: .expense, amount: amount),
            now: Self.now
        ))

        #expect(payload.budgetId == "budget-current")
        #expect(payload.budgetLineId == nil)
        #expect(payload.name == "Écart banque")
        #expect(payload.amount == amount)
        #expect(payload.kind == .expense)
        #expect(payload.checkedAt == Self.now)
        #expect(payload.transactionDate == Self.now)
        #expect(payload.sourceSavingsGoalId == nil)
        #expect(payload.tagIds == nil)
    }

    @Test("the create body carries no budget line, and carries the check")
    func adjustmentPayload_encodesWithoutBudgetLine() throws {
        let payload = try #require(AccountReconciliation.adjustmentPayload(
            budgetId: "budget-current",
            label: "Ajustement",
            verdict: .adjustment(kind: .income, amount: 5),
            now: Self.now
        ))
        let body = try JSONSerialization.jsonObject(with: JSONEncoder().encode(payload)) as? [String: Any]

        #expect(body?["budgetLineId"] == nil)
        #expect(body?["checkedAt"] != nil)
        #expect(body?["kind"] as? String == "income")
    }

    // MARK: - Completion analytics

    @Test("the completion names the adjustment kind only, from a fixed value space")
    func completion_namesKindOnly() {
        #expect(AccountReconciliation.Completion(verdict: .upToDate) == .upToDate)
        #expect(AccountReconciliation.Completion(verdict: .adjustment(kind: .income, amount: 1)) == .income)
        #expect(AccountReconciliation.Completion(verdict: .adjustment(kind: .expense, amount: 1)) == .expense)
        #expect(AccountReconciliation.Completion.allCases.map(\.rawValue) == ["income", "expense", "none"])
        #expect(AccountReconciliation.Completion.income.analyticsProperties == ["adjustment_kind": "income"])
    }

    // MARK: - Helpers

    private static let now = Date(timeIntervalSince1970: 1_790_000_000)

    private func account(_ amountText: String, isNegative: Bool = false) -> AccountReconciliation.Account {
        AccountReconciliation.Account(amountText: amountText, isNegative: isNegative)
    }
}
