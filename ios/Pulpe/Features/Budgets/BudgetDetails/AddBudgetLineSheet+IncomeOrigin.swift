import SwiftUI

/// Where an income forecast says its money will come from (PUL-329 v2). The three
/// are mutually exclusive by construction: the previous UI offered a goal picker
/// and a "je remets le mois prochain" toggle side by side, which could be armed
/// together and meant two contradictory things at once.
enum IncomeOrigin: String, CaseIterable, Identifiable {
    /// Salary, refund, gift — nothing else to declare.
    case regular
    /// Announced withdrawal from a savings goal. Nothing leaves the pot until the
    /// real income is created.
    case savingsGoal
    /// "Piocher dans son épargne" (PUL-292): an advance repaid by a saving in M+1.
    case repayNextMonth

    var id: String { rawValue }

    var label: String {
        switch self {
        case .regular: AppLocale.string("Revenu habituel")
        case .savingsGoal: AppLocale.string("Retrait d'un objectif")
        case .repayNextMonth: AppLocale.string("Pris sur mon épargne, à remettre le mois prochain")
        }
    }
}

// MARK: - Origine du revenu (PUL-292 / PUL-329 v2)

/// The origin half of `AddBudgetLineSheet`: which mode an origin puts the sheet
/// in, what a change of origin drops, and the picker itself. Split out to keep
/// the sheet under the feature's 350-LOC budget (same precedent as
/// `AddBudgetLineSheet+Submit`), which is also why the state it reads is declared
/// non-private on the sheet.
extension AddBudgetLineSheet {
    /// PUL-292 — an advance repaid next month. The sheet only routes to it.
    static func isSavingsWithdrawal(kind: TransactionKind, origin: IncomeOrigin) -> Bool {
        kind == .income && origin == .repayNextMonth
    }

    /// PUL-329 v2 — an announced withdrawal from a goal. Never the same origin as
    /// the PUL-292 advance above: the sheet holds one `IncomeOrigin` at a time.
    static func isPlannedWithdrawal(kind: TransactionKind, origin: IncomeOrigin) -> Bool {
        kind == .income && origin == .savingsGoal
    }

    /// The two origins that forbid pointing, for opposite reasons: an announced
    /// withdrawal is realized by creating the real income, and the PUL-292 advance
    /// routes away before a line exists at all. Read by the toggle's gate, the
    /// origin reset and the submit, so the three cannot disagree.
    static func forbidsChecked(kind: TransactionKind, origin: IncomeOrigin) -> Bool {
        isSavingsWithdrawal(kind: kind, origin: origin)
            || isPlannedWithdrawal(kind: kind, origin: origin)
    }

    var isSavingsWithdrawalMode: Bool {
        Self.isSavingsWithdrawal(kind: kind, origin: incomeOrigin)
    }

    var isPlannedWithdrawalMode: Bool {
        Self.isPlannedWithdrawal(kind: kind, origin: incomeOrigin)
    }

    /// One row of the details card: the title on the left, the origin menu on the right.
    var originPicker: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text("Origine")
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer()
            Picker("Origine du revenu", selection: $incomeOrigin) {
                ForEach(IncomeOrigin.allCases) { origin in
                    Text(origin.label).tag(origin)
                }
            }
            .pickerStyle(.menu)
            .tint(kind.color)
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
    }

    /// A type or origin change drops what the new combination cannot carry —
    /// never the amount or the description, which stay true whatever the origin.
    func resetIncompatibleOriginState() {
        if !isPlannedWithdrawalMode { sourceSavingsGoalId = nil }
        if Self.forbidsChecked(kind: kind, origin: incomeOrigin) { isChecked = false }
    }

    /// Keeps the projection judged on the amount the goal would actually give up.
    /// The rate is cached for a day, so retyping does not hit the network. A
    /// failure leaves `convertedAmount` nil: the preview drops its "après" and
    /// the planification carries on.
    func refreshConvertedAmount() async {
        guard isPlannedWithdrawalMode, let amount, amount > 0 else {
            convertedAmount = nil
            return
        }
        let conversion = try? await conversionService.convert(
            amount: amount,
            from: inputCurrency,
            to: userSettingsStore.currency
        )
        convertedAmount = conversion?.convertedAmount ?? amount
    }
}

/// Re-runs the conversion only when what it depends on moved. Local to this
/// sheet: `Features/X` cannot import `Features/Y`, so it cannot share the
/// identical key `AddTransactionSheet` declares for its own preview.
struct PlannedWithdrawalConversionKey: Equatable {
    let amount: Decimal?
    let currency: SupportedCurrency
}
