import SwiftUI

/// V2 additions of « Ajuster mon plan »: the open-months caption, the quick amounts and the
/// « Ton disponible de <mois> » card for the first month the plan changes.
extension GoalPlanSimulatorSheet {
    /// « 400.00 requis », then two rounder steps above it (400 → 500, 700). Empty without a
    /// required pace: there is nothing to anchor the shortcuts on. The server pace is rounded
    /// up to the cent (`docs/SAVINGS.md`), or the plan would end a cent short of the target.
    static func quickAmounts(required rawRequired: Decimal?) -> [Decimal] {
        guard let required = rawRequired?.rounded(2, .up), required > 0 else { return [] }
        let steps = [Decimal(1.25), Decimal(1.75)].map { factor -> Decimal in
            var hundreds = required * factor / 100
            var rounded = Decimal()
            NSDecimalRound(&rounded, &hundreds, 0, .up)
            return rounded * 100
        }
        return ([required] + steps).reduce(into: []) { amounts, amount in
            if !amounts.contains(amount) { amounts.append(amount) }
        }
    }

    var globalAmountLabel: String {
        let open = viewModel.draft.months.filter { SavingsPlanCalculator.isContributivePlanMonth($0.month) }
        guard let first = open.first?.month, let last = open.last?.month, open.count > 1 else {
            return AppLocale.string("Chaque mois, je mets")
        }
        let from = Formatters.monthNameInText(for: first.month)
        let to = Formatters.monthNameInText(for: last.month)
        return AppLocale.string("Chaque mois, de \(from) à \(to), je mets")
    }

    @ViewBuilder
    var quickAmountChips: some View {
        let amounts = Self.quickAmounts(required: progress.required)
        if !amounts.isEmpty {
            HStack(spacing: DesignTokens.Spacing.sm) {
                ForEach(amounts, id: \.self) { amount in
                    let isRequired = amount == amounts.first
                    Button {
                        viewModel.setGlobalAmount(amount)
                    } label: {
                        PulpeChip(
                            label: isRequired
                                ? AppLocale.string("\(amount.asAmount(for: currency)) requis")
                                : amount.asAmount(for: currency),
                            style: viewModel.globalAmount == amount ? .selected : .outlined
                        )
                    }
                    .plainPressedButtonStyle()
                    .sensitiveAmount()
                }
            }
        }
    }

    /// The first changed month carries the figure; the others repeat the same step.
    @ViewBuilder
    var impactCard: some View {
        let changes = viewModel.planChanges
        let availability = GoalMonthAvailability(
            budgets: budgetListStore?.budgets ?? [],
            templateBalance: templateBalance
        )
        if let first = changes.first,
           let before = availability.available(month: first.month.month, year: first.month.year) {
            let step = first.simulatedAmount - SavingsPlanCalculator.currentPlanMovement(first.month)
            ImpactBlock(
                title: GoalMonthAvailability.title(month: first.month.month),
                impact: MovementImpact(before: before, after: before - step, lineBefore: nil, lineAfter: nil),
                currency: currency,
                tone: .neutral,
                note: impactNote(step: step, changes: changes)
            )
        }
    }

    private func impactNote(step: Decimal, changes: [SavingsPlanCalculator.SimulatedMonth]) -> String? {
        guard step > 0, changes.count > 1, let last = changes.last?.month,
              GoalPlanApplyRecapSheet.hasUniformAdjustment(changes) else { return nil }
        let amount = step.asAmount(for: currency)
        let until = Formatters.monthNameInText(for: last.month)
        return AppLocale.string("Puis \(amount) de moins chaque mois jusqu'en \(until).")
    }
}
