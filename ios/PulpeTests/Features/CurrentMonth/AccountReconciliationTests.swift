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
        "--5", "+5", "-", "1234567890", "NaN", "inf", "Infinity", "\u{0661}\u{0662}",
    ])
    func parseAmount_invalid_isRefused(text: String) {
        #expect(AccountReconciliation.parseAmount(text) == .invalid)
    }

    // MARK: - Negative balance (the decimal pad has no minus key)

    @Test("the negative switch makes a typed balance negative, and keeps a pasted minus negative")
    func account_negative_isAlwaysNegative() {
        #expect(account("40", isOwed: true).amount == .valid(cents: -4_000))
        #expect(account("-40", isOwed: true).amount == .valid(cents: -4_000))
        #expect(account("-40").amount == .valid(cents: -4_000))
        #expect(account("40").amount == .valid(cents: 4_000))
    }

    @Test("the negative switch never turns a blank or refused amount into a number")
    func account_negative_keepsBlankAndInvalid() {
        #expect(account("", isOwed: true).amount == .blank)
        #expect(account("12.", isOwed: true).amount == .invalid)
    }

    // MARK: - Total

    @Test("accounts add up in cents, so 0.1 + 0.2 is exactly 0.30")
    func totalCents_sumsWithoutDrift() {
        #expect(AccountReconciliation.totalCents(of: [account("0.1"), account("0.2")]) == 30)
    }

    @Test("a negative account is subtracted from the total")
    func totalCents_subtractsNegativeAccount() {
        let accounts = [account("1500.25"), account("200,50", isOwed: true), account("0.01")]
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

    // MARK: - Ranked candidates over the movements of the month (same fixtures as account-reconciliation.spec.ts)

    private func candidate(_ id: String, _ remainingGap: Decimal) -> AccountReconciliation.RankedPointingCandidate {
        .init(source: .transaction, id: id, monthsAgo: 0, remainingGap: remainingGap)
    }

    @Test("an income not checked yet that explains most of the gap is named, with what would remain")
    func rankedPointingCandidates_partialIncome() throws {
        let gap = try #require(Decimal(string: "814.93"))
        let bonus = TestDataFactory.createTransaction(id: "bonus", amount: 800, kind: .income)
        let dinner = TestDataFactory.createTransaction(id: "dinner", amount: 50, kind: .expense)

        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: gap, lines: [], transactions: [bonus, dinner]
        )

        #expect(candidates == [candidate("bonus", try #require(Decimal(string: "14.93")))])
    }

    @Test("a movement that would go past the gap, or already checked, is left out")
    func rankedPointingCandidates_overshootAndChecked_areLeftOut() throws {
        let gap = try #require(Decimal(string: "814.93"))
        let big = TestDataFactory.createTransaction(id: "big", amount: 900, kind: .income)
        let pointed = TestDataFactory.createTransaction(id: "pointed", amount: 100, kind: .income, isChecked: true)
        let any = TestDataFactory.createTransaction(id: "any", amount: 1, kind: .income)

        #expect(AccountReconciliation.rankedPointingCandidates(gap: gap, lines: [], transactions: [big, pointed])
            .isEmpty)
        #expect(AccountReconciliation.rankedPointingCandidates(gap: 0, lines: [], transactions: [any]).isEmpty)
    }

    @Test("the movement that settles the gap comes first")
    func rankedPointingCandidates_settlingFirst() throws {
        let size = try #require(Decimal(string: "84.30"))
        let coffee = TestDataFactory.createTransaction(id: "coffee", amount: 20, kind: .expense)
        let migros = TestDataFactory.createTransaction(id: "migros", amount: size, kind: .expense)

        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: -size, lines: [], transactions: [coffee, migros]
        )

        #expect(candidates == [candidate("migros", 0), candidate("coffee", try #require(Decimal(string: "-64.30")))])
    }

    @Test("under a checked prévision, what checking moves counts, not the amount")
    func rankedPointingCandidates_underCheckedPrevision() {
        let groceries = TestDataFactory.createBudgetLine(id: "groceries", amount: 100, isChecked: true)
        let small = TestDataFactory.createTransaction(id: "small", budgetLineId: "groceries", amount: 50)
        let big = TestDataFactory.createTransaction(id: "big", budgetLineId: "groceries", amount: 150)

        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: -150, lines: [groceries], transactions: [small, big]
        )

        #expect(candidates == [candidate("big", -100)])
    }

    @Test("three candidates at most")
    func rankedPointingCandidates_keepsThree() {
        let four = ["a", "b", "c", "d"].map { TestDataFactory.createTransaction(id: $0, amount: 10, kind: .expense) }

        let ids = AccountReconciliation.rankedPointingCandidates(gap: -100, lines: [], transactions: four).map(\.id)

        #expect(ids == ["a", "b", "c"])
    }

    private func account(_ amountText: String, isOwed: Bool = false) -> AccountReconciliation.Account {
        AccountReconciliation.Account(amountText: amountText, isOwed: isOwed)
    }
}

extension AccountReconciliationTests {
    // MARK: - Comparison across months (same fixtures as account-reconciliation.spec.ts)

    @Test("suggestions win over the first comparison and the early salary")
    func comparisonScreen_suggestionsBeatFirstAndSalary() {
        #expect(AccountReconciliation.comparisonScreen(
            gap: 6_000, candidateCount: 1, dismissed: false, first: true, salaryMaybeEarly: true
        ) == .suggestions)
    }

    @Test("budget lines, movements and prior items are ranked together by what remains")
    func rankedPointingCandidates_ranksThreeSources() {
        let assurance = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)
        let essence = TestDataFactory.createTransaction(id: "essence", amount: 60, kind: .expense)
        let pharmacie = AccountReconciliation.PriorPointingItem(id: "pharmacie", effect: -40, monthsAgo: 1)

        let candidates = AccountReconciliation.rankedPointingCandidates(
            gap: -100, lines: [assurance], transactions: [essence], priorItems: [pharmacie]
        )

        #expect(candidates == [
            .init(source: .budgetLine, id: "assurance", monthsAgo: 0, remainingGap: 0),
            .init(source: .transaction, id: "essence", monthsAgo: 0, remainingGap: -40),
            .init(source: .prior, id: "pharmacie", monthsAgo: 1, remainingGap: -60),
        ])
    }

    @Test("an eligible prior item two months back is named")
    func rankedPointingCandidates_namesPriorTwoMonthsAgo() {
        let loyer = AccountReconciliation.PriorPointingItem(id: "loyer", effect: -100, monthsAgo: 2)

        #expect(AccountReconciliation.rankedPointingCandidates(
            gap: -100, lines: [], transactions: [], priorItems: [loyer]
        ) == [.init(source: .prior, id: "loyer", monthsAgo: 2, remainingGap: 0)])
    }

    @Test("a planned savings withdrawal, which the API refuses to check, is left out")
    func rankedPointingCandidates_leavesOutPlannedWithdrawal() {
        var retrait = TestDataFactory.createBudgetLine(id: "retrait", amount: 100)
        retrait.sourceSavingsGoalId = "goal"

        #expect(AccountReconciliation.rankedPointingCandidates(gap: -100, lines: [retrait], transactions: []).isEmpty)
    }

    @Test("an effect near a cent boundary is measured from the two rounded balances")
    func rankedPointingCandidates_centBoundary() throws {
        let checked = TestDataFactory.createBudgetLine(
            id: "a", amount: try #require(Decimal(string: "100.004")), kind: .income, isChecked: true
        )
        let open = TestDataFactory.createBudgetLine(
            id: "b", amount: try #require(Decimal(string: "0.004")), kind: .income
        )

        #expect(AccountReconciliation.rankedPointingCandidates(
            gap: try #require(Decimal(string: "0.01")), lines: [checked, open], transactions: []
        ) == [.init(source: .budgetLine, id: "b", monthsAgo: 0, remainingGap: 0)])
    }

    @Test("a checked line, a prior item past the gap, and a zero gap name nothing")
    func rankedPointingCandidates_leavesOut() {
        let checked = TestDataFactory.createBudgetLine(id: "assurance", amount: 100, isChecked: true)
        let loyer = AccountReconciliation.PriorPointingItem(id: "loyer", effect: -150, monthsAgo: 2)
        let open = TestDataFactory.createBudgetLine(id: "assurance", amount: 100)

        #expect(AccountReconciliation.rankedPointingCandidates(
            gap: -100, lines: [checked], transactions: [], priorItems: [loyer]
        ).isEmpty)
        #expect(AccountReconciliation.rankedPointingCandidates(gap: 0, lines: [open], transactions: []).isEmpty)
    }

    private struct ScreenCase {
        let gap: Decimal
        var candidates = 0
        var dismissed = false
        var first = false
        var salaryEarly = false
        let expected: AccountReconciliation.Screen
    }

    @Test("the screen follows the first matching row of the table", arguments: [
        ScreenCase(gap: 0, candidates: 2, expected: .matched),
        ScreenCase(gap: -100, candidates: 1, expected: .suggestions),
        ScreenCase(gap: 3_100, first: true, expected: .firstComparison),
        ScreenCase(gap: 6_000, salaryEarly: true, expected: .salaryEarly),
        ScreenCase(gap: Decimal(sign: .minus, exponent: -2, significand: 240), expected: .smallGap),
        ScreenCase(gap: 3, expected: .smallGap),
        ScreenCase(gap: -10, expected: .largeGap),
        ScreenCase(gap: 6_000, expected: .moreOnAccounts),
        ScreenCase(gap: -6_000, salaryEarly: true, expected: .largeGap),
        ScreenCase(gap: -100, candidates: 1, dismissed: true, expected: .largeGap),
        ScreenCase(gap: 6_000, first: true, salaryEarly: true, expected: .firstComparison),
        ScreenCase(gap: 3, salaryEarly: true, expected: .salaryEarly),
    ])
    private func comparisonScreen_followsTheTable(_ row: ScreenCase) {
        #expect(AccountReconciliation.comparisonScreen(
            gap: row.gap, candidateCount: row.candidates, dismissed: row.dismissed, first: row.first,
            salaryMaybeEarly: row.salaryEarly
        ) == row.expected)
    }

    @Test("money that came in is maybe an early salary from five days before a pay day other than 1", arguments: [
        (Decimal(6_000), 25 as Int?, 3, true),
        (Decimal(6_000), 25, 5, true),
        (Decimal(6_000), 25, 6, false),
        (Decimal(6_000), 1, 3, false),
        (Decimal(6_000), nil, 3, false),
        (Decimal(-6_000), 25, 3, false),
    ])
    func isSalaryMaybeEarly_followsPayDay(gap: Decimal, payDay: Int?, days: Int, expected: Bool) {
        #expect(AccountReconciliation.isSalaryMaybeEarly(
            gap: gap, payDayOfMonth: payDay, daysUntilNextPeriod: days
        ) == expected)
    }

    @Test("the gap closed by checks is how much nearer zero it came, never below zero", arguments: [
        (Decimal(1_000), Decimal(950), Decimal(1_100), Decimal(0)),
        (Decimal(1_000), Decimal(950), Decimal(980), Decimal(30)),
        (Decimal(950), Decimal(1_050), Decimal(1_100), Decimal(0)),
        (Decimal(950), Decimal(1_050), Decimal(1_000), Decimal(50)),
        (Decimal(1_000), Decimal(950), Decimal(1_000), Decimal(50)),
    ])
    func gapClosedByChecks_isTheReductionOfTheAbsoluteGap(
        onAccounts: Decimal, comparedBefore: Decimal, compared: Decimal, closed: Decimal
    ) {
        #expect(AccountReconciliation.gapClosedByChecks(
            onAccounts: onAccounts, comparedBefore: comparedBefore, compared: compared
        ) == closed)
    }

    @Test("the compared figure adds the prior correction and the starting amount")
    func comparedFigure_addsCorrectionAndStart() throws {
        #expect(AccountReconciliation.comparedFigure(
            realizedBalance: 900, priorCorrection: 50, startingAmount: 3_100
        ) == 4_050)
        #expect(AccountReconciliation.comparedFigure(
            realizedBalance: try #require(Decimal(string: "900.1")),
            priorCorrection: try #require(Decimal(string: "-0.2")),
            startingAmount: 0
        ) == (try #require(Decimal(string: "899.9"))))
        #expect(AccountReconciliation.comparedFigure(
            realizedBalance: try #require(Decimal(string: "100.004")),
            priorCorrection: try #require(Decimal(string: "0.004")),
            startingAmount: 0
        ) == (try #require(Decimal(string: "100.01"))))
    }

    @Test("the available amount before and after noting the gap")
    func availableAfterNote_beforeAndAfter() throws {
        #expect(AccountReconciliation.availableAfterNote(
            available: try #require(Decimal(string: "1250.4")), gap: -100
        ) == .init(before: try #require(Decimal(string: "1250.4")), after: try #require(Decimal(string: "1150.4"))))
        #expect(AccountReconciliation.availableAfterNote(
            available: try #require(Decimal(string: "100.004")), gap: try #require(Decimal(string: "0.004"))
        ).after == (try #require(Decimal(string: "100.01"))))
        #expect(AccountReconciliation.availableAfterNote(
            available: try #require(Decimal(string: "10.1")), gap: try #require(Decimal(string: "0.2"))
        ) == .init(before: try #require(Decimal(string: "10.1")), after: try #require(Decimal(string: "10.3"))))
    }

    @Test("every allocated movement, checked or not, counts as the line consumption does")
    func partlySpentBudgetLines_keepsOnlyPartlySpent() {
        let partly = TestDataFactory.createBudgetLine(id: "partly", amount: 600, isChecked: true)
        let untouched = TestDataFactory.createBudgetLine(id: "untouched", amount: 1_200, isChecked: true)
        let spentAll = TestDataFactory.createBudgetLine(id: "spentAll", amount: 300, isChecked: true)
        let unchecked = TestDataFactory.createBudgetLine(id: "unchecked", amount: 600, isChecked: true)
        let open = TestDataFactory.createBudgetLine(id: "open", amount: 600)
        let transactions = [
            TestDataFactory.createTransaction(id: "t5", budgetLineId: "unchecked", amount: 200),
            TestDataFactory.createTransaction(id: "t1", budgetLineId: "partly", amount: 200, isChecked: true),
            TestDataFactory.createTransaction(id: "t2", budgetLineId: "partly", amount: 50),
            TestDataFactory.createTransaction(id: "t3", budgetLineId: "open", amount: 100, isChecked: true),
            TestDataFactory.createTransaction(id: "t4", budgetLineId: "spentAll", amount: 300, isChecked: true),
        ]

        #expect(AccountReconciliation.partlySpentBudgetLines(
            lines: [partly, untouched, spentAll, open, unchecked], transactions: transactions
        ) == [
            .init(id: "partly", spent: 250, left: 350),
            .init(id: "unchecked", spent: 200, left: 400),
        ])
    }

    @Test("the matched card splits what is planned, what came before Pulpe, and what is left")
    func matchedBreakdown_splitsTheFigures() throws {
        #expect(AccountReconciliation.matchedBreakdown(available: 900, compared: 4_050, startingAmount: 3_100)
            == .init(stillPlanned: -50, beforePulpe: -3_100, remaining: 900))
        #expect(AccountReconciliation.matchedBreakdown(
            available: try #require(Decimal(string: "100.004")), compared: try #require(Decimal(string: "0.004")),
            startingAmount: 0
        ).stillPlanned == 100)
        #expect(AccountReconciliation.matchedBreakdown(
            available: try #require(Decimal(string: "0.004")), compared: 0,
            startingAmount: try #require(Decimal(string: "0.006"))
        ).stillPlanned == (try #require(Decimal(string: "0.01"))))
        #expect(AccountReconciliation.matchedBreakdown(available: 900, compared: 900, startingAmount: 0)
            == .init(stillPlanned: 0, beforePulpe: 0, remaining: 900))
        #expect(AccountReconciliation.matchedBreakdown(available: 1_000, compared: 950, startingAmount: 0)
            .stillPlanned == 50)
    }
}
