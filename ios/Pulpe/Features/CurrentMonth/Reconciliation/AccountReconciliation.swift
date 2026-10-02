import Foundation

/// "Rapprocher mes comptes" (PUL-351): the user's bank balances held against the
/// checked balance of the loaded month. Pure and Foundation-only — the flow model
/// and the sheet read every rule from here. `parseAmount`, `totalCents(of:)` and
/// `verdict` are the Swift twin of `shared/src/calculators/account-reconciliation.ts`,
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
        /// The decimal pad has no minus key: an overdrawn account is said explicitly.
        var isOverdraft: Bool

        init(id: UUID = UUID(), label: String = "", amountText: String = "", isOverdraft: Bool = false) {
            self.id = id
            self.label = label
            self.amountText = amountText
            self.isOverdraft = isOverdraft
        }

        /// The switch only ever makes a balance negative: a pasted minus stays one.
        var amount: Amount {
            let parsed = AccountReconciliation.parseAmount(amountText)
            guard isOverdraft, case .valid(let cents) = parsed else { return parsed }
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

    private static let maxUnitDigits = 9
    private static let maxCentDigits = 2
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
