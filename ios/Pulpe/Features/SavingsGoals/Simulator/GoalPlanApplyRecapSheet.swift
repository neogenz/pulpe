// swiftlint:disable file_length
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
    /// Returns `true` on a successful write so the sheet can dismiss itself.
    let onConfirm: (GoalPlanWithdrawalDestinations) async -> Bool

    @Environment(\.dismiss) private var dismiss
    @State private var isConfirming = false
    @State private var withdrawalDestinations: GoalPlanWithdrawalDestinations

    private let maxListedRows = 5

    init(
        mode: GoalPlanApplyRecapMode = .adjustment,
        changes: [SavingsPlanCalculator.SimulatedMonth],
        verdict: String,
        currency: SupportedCurrency,
        onConfirm: @escaping (GoalPlanWithdrawalDestinations) async -> Bool
    ) {
        self.mode = mode
        self.changes = changes
        self.verdict = verdict
        self.currency = currency
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

    private var isUniform: Bool {
        mode == .adjustment && !hasWithdrawalChange && Self.hasUniformAdjustment(changes)
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
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
                    Text(summary)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)

                    diffBlock

                    Text(verdict)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .fixedSize(horizontal: false, vertical: true)
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
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                        .disabled(isConfirming)
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }
}

private extension GoalPlanApplyRecapSheet {
    private func destinationRow(
        for change: SavingsPlanCalculator.SimulatedMonth,
        _ destination: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination,
        title: String,
        detail: String,
        enabled: Bool = true
    ) -> some View {
        let isSelected = withdrawalDestination(for: change) == destination
        return Button {
            withdrawalDestinations[change.id] = destination
        } label: {
            HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
                Image(systemName: isSelected ? "largecircle.fill.circle" : "circle")
                    .foregroundStyle(enabled ? Color.pulpePrimary : Color.textTertiary)
                    .accessibilityHidden(true)
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(title).font(PulpeTypography.listRowTitle)
                    Text(detail)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }
        }
        .buttonStyle(.plain)
        .frame(minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .disabled(!enabled)
        .opacity(enabled ? 1 : DesignTokens.Opacity.disabled)
        .accessibilityLabel(title)
        .accessibilityHint(detail)
        .accessibilityAddTraits(isSelected ? .isSelected : [])
    }

    @ViewBuilder
    private var diffBlock: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if isUniform, let first = changes.first {
                let before = SavingsPlanCalculator.currentPlanMovement(first.month)
                let after = first.simulatedAmount
                ViewThatFits(in: .horizontal) {
                    HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                        uniformAmountTransition(from: before, to: after)
                        Text("/mois sur \(changes.count) mois")
                            .foregroundStyle(Color.textSecondary)
                    }
                    .fixedSize(horizontal: true, vertical: false)

                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        uniformAmountTransition(from: before, to: after)
                        Text("/mois sur \(changes.count) mois")
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(AppLocale.string("""
                    De \(before.asAdaptiveCurrency(currency)) à \(after.asAdaptiveCurrency(currency)) \
                    par mois sur \(changes.count) mois
                    """))
                .sensitiveAmount()
            } else {
                ForEach(Array(listedChanges.enumerated()), id: \.element.id) { index, simMonth in
                    if index > 0 {
                        Divider().foregroundStyle(Color.outlineVariant)
                    }
                    if simMonth.simulatedAmount < 0 || simMonth.replacesExistingPlanWithdrawal {
                        withdrawalChange(simMonth)
                    } else {
                        diffRow(simMonth)
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

    private func uniformAmountTransition(from before: Decimal, to after: Decimal) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                uniformBeforeAmount(before)
                transitionArrow(systemName: "arrow.right")
                uniformAfterAmount(after)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                uniformBeforeAmount(before)
                transitionArrow(systemName: "arrow.down")
                uniformAfterAmount(after)
            }
        }
    }

    private func uniformBeforeAmount(_ before: Decimal) -> some View {
        Text(before.asAdaptiveCurrency(currency))
            .foregroundStyle(Color.textTertiary)
            .strikethrough(true, color: Color.textTertiary)
    }

    private func uniformAfterAmount(_ after: Decimal) -> some View {
        Text(after.asAdaptiveCurrency(currency))
            .foregroundStyle(Color.financialSavings)
    }

    private func transitionArrow(systemName: String) -> some View {
        Image(systemName: systemName)
            .font(PulpeTypography.caption2)
            .foregroundStyle(Color.textTertiary)
            .accessibilityHidden(true)
    }

    private func diffRow(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                diffRowPeriod(simMonth)
                Spacer(minLength: DesignTokens.Spacing.sm)
                diffRowAmounts(simMonth)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                diffRowPeriod(simMonth)
                diffRowAmounts(simMonth)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(diffRowAccessibilityLabel(simMonth))
        .sensitiveAmount()
    }

    private func diffRowAccessibilityLabel(
        _ simMonth: SavingsPlanCalculator.SimulatedMonth
    ) -> String {
        let period = "\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year)"
        let after = simMonth.simulatedAmount.asAdaptiveCurrency(currency)
        guard mode == .adjustment else { return AppLocale.string("\(period), \(after)") }
        let before = SavingsPlanCalculator.currentPlanMovement(simMonth.month).asAdaptiveCurrency(currency)
        return AppLocale.string("\(period), de \(before) à \(after)")
    }

    private func diffRowPeriod(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        // `String(year)`: interpolating an `Int` would apply localized grouping.
        Text("\(Formatters.monthName(for: simMonth.month.month)) \(String(simMonth.month.year))")
            .font(PulpeTypography.metricLabel)
            .foregroundStyle(Color.textSecondary)
    }

    private func diffRowAmounts(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                if mode == .adjustment {
                    diffRowBeforeAmount(simMonth)
                    transitionArrow(systemName: "arrow.right")
                }
                diffRowAfterAmount(simMonth)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.sm) {
                if mode == .adjustment {
                    diffRowBeforeAmount(simMonth)
                    transitionArrow(systemName: "arrow.down")
                }
                diffRowAfterAmount(simMonth)
            }
        }
    }

    private func diffRowBeforeAmount(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        Text(SavingsPlanCalculator.currentPlanMovement(simMonth.month).asAdaptiveCurrency(currency))
            .foregroundStyle(Color.textTertiary)
            .strikethrough(true, color: Color.textTertiary)
    }

    private func diffRowAfterAmount(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        Text(simMonth.simulatedAmount.asAdaptiveCurrency(currency))
            .foregroundStyle(Color.financialSavings)
    }

    private func withdrawalChange(_ change: SavingsPlanCalculator.SimulatedMonth) -> some View {
        let breakdown = Self.withdrawalBreakdown(for: change)

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // `String(year)`: interpolating an `Int` would apply localized grouping.
            Text("\(Formatters.monthName(for: change.month.month)) \(String(change.month.year))")
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)

            withdrawalAmounts(breakdown)
            if change.simulatedAmount < 0 {
                withdrawalDestinationChoices(for: change)
            } else if change.month.planWithdrawalDestination == .linkedIncome {
                Text("La Prévision Revenu liée sera supprimée avec la mise à jour du plan.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
    }

    private func withdrawalAmounts(_ breakdown: WithdrawalBreakdown) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if breakdown.contribution == breakdown.updatedContribution {
                amountRow(
                    label: AppLocale.string("Épargne prévue"),
                    amount: breakdown.contribution,
                    detail: AppLocale.string("Conservée")
                )
            } else {
                withdrawalTransition(
                    label: AppLocale.string("Épargne prévue"),
                    from: breakdown.contribution,
                    to: breakdown.updatedContribution
                )
            }
            withdrawalTransition(
                from: breakdown.previousWithdrawal,
                to: breakdown.plannedWithdrawal
            )
            amountRow(label: AppLocale.string("Effet net du mois"), amount: breakdown.netEffect)
        }
    }

    private func withdrawalDestinationChoices(
        for change: SavingsPlanCalculator.SimulatedMonth
    ) -> some View {
        let canLink = Self.canLinkWithdrawal(change)
        let selectedDestination = withdrawalDestination(for: change)

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Destination de ce mois")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)

            destinationRow(
                for: change,
                .goalOnly,
                title: AppLocale.string("Objectif uniquement"),
                detail: AppLocale.string("La projection baisse. Rien ne change dans ton budget.")
            )
            destinationRow(
                for: change,
                .linkedIncome,
                title: AppLocale.string("Revenu dans le budget"),
                detail: AppLocale.string("""
                    Une Prévision Revenu liée sera ajoutée. \
                    Réalise-la dans le budget : le Réel créé sera automatiquement pointé.
                    """),
                enabled: canLink
            )

            if !canLink {
                Text("Crée d’abord le budget de ce mois pour y ajouter le revenu.")
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }

            if let message = Self.conversionMessage(
                from: change.month.planWithdrawalDestination,
                to: selectedDestination
            ) {
                Text(message)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
                    .accessibilityAddTraits(.isStaticText)
            }
        }
    }

    private func amountRow(label: String, amount: Decimal, detail: String? = nil) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                amountLabel(label, detail: detail)
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                breakdownAmount(amount)
                    .fixedSize(horizontal: true, vertical: false)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                amountLabel(label, detail: detail)
                    .fixedSize(horizontal: false, vertical: true)
                breakdownAmount(amount)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.metricLabel)
        .foregroundStyle(Color.textPrimary)
    }

    private func amountLabel(_ label: String, detail: String?) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(label)
            if let detail {
                Text(detail)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textTertiary)
            }
        }
    }

    private func breakdownAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .font(PulpeTypography.metricLabelBold)
            .monospacedDigit()
            .sensitiveAmount()
    }

    private func withdrawalTransition(
        label: String = AppLocale.string("Retrait planifié"),
        from: Decimal,
        to: Decimal
    ) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(label)
                    .fixedSize(horizontal: true, vertical: false)
                Spacer(minLength: DesignTokens.Spacing.sm)
                withdrawalTransitionAmounts(from: from, to: to)
                    .fixedSize(horizontal: true, vertical: false)
            }

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text(label)
                withdrawalTransitionAmounts(from: from, to: to)
                    .frame(maxWidth: .infinity, alignment: .trailing)
            }
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "\(label), de \(signedCurrency(from)) à \(signedCurrency(to))"
        )
        .sensitiveAmount()
    }

    private func withdrawalTransitionAmounts(from: Decimal, to: Decimal) -> some View {
        ViewThatFits(in: .horizontal) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                withdrawalBeforeAmount(from)
                transitionArrow(systemName: "arrow.right")
                withdrawalAfterAmount(to)
            }
            .fixedSize(horizontal: true, vertical: false)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.sm) {
                withdrawalBeforeAmount(from)
                transitionArrow(systemName: "arrow.down")
                withdrawalAfterAmount(to)
            }
        }
    }

    private func withdrawalBeforeAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .foregroundStyle(Color.textTertiary)
            .strikethrough(true, color: Color.textTertiary)
    }

    private func withdrawalAfterAmount(_ amount: Decimal) -> some View {
        Text(signedCurrency(amount))
            .foregroundStyle(Color.textPrimary)
    }

    private func signedCurrency(_ amount: Decimal) -> String {
        let formatted = amount.asAdaptiveCurrency(currency)
        return amount > 0 ? "+\(formatted)" : formatted
    }

    private func withdrawalDestination(
        for change: SavingsPlanCalculator.SimulatedMonth
    ) -> SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination {
        withdrawalDestinations[change.id]
            ?? change.month.planWithdrawalDestination
            ?? .goalOnly
    }

    private var confirmFooter: some View {
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
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(.bar)
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
