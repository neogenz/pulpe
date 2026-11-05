import SwiftUI

typealias GoalPlanWithdrawalDestinations = [
    Int: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination
]

enum GoalPlanApplyRecapMode: Equatable {
    case adjustment
    case creation
}

/// « On met ton plan à jour ? » (PUL-12+, pilier C) — the apply-on-confirm recap.
///
/// A medium-detent sheet summarising the edited months, the destination of every
/// planned withdrawal, the projection verdict, and a loading confirm button doing
/// the pessimistic write (`docs/SAVINGS.md` §10.1).
/// Épargne accents only — never amber/red (RG-002).
struct GoalPlanApplyRecapSheet: View {
    var mode: GoalPlanApplyRecapMode = .adjustment
    let changes: [SavingsPlanCalculator.SimulatedMonth]
    let verdict: String
    let currency: SupportedCurrency
    /// Names the goal in the banner about months created from the template.
    var goalName: String?
    /// Marks the month whose cumulative crosses the target (« cible franchie »).
    var targetAmount: Decimal?
    /// Returns `true` on a successful write so the sheet can dismiss itself.
    let onConfirm: (GoalPlanWithdrawalDestinations) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirming = false
    @Environment(BudgetListStore.self) var budgetListStore: BudgetListStore?
    @State var templateBalance: Decimal?
    @State var withdrawalDestinations: GoalPlanWithdrawalDestinations

    private let maxListedRows = 12

    init(
        mode: GoalPlanApplyRecapMode = .adjustment,
        changes: [SavingsPlanCalculator.SimulatedMonth],
        verdict: String,
        currency: SupportedCurrency,
        goalName: String? = nil,
        targetAmount: Decimal? = nil,
        onConfirm: @escaping (GoalPlanWithdrawalDestinations) async -> Bool
    ) {
        self.mode = mode
        self.changes = changes
        self.verdict = verdict
        self.currency = currency
        self.goalName = goalName
        self.targetAmount = targetAmount
        self.onConfirm = onConfirm
        _withdrawalDestinations = State(
            initialValue: Self.initialWithdrawalDestinations(for: changes)
        )
    }

    struct WithdrawalBreakdown: Equatable {
        let contribution: Decimal
        let updatedContribution: Decimal
        let previousWithdrawal: Decimal
        let plannedWithdrawal: Decimal
        let netEffect: Decimal
    }

    nonisolated static func initialWithdrawalDestinations(
        for changes: [SavingsPlanCalculator.SimulatedMonth]
    ) -> GoalPlanWithdrawalDestinations {
        Dictionary(uniqueKeysWithValues: changes.compactMap { change in
            guard change.simulatedAmount < 0 else { return nil }
            return (
                change.id,
                change.month.planWithdrawalDestination ?? .goalOnly
            )
        })
    }

    nonisolated static func withdrawalBreakdown(
        for change: SavingsPlanCalculator.SimulatedMonth
    ) -> WithdrawalBreakdown {
        let contribution = max(change.month.plannedAmount, change.month.confirmedAmount)
        let updatedContribution = change.simulatedAmount < 0 ? contribution : change.simulatedAmount
        let previousWithdrawal = -SavingsPlanCalculator.managedPlanWithdrawalAmount(change.month)
        let plannedWithdrawal = min(0, change.simulatedAmount)
        return WithdrawalBreakdown(
            contribution: contribution,
            updatedContribution: updatedContribution,
            previousWithdrawal: previousWithdrawal,
            plannedWithdrawal: plannedWithdrawal,
            netEffect: updatedContribution + plannedWithdrawal
        )
    }

    nonisolated static func listedChanges(
        _ changes: [SavingsPlanCalculator.SimulatedMonth],
        maxNonWithdrawals: Int
    ) -> [SavingsPlanCalculator.SimulatedMonth] {
        var nonWithdrawalCount = 0
        return changes.filter { change in
            if change.simulatedAmount < 0 || change.replacesExistingPlanWithdrawal {
                return true
            }
            guard nonWithdrawalCount < max(0, maxNonWithdrawals) else { return false }
            nonWithdrawalCount += 1
            return true
        }
    }

    nonisolated static func canLinkWithdrawal(
        _ change: SavingsPlanCalculator.SimulatedMonth
    ) -> Bool {
        change.simulatedAmount < 0 && change.month.hasBudget
    }

    nonisolated static func hasUniformAdjustment(
        _ changes: [SavingsPlanCalculator.SimulatedMonth]
    ) -> Bool {
        guard let first = changes.first else { return false }
        let previousAmount = SavingsPlanCalculator.currentPlanMovement(first.month)
        return changes.allSatisfy {
            SavingsPlanCalculator.currentPlanMovement($0.month) == previousAmount
                && $0.simulatedAmount == first.simulatedAmount
        }
    }

    private var listedChanges: [SavingsPlanCalculator.SimulatedMonth] {
        if mode == .creation { return changes }
        return Self.listedChanges(changes, maxNonWithdrawals: maxListedRows)
    }

    private var omittedChangeCount: Int { changes.count - listedChanges.count }

    private var summary: String {
        guard mode == .creation else {
            return AppLocale.string("\(changes.count) mois ajustés")
        }
        return AppLocale.string("\(changes.count) prévisions Épargne à ajouter")
    }

    private var hasWithdrawal: Bool { changes.contains { $0.simulatedAmount < 0 } }

    private var hasWithdrawalChange: Bool {
        changes.contains { $0.simulatedAmount < 0 || $0.replacesExistingPlanWithdrawal }
    }

    nonisolated static func conversionMessage(
        from existing: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination?,
        to selected: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination
    ) -> String? {
        guard let existing, existing != selected else { return nil }
        return existing == .linkedIncome
            ? AppLocale.string("La Prévision Revenu liée sera supprimée avec la mise à jour du plan.")
            : AppLocale.string("Une Prévision Revenu liée sera créée avec la mise à jour du plan.")
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    if let banner = missingBudgetBanner {
                        InfoBanner(.neutral, systemImage: "calendar", text: banner)
                    }

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        Text(summary)
                            .font(PulpeTypography.metricLabel)
                            .foregroundStyle(Color.textSecondary)
                            .padding(.horizontal, DesignTokens.Spacing.xs)
                        diffBlock
                    }

                    impactCard
                }
                .padding(DesignTokens.Spacing.lg)
            }
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground)
            .localizedNavigationTitle(
                mode == .creation ? "Ajouter les épargnes manquantes ?" : "On met ton plan à jour ?"
            )
            .navigationBarTitleDisplayMode(.inline)
            .safeAreaInset(edge: .bottom) { confirmFooter }
        }
        .standardSheetPresentation(detents: [.large])
        .task { templateBalance = await GoalMonthAvailability.loadTemplateBalance() }
    }
}

private extension GoalPlanApplyRecapSheet {
    @ViewBuilder
    private var diffBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            do {
                ForEach(Array(listedChanges.enumerated()), id: \.element.id) { index, simMonth in
                    if index > 0 {
                        Divider().foregroundStyle(Color.outlineVariant)
                    }
                    if simMonth.simulatedAmount < 0 || simMonth.replacesExistingPlanWithdrawal {
                        withdrawalChange(simMonth)
                    } else {
                        diffRow(simMonth, index: index)
                    }
                }
                if mode == .adjustment, omittedChangeCount > 0 {
                    Text("et \(omittedChangeCount) autres")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textTertiary)
                }
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    private func diffRow(_ simMonth: SavingsPlanCalculator.SimulatedMonth, index: Int) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                diffRowPeriod(simMonth, index: index)
                Spacer(minLength: DesignTokens.Spacing.sm)
                diffRowAmounts(simMonth)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                diffRowPeriod(simMonth, index: index)
                diffRowAmounts(simMonth)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.rowAmount)
        .monospacedDigit()
        .frame(minHeight: DesignTokens.TapTarget.minimum)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(diffRowAccessibilityLabel(simMonth))
        .sensitiveAmount()
    }

    private func diffRowAccessibilityLabel(
        _ simMonth: SavingsPlanCalculator.SimulatedMonth
    ) -> String {
        let period = "\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year)"
        let after = simMonth.simulatedAmount.asAdaptiveCurrency(currency)
        guard showsBeforeAmount(simMonth) else { return AppLocale.string("\(period), \(after)") }
        let before = SavingsPlanCalculator.currentPlanMovement(simMonth.month).asAdaptiveCurrency(currency)
        return AppLocale.string("\(period), de \(before) à \(after)")
    }

    private func diffRowPeriod(_ simMonth: SavingsPlanCalculator.SimulatedMonth, index: Int) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(Self.rowTitle(for: index, in: listedChanges))
                .font(PulpeTypography.rowTitle)
                .foregroundStyle(Color.textPrimary)
            if let caption = Self.rowCaption(
                for: index, in: listedChanges, targetAmount: targetAmount, currency: currency
            ) {
                Text(caption)
                    .font(PulpeTypography.captionRegular)
                    .foregroundStyle(Color.textSecondary)
                    .sensitiveAmount()
            }
        }
    }

    private func diffRowAmounts(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                if showsBeforeAmount(simMonth) {
                    diffRowBeforeAmount(simMonth)
                    transitionArrow(systemName: "arrow.right")
                }
                diffRowAfterAmount(simMonth)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.sm) {
                if showsBeforeAmount(simMonth) {
                    diffRowBeforeAmount(simMonth)
                    transitionArrow(systemName: "arrow.down")
                }
                diffRowAfterAmount(simMonth)
            }
        }
    }

    /// A month the plan creates has nothing to strike through: only its new amount shows.
    private func showsBeforeAmount(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> Bool {
        mode == .adjustment && SavingsPlanCalculator.currentPlanMovement(simMonth.month) != 0
    }

    private func diffRowBeforeAmount(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        Text(SavingsPlanCalculator.currentPlanMovement(simMonth.month).asAmount(for: currency))
            .foregroundStyle(Color.textTertiary)
            .strikethrough(true, color: Color.textTertiary)
    }

    private func diffRowAfterAmount(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        Text(simMonth.simulatedAmount.asAmount(for: currency))
            .foregroundStyle(Color.textPrimary)
    }

    private var confirmFooter: some View {
        VStack(spacing: DesignTokens.Spacing.xs) {
            Button {
                confirm()
            } label: {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    if isConfirming { ProgressView().tint(Color.textOnPrimary) }
                    confirmLabel
                }
            }
            .primaryButtonStyle(isEnabled: !isConfirming)
            .disabled(isConfirming)

            Button("Annuler") { dismiss() }
                .sheetDismissLinkStyle()
                .disabled(isConfirming)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.sheetBackground)
    }

    private var confirmLabel: Text {
        if hasWithdrawal { return Text("Planifier le retrait") }
        return mode == .creation ? Text("Créer les épargnes") : Text("Mettre à jour")
    }

    private func confirm() {
        isConfirming = true
        Task {
            let succeeded = await onConfirm(withdrawalDestinations)
            isConfirming = false
            if succeeded { dismiss() }
        }
    }
}
