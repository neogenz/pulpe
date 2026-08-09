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
        let previousWithdrawal = -SavingsPlanCalculator.managedPlanWithdrawalAmount(change.month)
        return WithdrawalBreakdown(
            contribution: contribution,
            previousWithdrawal: previousWithdrawal,
            plannedWithdrawal: change.simulatedAmount,
            netEffect: contribution + change.simulatedAmount
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
        mode == .adjustment && !hasWithdrawal && Self.hasUniformAdjustment(changes)
    }

    private var listedChanges: [SavingsPlanCalculator.SimulatedMonth] {
        if mode == .creation { return changes }
        return Self.listedChanges(changes, maxNonWithdrawals: maxListedRows)
    }

    private var omittedChangeCount: Int { changes.count - listedChanges.count }

    private var summary: String {
        guard mode == .creation else {
            return changes.count == 1 ? "1 mois ajusté" : "\(changes.count) mois ajustés"
        }
        return changes.count == 1
            ? "1 prévision Épargne à ajouter"
            : "\(changes.count) prévisions Épargne à ajouter"
    }

    private var hasWithdrawal: Bool { changes.contains { $0.simulatedAmount < 0 } }

    nonisolated static func conversionMessage(
        from existing: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination?,
        to selected: SavingsGoalPlanApply.PlanWithdrawalAdjustment.Destination
    ) -> String? {
        guard let existing, existing != selected else { return nil }
        return existing == .linkedIncome
            ? "La Prévision Revenu liée sera supprimée avec la mise à jour du plan."
            : "Une Prévision Revenu liée sera créée avec la mise à jour du plan."
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
            .navigationTitle(
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
                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(before.asCompactCurrency(currency))
                        .foregroundStyle(Color.textTertiary)
                        .strikethrough(true, color: Color.textTertiary)
                    Image(systemName: "arrow.right")
                        .font(PulpeTypography.caption2)
                        .foregroundStyle(Color.textTertiary)
                        .accessibilityHidden(true)
                    Text(after.asCompactCurrency(currency))
                        .foregroundStyle(Color.financialSavings)
                    Text("/mois sur \(changes.count) mois")
                        .foregroundStyle(Color.textSecondary)
                }
                .font(PulpeTypography.amountCard)
                .monospacedDigit()
                .accessibilityElement(children: .ignore)
                .accessibilityLabel(
                    "De \(before.asCurrency(currency)) à \(after.asCurrency(currency)) "
                        + "par mois sur \(changes.count) mois"
                )
                .sensitiveAmount()
            } else {
                ForEach(Array(listedChanges.enumerated()), id: \.element.id) { index, simMonth in
                    if index > 0 {
                        Divider().foregroundStyle(Color.outlineVariant)
                    }
                    if simMonth.simulatedAmount < 0 {
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

    private func diffRow(_ simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        HStack {
            Text("\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year)")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
            Spacer()
            if mode == .adjustment {
                Text(SavingsPlanCalculator.currentPlanMovement(simMonth.month).asCompactCurrency(currency))
                    .foregroundStyle(Color.textTertiary)
                    .strikethrough(true, color: Color.textTertiary)
                Image(systemName: "arrow.right")
                    .font(PulpeTypography.caption2)
                    .foregroundStyle(Color.textTertiary)
            }
            Text(simMonth.simulatedAmount.asCompactCurrency(currency))
                .foregroundStyle(Color.financialSavings)
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            mode == .adjustment
                ? "\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year), "
                    + "de \(SavingsPlanCalculator.currentPlanMovement(simMonth.month).asCompactCurrency(currency)) "
                    + "à \(simMonth.simulatedAmount.asCompactCurrency(currency))"
                : "\(Formatters.monthName(for: simMonth.month.month)) \(simMonth.month.year), "
                    + simMonth.simulatedAmount.asCompactCurrency(currency)
        )
        .sensitiveAmount()
    }

    private func withdrawalChange(_ change: SavingsPlanCalculator.SimulatedMonth) -> some View {
        let breakdown = Self.withdrawalBreakdown(for: change)

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("\(Formatters.monthName(for: change.month.month)) \(change.month.year)")
                .font(PulpeTypography.listRowTitle)
                .foregroundStyle(Color.textPrimary)

            withdrawalAmounts(breakdown)
            withdrawalDestinationChoices(for: change)
        }
    }

    private func withdrawalAmounts(_ breakdown: WithdrawalBreakdown) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            amountRow(
                label: "Épargne prévue",
                amount: breakdown.contribution,
                detail: "Conservée"
            )
            withdrawalTransition(
                from: breakdown.previousWithdrawal,
                to: breakdown.plannedWithdrawal
            )
            amountRow(label: "Effet net du mois", amount: breakdown.netEffect)
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
                title: "Objectif uniquement",
                detail: "La projection baisse. Rien ne change dans ton budget."
            )
            destinationRow(
                for: change,
                .linkedIncome,
                title: "Revenu dans le budget",
                detail: "Une Prévision Revenu liée sera ajoutée. "
                    + "Réalise-la dans le budget : le Réel créé sera automatiquement pointé.",
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
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(label)
                if let detail {
                    Text(detail)
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                }
            }
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(signedCurrency(amount))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .sensitiveAmount()
        }
        .font(PulpeTypography.metricLabel)
        .foregroundStyle(Color.textPrimary)
    }

    private func withdrawalTransition(from: Decimal, to: Decimal) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
            Text("Retrait planifié")
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(signedCurrency(from))
                .foregroundStyle(Color.textTertiary)
                .strikethrough(true, color: Color.textTertiary)
            Image(systemName: "arrow.right")
                .font(PulpeTypography.caption2)
                .foregroundStyle(Color.textTertiary)
                .accessibilityHidden(true)
            Text(signedCurrency(to))
                .foregroundStyle(Color.textPrimary)
        }
        .font(PulpeTypography.metricLabelBold)
        .monospacedDigit()
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(
            "Retrait planifié, de \(signedCurrency(from)) à \(signedCurrency(to))"
        )
        .sensitiveAmount()
    }

    private func signedCurrency(_ amount: Decimal) -> String {
        let formatted = amount.asCompactCurrency(currency)
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
                Text(
                    hasWithdrawal
                        ? "Planifier le retrait"
                        : mode == .creation ? "Créer les épargnes" : "Mettre à jour"
                )
            }
        }
        .primaryButtonStyle(isEnabled: !isConfirming)
        .disabled(isConfirming)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(.bar)
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
