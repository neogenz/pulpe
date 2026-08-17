import SwiftUI

/// « Ton plan » inside « Ajuster mon plan » — the editable twin of
/// `GoalPlanTimelineSection` on the goal detail, and deliberately the same
/// surface: one `pulpeRowCard()` holding every month, hairlines between them, the
/// section named on the canvas above it.
///
/// A view of its own rather than a slice of the sheet: the sheet already carries
/// the chart, the verdict, the global control and the apply flow, and the
/// timeline is the one part of it that has to stay legible next to the read-mode
/// screen it mirrors.
struct GoalPlanSimulatorTimeline: View {
    let viewModel: GoalPlanSimulatorViewModel
    let currency: SupportedCurrency
    let plannedWithdrawals: [SavingsGoalPlannedWithdrawal]
    /// Already closes the sheet before it pushes: the caller owns the dismissal.
    let onOpenBudget: (String) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
                Text("Ton plan")
                    .font(PulpeTypography.sectionTitle)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityAddTraits(.isHeader)
                Spacer(minLength: DesignTokens.Spacing.sm)
                // Rien à annuler tant que rien n'a bougé : un lien grisé en
                // permanence occupe la ligne du titre sans jamais servir.
                if viewModel.isDirty { resetButton }
            }

            // Même carte-registre que « Ton plan » sur l'écran de détail : les
            // rangées portent leur padding vertical, la carte ouvre les côtés.
            LazyVStack(spacing: DesignTokens.Spacing.none) {
                ForEach(Array(viewModel.draft.months.enumerated()), id: \.element.id) { index, simMonth in
                    if index > 0 { Divider() }
                    row(for: simMonth)
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .pulpeRowCard()

            // Sous la carte et non au-dessus : la convention de signe ne sert
            // qu'au moment où l'on tape, pas avant d'avoir lu son plan.
            Text("Un montant négatif retire de l'objectif.")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textTertiary)
                .fixedSize(horizontal: false, vertical: true)
        }
    }

    /// Partage sa ligne avec le titre, donc il achète sa cible tactile en
    /// débordant puis en revenant : un `minHeight` grandirait tout l'en-tête
    /// (`swiftui-hit-areas.md`).
    private var resetButton: some View {
        Button("Réinitialiser") { viewModel.revert() }
            .font(PulpeTypography.labelLarge)
            .foregroundStyle(Color.pulpePrimary)
            .lineLimit(1)
            .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
            .contentShape(Rectangle())
            .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
            .textLinkButtonStyle()
            .accessibilityLabel("Réinitialiser le plan")
    }

    @ViewBuilder
    private func row(for simMonth: SavingsPlanCalculator.SimulatedMonth) -> some View {
        if SavingsPlanCalculator.isContributivePlanMonth(simMonth.month) {
            GoalPlanSimEditRow(
                simMonth: simMonth,
                currency: currency,
                amount: Binding(
                    get: { viewModel.simulatedAmount(forKey: simMonth.id) },
                    set: { viewModel.setMonth(key: simMonth.id, amount: $0) }
                )
            )
        } else {
            GoalPlanMonthRow(
                month: simMonth.month,
                amount: simMonth.simulatedAmount,
                cumulative: simMonth.simulatedCumulative,
                currency: currency,
                showsCumulative: true,
                emphasizesAmount: true,
                onOpenBudget: budgetAction(for: simMonth.month)
            )
        }
    }

    private func budgetAction(for month: SavingsGoalPlanMonth) -> (() -> Void)? {
        guard let budgetId = GoalPlanTimelinePresentation.budgetId(
            forFrozenMonth: month,
            plannedWithdrawals: plannedWithdrawals
        ) else { return nil }
        return { onOpenBudget(budgetId) }
    }
}
