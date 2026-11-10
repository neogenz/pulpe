import SwiftUI

/// « Ce mois-ci » of the goal detail: what this month asks, whether it is pointed, the
/// pace in one sentence, and the page's single button. Shown only when one of them has
/// something to say.
struct GoalThisMonthCard: View {
    let month: SavingsGoalPlanMonth?
    /// « Vise X par mois pour finir en juin. Depuis août, tu mets Y par mois. »
    let sentence: String?
    let plan: PlanButton?
    let currency: SupportedCurrency

    /// The page's single button: « Planifier décembre à juin » when months ahead hold
    /// nothing, else « Ajuster mon plan ». The identifier names what it opens.
    struct PlanButton {
        let title: String
        let opensSimulator: Bool
        let explainsChoice: Bool
        let action: () -> Void
    }

    static func isRelevant(month: SavingsGoalPlanMonth?, sentence: String?, plan: PlanButton?) -> Bool {
        month != nil || sentence != nil || plan != nil
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Ce mois-ci"))
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                if let month {
                    monthRow(month)
                }
                if let sentence {
                    Text(sentence)
                        .font(PulpeTypography.subheadline)
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                        .fixedSize(horizontal: false, vertical: true)
                        .padding(DesignTokens.Spacing.md)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(Color.sunk, in: .rect(cornerRadius: DesignTokens.CornerRadius.card))
                        .sensitiveAmount()
                        .accessibilityIdentifier("savingsGoalRequiredPaceStat")
                }
                if let plan {
                    planButton(plan)
                }
            }
            .padding(DesignTokens.Spacing.lg)
            .pulpeSurfaceCard()
        }
    }

    private func monthRow(_ month: SavingsGoalPlanMonth) -> some View {
        let isPointed = month.lines.allSatisfy(\.isChecked)
        let planned = month.plannedAmount.asAmount(for: currency)
        return PulpeListRow(
            title: AppLocale.string("\(Formatters.monthName(for: month.month)) · \(planned) prévus"),
            subtitle: subtitle(month, isPointed: isPointed),
            showsChevron: false
        ) {
            GoalFactChip(label: isPointed ? AppLocale.string("Pointé") : AppLocale.string("À pointer"))
        }
        .sensitiveAmount()
        .accessibilityElement(children: .combine)
        .accessibilityIdentifier("savingsGoalPlanMonthRow-\(month.year)-\(month.month)")
    }

    private func subtitle(_ month: SavingsGoalPlanMonth, isPointed: Bool) -> String {
        if isPointed {
            let checked = month.lines.compactMap { $0.checkedAt.flatMap(GoalHeroPresentation.parseTimestamp) }.max()
            return checked.map { AppLocale.string("Pointé le \($0.dayMonthFormatted)") } ?? AppLocale.string("Pointé")
        }
        guard month.confirmedAmount > 0 else { return AppLocale.string("Pas encore pointé dans ton budget") }
        let confirmed = month.confirmedAmount.asAmount(for: currency)
        return AppLocale.string("\(confirmed) pointés pour l'instant")
    }

    private func planButton(_ plan: PlanButton) -> some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Button(plan.title, action: plan.action)
                .primaryButtonStyle()
                .accessibilityIdentifier(
                    plan.opensSimulator ? "savingsGoalAdjustPlanButton" : "savingsGoalPlanMissingMonthsButton"
                )
            if plan.explainsChoice {
                Text("Tu choisis le montant. Rien ne change avant que tu valides.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
    }
}
