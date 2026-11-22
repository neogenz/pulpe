import Foundation

/// "Comparer avec mes comptes" (PUL-351): the user's bank balances held against the
/// checked balance of the loaded month. Pure and Foundation-only — the flow model
/// and the sheet read every rule from here. `parseAmount`, `totalCents(of:)`, `verdict`,
/// `rankedPointingCandidates`, `gapClosedByChecks` and the screen rules (`comparisonScreen`,
/// `isSalaryMaybeEarly`, `availableAfterNote`, `partlySpentBudgetLines`,
/// `matchedBreakdown`) are the Swift twin of `shared/src/calculators/account-reconciliation.ts`,
/// fixtures included (see `.claude/rules/00-architecture/formula-mirrors-ts-swift.md`).
enum AccountReconciliation {
    /// A balance as typed. `blank` is a row nobody filled; `invalid` is never read as zero.
    enum Amount: Equatable, Sendable {
        case blank
        case invalid
        case valid(cents: Int)
    }

    /// One row of the accounts step. Lives only in the mounted flow: never persisted,
    /// never synced, never sent to analytics.
    struct Account: Identifiable, Equatable, Sendable {
        let id: UUID
        var label: String
        var amountText: String
        /// The « Je dois » side: the decimal pad has no minus key, so a balance that counts against the
        /// user (an overdraft, but also a credit card's spending to come) is said explicitly.
        var isOwed: Bool

        init(id: UUID = UUID(), label: String = "", amountText: String = "", isOwed: Bool = false) {
            self.id = id
            self.label = label
            self.amountText = amountText
            self.isOwed = isOwed
        }

        /// The switch only ever makes a balance negative: a pasted minus stays one.
        var amount: Amount {
            let parsed = AccountReconciliation.parseAmount(amountText)
            guard isOwed, case .valid(let cents) = parsed else { return parsed }
            return .valid(cents: -abs(cents))
        }
    }

    /// `nil` until at least one amount is filled and every filled amount reads: summing
    /// around a refused row would reconcile against a figure nobody typed.
    static func totalCents(of accounts: [Account]) -> Int? {
        var total = 0
        var hasAmount = false
        for account in accounts {
            switch account.amount {
            case .blank:
                continue
            case .invalid:
                return nil
            case .valid(let cents):
                total += cents
                hasAmount = true
            }
        }
        return hasAmount ? total : nil
    }

    /// What the gap becomes. Never a saving: the money came in or went out, it was not
    /// set aside.
    enum Verdict: Equatable, Sendable {
        case upToDate
        case adjustment(kind: TransactionKind, amount: Decimal)
    }

    /// Accounts total minus the checked balance, both settled in cents first: the
    /// balance is summed from decoded amounts and can carry binary noise.
    static func difference(totalCents: Int, realizedBalance: Decimal) -> Decimal {
        amount(cents: totalCents) - realizedBalance.rounded(maxCentDigits)
    }

    /// Exact in base 10, so a cent total converts with no binary noise.
    static func amount(cents: Int) -> Decimal {
        Decimal(cents) / Decimal(centsPerUnit)
    }

    /// Strictly zero in cents is up to date — no tolerance threshold.
    static func verdict(totalCents: Int, realizedBalance: Decimal) -> Verdict {
        let gap = difference(totalCents: totalCents, realizedBalance: realizedBalance)
        if gap == 0 { return .upToDate }
        return gap > 0
            ? .adjustment(kind: .income, amount: gap)
            : .adjustment(kind: .expense, amount: -gap)
    }

    /// The one create call of the flow: a checked entry with no budget line, on the
    /// budget the home screen has loaded, dated now. `nil` when there is nothing to write.
    static func adjustmentPayload(
        budgetId: String,
        label: String,
        verdict: Verdict,
        now: Date
    ) -> TransactionCreate? {
        guard case .adjustment(let kind, let amount) = verdict else { return nil }
        return TransactionCreate(
            budgetId: budgetId,
            name: label.trimmingCharacters(in: .whitespacesAndNewlines),
            amount: amount,
            kind: kind,
            budgetLineId: nil,
            transactionDate: now,
            checkedAt: now
        )
    }

    /// `adjustment_kind` of `account_reconciliation_completed` — mirrors the value space
    /// documented on `ANALYTICS_EVENTS` in `shared/src/feature-flags.ts`. Never an amount
    /// or a label.
    enum Completion: String, CaseIterable, Sendable {
        case income
        case expense
        case upToDate = "none"

        init(verdict: Verdict) {
            switch verdict {
            case .upToDate: self = .upToDate
            case .adjustment(let kind, _): self = kind == .income ? .income : .expense
            }
        }

        var analyticsProperties: [String: String] {
            ["adjustment_kind": rawValue]
        }
    }

    fileprivate static let maxPointingCandidates = 3

    /// Keeps the items that leave the gap nearer zero, even past it (4 600.00 for a 4 570.48 gap
    /// leaves 29.52), closest to settling first, at most three. A stable sort keeps the entries' order between equally close ones.
    fileprivate static func rankByRemainingGap<Item>(
        gap: Decimal, entries: [(Item, Decimal)]
    ) -> [(item: Item, remainingGap: Decimal)] {
        let kept = entries.compactMap { item, effect -> (item: Item, remainingGap: Decimal)? in
            let remainingGap = gap - effect
            guard remainingGap.absoluteValue < gap.absoluteValue else { return nil }
            return (item, remainingGap)
        }
        return kept.enumerated()
            .sorted {
                ($0.element.remainingGap.absoluteValue, $0.offset) < ($1.element.remainingGap.absoluteValue, $1.offset)
            }
            .prefix(maxPointingCandidates)
            .map(\.element)
    }

    private static let maxUnitDigits = 9
    fileprivate static let maxCentDigits = 2
    private static let centsPerUnit = 100

    /// Integer cents, read from the digits so a sum of accounts never drifts: an optional
    /// minus (an overdraft pasted from a banking app, typographic or not), at most nine
    /// digits of units and two of cents. `String.parsedAsAmount` drops the sign and reads
    /// "12." as 12 — right for a form amount, wrong for a balance held to the cent.
    static func parseAmount(_ text: String) -> Amount {
        let normalized = text
            .trimmingCharacters(in: .whitespacesAndNewlines)
            .replacingOccurrences(of: "\u{2212}", with: "-")
        guard !normalized.isEmpty else { return .blank }

        let isNegative = normalized.hasPrefix("-")
        let unsigned = isNegative ? normalized.dropFirst() : Substring(normalized)
        let parts = unsigned.split(
            omittingEmptySubsequences: false,
            whereSeparator: { $0 == "." || $0 == "," }
        )
        guard parts.count <= 2,
              let units = parts.first,
              isDigits(units, count: 1...maxUnitDigits)
        else { return .invalid }

        let decimals = parts.count == 2 ? parts[1] : ""
        if parts.count == 2, !isDigits(decimals, count: 1...maxCentDigits) {
            return .invalid
        }

        let paddedDecimals = decimals.padding(toLength: maxCentDigits, withPad: "0", startingAt: 0)
        guard let unitValue = Int(units), let centValue = Int(paddedDecimals) else { return .invalid }
        let magnitude = unitValue * centsPerUnit + centValue
        return .valid(cents: isNegative ? -magnitude : magnitude)
    }

    /// ASCII digits only: `Character.isNumber` alone would accept "٣" or "½".
    private static func isDigits(_ text: Substring, count: ClosedRange<Int>) -> Bool {
        count.contains(text.count) && text.allSatisfy { $0.isASCII && $0.isNumber }
    }
}

// MARK: - Comparison across the month and the two before it

extension AccountReconciliation {
    enum PointingTarget: Equatable, Sendable {
        case transaction(String)
        case budgetLine(String)
    }

    /// Rounded to the cent, as the TypeScript twin reads it.
    private static func realizedBalance(lines: [BudgetLine], transactions: [Transaction]) -> Decimal {
        BudgetFormulas.calculateRealizedBalance(budgetLines: lines, transactions: transactions).rounded(maxCentDigits)
    }

    /// What pointing one item moves in the pointed balance, measured rather than read from its
    /// amount, against a balance before pointing computed once for a whole ranking.
    fileprivate static func effectAfterPointing(
        lines: [BudgetLine], transactions: [Transaction], balanceBefore: Decimal, target: PointingTarget
    ) -> Decimal {
        let after = realizedBalance(
            lines: lines.map { target == .budgetLine($0.id) ? $0.toggled() : $0 },
            transactions: transactions.map { target == .transaction($0.id) ? $0.toggled() : $0 }
        )
        return after - balanceBefore
    }

    enum PointingSource: Equatable, Sendable {
        case transaction
        case budgetLine
    }

    struct RankedPointingCandidate: Equatable, Sendable {
        let source: PointingSource
        let id: String
        let remainingGap: Decimal
    }

    /// The items not checked yet that most likely explain the gap: each one, checked alone, brings the
    /// checked balance nearer the accounts total. The effect is measured, not read
    /// from the amount: under a checked prévision an expense moves the balance by less, or not at all.
    /// Two sources of the month only: unchecked budget lines, then unchecked movements; closest to settling
    /// first, ties keep that source order, at most three. Previous months are closed by the month-end
    /// recap, never here. Twin of `rankedPointingCandidates`.
    static func rankedPointingCandidates(
        gap: Decimal, lines: [BudgetLine], transactions: [Transaction]
    ) -> [RankedPointingCandidate] {
        let gap = gap.rounded(maxCentDigits)
        guard gap != 0 else { return [] }
        let balanceBefore = realizedBalance(lines: lines, transactions: transactions)
        // A planned savings withdrawal is realized by its real income: the API refuses to check it.
        let entries: [(RankedPointingCandidate, Decimal)] =
            lines.filter { !$0.isChecked && $0.sourceSavingsGoalId == nil }.map { line in
                (
                    RankedPointingCandidate(source: .budgetLine, id: line.id, remainingGap: 0),
                    effectAfterPointing(
                        lines: lines, transactions: transactions, balanceBefore: balanceBefore,
                        target: .budgetLine(line.id)
                    )
                )
            }
            + transactions.filter { !$0.isChecked }.map { transaction in
                (
                    RankedPointingCandidate(source: .transaction, id: transaction.id, remainingGap: 0),
                    effectAfterPointing(
                        lines: lines, transactions: transactions, balanceBefore: balanceBefore,
                        target: .transaction(transaction.id)
                    )
                )
            }
        return rankByRemainingGap(gap: gap, entries: entries).map {
            RankedPointingCandidate(source: $0.item.source, id: $0.item.id, remainingGap: $0.remainingGap)
        }
    }

    /// In the budget currency.
    static let smallGapThreshold: Decimal = 10
    private static let salaryEarlyDays = 5

    /// Money that came in while the next pay day is close. A pay day of 1 is the calendar month.
    static func isSalaryMaybeEarly(gap: Decimal, payDayOfMonth: Int?, daysUntilNextPeriod: Int) -> Bool {
        gap > 0 && (payDayOfMonth.map { $0 != 1 } ?? false) && daysUntilNextPeriod <= salaryEarlyDays
    }

    enum Screen: Equatable, Sendable {
        case matched
        case suggestions
        case salaryEarly
        case smallGap
        case largeGap
        case moreOnAccounts
    }

    /// Which step-2 screen shows; first matching row wins (spec.md §4.3). Twin of `comparisonScreen`.
    static func comparisonScreen(
        gap: Decimal, candidateCount: Int, dismissed: Bool, salaryMaybeEarly: Bool
    ) -> Screen {
        if gap == 0 { return .matched }
        if candidateCount > 0, !dismissed { return .suggestions }
        if gap > 0, salaryMaybeEarly { return .salaryEarly }
        if gap.absoluteValue < smallGapThreshold { return .smallGap }
        return gap < 0 ? .largeGap : .moreOnAccounts
    }

    /// « … trouvés »: how much nearer zero the gap came since the first check; a check that widens
    /// it finds nothing. Twin of `gapClosedByChecks`.
    static func gapClosedByChecks(onAccounts: Decimal, comparedBefore: Decimal, compared: Decimal) -> Decimal {
        max(0, (onAccounts - comparedBefore).absoluteValue - (onAccounts - compared).absoluteValue)
    }

    /// « Disponible : avant → après ».
    struct AvailableNote: Equatable, Sendable {
        let before: Decimal
        let after: Decimal
    }

    static func availableAfterNote(available: Decimal, gap: Decimal) -> AvailableNote {
        AvailableNote(before: available, after: (available + gap).rounded(maxCentDigits))
    }

    struct PartlySpentBudgetLine: Equatable, Sendable {
        let id: String
        let spent: Decimal
        let left: Decimal
    }

    /// Checked expense lines whose allocated movements (checked or not, as the line's consumption counts
    /// them) are above 0 and below the line.
    static func partlySpentBudgetLines(lines: [BudgetLine], transactions: [Transaction]) -> [PartlySpentBudgetLine] {
        lines.filter { $0.kind == .expense && $0.isChecked }.compactMap { line in
            let spent = BudgetFormulas.calculateConsumption(for: line, transactions: transactions)
                .allocated.rounded(maxCentDigits)
            guard spent > 0, spent < line.amount else { return nil }
            return PartlySpentBudgetLine(id: line.id, spent: spent, left: (line.amount - spent).rounded(maxCentDigits))
        }
    }

    struct MatchedBreakdown: Equatable, Sendable {
        /// Below 0 is « Encore prévu », above 0 is « Encore à recevoir », 0 shows no line.
        let stillPlanned: Decimal
        let remaining: Decimal
    }

    static func matchedBreakdown(available: Decimal, compared: Decimal) -> MatchedBreakdown {
        MatchedBreakdown(stillPlanned: (available - compared).rounded(maxCentDigits), remaining: available)
    }
}
