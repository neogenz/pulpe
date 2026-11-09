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
    /// Drawn from an own asset (Mon patrimoine); pointed like a regular income.
    case asset

    var id: String { rawValue }

    /// The sheet asks two questions — "from my savings?" then "which?" — over
    /// this one value, so the three origins stay mutually exclusive.
    init(isFromSavings: Bool, savingsOrigin: SavingsOrigin) {
        switch (isFromSavings, savingsOrigin) {
        case (false, _): self = .regular
        case (true, .goal): self = .savingsGoal
        case (true, .repay): self = .repayNextMonth
        case (true, .asset): self = .asset
        }
    }

    var isFromSavings: Bool { self != .regular }

    /// What the segment shows; a regular income has none, so it shows the default.
    var savingsOrigin: SavingsOrigin {
        switch self {
        case .repayNextMonth: .repay
        case .asset: .asset
        case .regular, .savingsGoal: .goal
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

    /// Mon patrimoine on, and an own asset to draw from.
    var offersAsset: Bool {
        Self.offersAsset(flagOn: featureFlags.isNetWorthEnabled, store: assetStore)
    }

    static func offersAsset(flagOn: Bool, store: AssetStore) -> Bool {
        flagOn && !store.activeAssets(direction: .own).isEmpty
    }

    /// The origin reads the store, and an income sheet is the only thing opened here: load it.
    static func loadAssets(flagOn: Bool, store: AssetStore) async {
        if flagOn { await store.loadIfNeeded() }
    }

    /// The asset to write: an income carries one only when drawn from it.
    var linkedAssetId: String? {
        Self.linkedAssetId(kind: kind, origin: incomeOrigin, assetId: assetId)
    }

    static func linkedAssetId(kind: TransactionKind, origin: IncomeOrigin, assetId: String?) -> String? {
        kind == .income ? (origin == .asset ? assetId : nil) : kind.assetLink(assetId)
    }

    var isSavingsWithdrawalMode: Bool {
        Self.isSavingsWithdrawal(kind: kind, origin: incomeOrigin)
    }

    var isPlannedWithdrawalMode: Bool {
        Self.isPlannedWithdrawal(kind: kind, origin: incomeOrigin)
    }

    /// The savings question of the details card (toggle, then goal or repay).
    var originPicker: some View {
        SavingsOriginToggle(
            isOn: Binding(
                get: { incomeOrigin.isFromSavings },
                set: { incomeOrigin = IncomeOrigin(isFromSavings: $0, savingsOrigin: incomeOrigin.savingsOrigin) }
            ),
            origin: Binding(
                get: { incomeOrigin.savingsOrigin },
                set: { incomeOrigin = IncomeOrigin(isFromSavings: true, savingsOrigin: $0) }
            ),
            offersRepay: onRequestSavingsWithdrawal != nil,
            offersAsset: offersAsset,
            tintColor: kind.color
        )
    }

    /// A type or origin change drops what the new combination cannot carry —
    /// never the amount or the description, which stay true whatever the origin.
    func resetIncompatibleOriginState() {
        if !isPlannedWithdrawalMode { sourceSavingsGoalId = nil }
        if kind == .income, incomeOrigin != .asset { assetId = nil }
        if mode == .everyMonth, !offersEveryMonth { mode = .once }
    }

    /// Keeps the projections (impact block, planned withdrawal) judged on the amount in the
    /// account currency.
    /// The rate is cached for a day, so retyping does not hit the network. A
    /// failure leaves `convertedAmount` nil: the preview drops its "après" and
    /// the planification carries on.
    func refreshConvertedAmount() async {
        guard let amount, amount > 0 else {
            convertedAmount = nil
            return
        }
        guard inputCurrency != userSettingsStore.currency else {
            convertedAmount = amount
            return
        }
        let conversion = try? await conversionService.convert(
            amount: amount,
            from: inputCurrency,
            to: userSettingsStore.currency
        )
        convertedAmount = conversion?.convertedAmount
    }
}

/// Re-runs the conversion only when what it depends on moved. Local to this
/// sheet: `Features/X` cannot import `Features/Y`, so it cannot share the
/// identical key `MovementSheet` declares for its own preview.
struct PlannedWithdrawalConversionKey: Equatable {
    let amount: Decimal?
    let currency: SupportedCurrency
}
