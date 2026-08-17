import SwiftUI

/// Confirmed balance, planned projection, and deadline pace for one savings goal.
struct GoalProgressCard: View {
    let progress: SavingsGoalProgress
    let currency: SupportedCurrency

    private var hasClosedPlanMonth: Bool {
        SavingsGoalDetailViewModel.hasClosedPlanMonth(progress.months)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(alignment: .firstTextBaseline) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Épargné")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)
                    Text(progress.confirmed.asAdaptiveCurrency(currency))
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(Color.financialSavings)
                        .monospacedDigit()
                        .sensitiveAmount()
                }

                Spacer()

                if let targetAmount = progress.targetAmount {
                    Text("sur \(targetAmount.asAdaptiveCurrency(currency))")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)
                        .monospacedDigit()
                        .sensitiveAmount()
                }
            }

            if progress.targetAmount != nil {
                layeredBar
            }

            if let pace = progress.paceStatus {
                if hasClosedPlanMonth {
                    paceIndicator(pace)
                } else if let amount = SavingsGoalDetailViewModel.currentMonthPlannedAmount(progress.months) {
                    planReadyIndicator(amount)
                }
            }

            VStack(spacing: DesignTokens.Spacing.sm) {
                if progress.initialAmount > 0 {
                    statRow(
                        label: AppLocale.string("Montant de départ"),
                        value: progress.initialAmount.asCompactCurrency(currency)
                    )
                }
                statRow(
                    label: AppLocale.string("Déjà prévu"),
                    value: progress.plannedCumulative.asCompactCurrency(currency),
                    swatch: Color.financialSavings.opacity(DesignTokens.Opacity.strong)
                )
                statRow(
                    label: AppLocale.string("Projection du plan"),
                    value: progress.plannedProjection.asAdaptiveCurrency(currency),
                    identifier: "savingsGoalProjectionStat"
                )
                if let required = progress.required, hasClosedPlanMonth {
                    if SavingsGoalDetailViewModel.requiredMatchesPlannedPace(
                        planned: progress.pace,
                        required: required
                    ) {
                        statRow(
                            label: AppLocale.string("Pour tenir ton échéance"),
                            value: AppLocale.string("\(required.asAdaptiveCurrency(currency)) / mois"),
                            identifier: "savingsGoalRequiredPaceStat"
                        )
                    } else {
                        deadlineReconciliation(required: required)
                    }
                }
            }
        }
        .pulpeCard()
        // `.contain` scopes the identifier to the card node; bare, it would propagate
        // onto every descendant and clobber the stat rows' own identifiers.
        .accessibilityElement(children: .contain)
        .accessibilityIdentifier("savingsGoalProgressCard")
    }

    private var layeredBar: some View {
        let plannedFraction = progress.plannedFraction ?? 0
        let confirmedFraction = progress.confirmedFraction ?? 0
        return ZStack(alignment: .leading) {
            ProgressBarShape(progress: 1)
                .fill(Color.progressTrack)

            ProgressBarShape(progress: CGFloat(plannedFraction))
                .fill(Color.financialSavings.opacity(DesignTokens.Opacity.strong))

            ProgressBarShape(progress: CGFloat(confirmedFraction))
                .fill(Color.financialSavings)
                .animation(DesignTokens.Animation.gentleSpring, value: confirmedFraction)
        }
        .frame(height: DesignTokens.ProgressBar.thickHeight)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel("\(progress.achievementPercent ?? 0)% de la cible épargné")
        .accessibilityIdentifier("savingsGoalTargetProgressBar")
    }

    @ViewBuilder
    private func statRow(
        label: String,
        value: String,
        swatch: Color? = nil,
        identifier: String? = nil
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            if let swatch {
                Circle()
                    .fill(swatch)
                    .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)
            }
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)
                .ifLet(identifier) { view, id in view.accessibilityIdentifier(id) }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(value)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
    }

    private func deadlineReconciliation(required: Decimal) -> some View {
        let pace = progress.pace.asAdaptiveCurrency(currency)
        let target = required.asAdaptiveCurrency(currency)
        // One whole key per variant: « pour finir le … » is a subordinate clause,
        // untranslatable on its own and glued back into the sentence.
        let copy = progress.targetDateValue.map {
            AppLocale.string("""
                Ton rythme prévu : \(pace)/mois · \
                pour finir le \($0.abbreviatedDateFormatted), vise \(target)/mois
                """)
        } ?? AppLocale.string("Ton rythme prévu : \(pace)/mois · pour tenir ton échéance, vise \(target)/mois")
        return Text(copy)
            .font(PulpeTypography.metricLabel)
            .foregroundStyle(Color.textSecondary)
            .monospacedDigit()
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity, alignment: .leading)
            .sensitiveAmount()
    }

    private func paceIndicator(_ pace: SavingsGoalPaceStatus) -> some View {
        Label(paceLabel(pace), systemImage: paceIcon(pace))
            .font(PulpeTypography.metricLabelBold)
            .foregroundStyle(Color.textSecondary)
            .accessibilityLabel("Rythme : \(paceLabel(pace))")
            .accessibilityIdentifier("savingsGoalPaceIndicator")
    }

    private func planReadyIndicator(_ amount: Decimal) -> some View {
        Label(
            "Ton plan est prêt — \(amount.asAdaptiveCurrency(currency)) à mettre de côté ce mois.",
            systemImage: "checkmark.circle"
        )
        .font(PulpeTypography.metricLabelBold)
        .foregroundStyle(Color.textSecondary)
        .sensitiveAmount()
    }

    private func paceLabel(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: AppLocale.string("Un peu en retrait")
        case .onTrack: AppLocale.string("Sur la bonne voie")
        case .ahead: AppLocale.string("En avance")
        }
    }

    private func paceIcon(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: "hourglass"
        case .onTrack: "checkmark.circle"
        case .ahead: "sparkles"
        }
    }
}
