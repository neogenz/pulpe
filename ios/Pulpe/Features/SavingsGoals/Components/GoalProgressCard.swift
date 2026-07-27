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
                    Text(progress.confirmed.asCompactCurrency(currency))
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(Color.financialSavings)
                        .monospacedDigit()
                        .sensitiveAmount()
                }

                Spacer()

                if let targetAmount = progress.targetAmount {
                    Text("sur \(targetAmount.asCurrency(currency))")
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
                    statRow(label: "Montant de départ", value: progress.initialAmount.asCompactCurrency(currency))
                }
                statRow(
                    label: "Déjà prévu",
                    value: progress.plannedCumulative.asCompactCurrency(currency),
                    swatch: Color.financialSavings.opacity(DesignTokens.Opacity.strong)
                )
                statRow(
                    label: "Projection du plan",
                    value: progress.plannedProjection.asCompactCurrency(currency)
                )
                if let required = progress.required, hasClosedPlanMonth {
                    if SavingsGoalDetailViewModel.requiredMatchesPlannedPace(
                        planned: progress.pace,
                        required: required
                    ) {
                        statRow(
                            label: "Pour tenir ton échéance",
                            value: "\(required.asCompactCurrency(currency)) / mois"
                        )
                    } else {
                        deadlineReconciliation(required: required)
                    }
                }
            }
        }
        .pulpeCard()
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
    }

    @ViewBuilder
    private func statRow(label: String, value: String, swatch: Color? = nil) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            if let swatch {
                Circle()
                    .fill(swatch)
                    .frame(width: DesignTokens.Spacing.sm, height: DesignTokens.Spacing.sm)
            }
            Text(label)
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.textSecondary)

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(value)
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        }
    }

    private func deadlineReconciliation(required: Decimal) -> some View {
        let deadlinePart = progress.targetDateValue
            .map { "pour finir le \($0.formatted(date: .abbreviated, time: .omitted))" }
            ?? "pour tenir ton échéance"
        let plannedPart = "Ton rythme prévu : \(progress.pace.asCompactCurrency(currency))/mois"
        return Text(
            "\(plannedPart) · \(deadlinePart), vise \(required.asCompactCurrency(currency))/mois"
        )
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
    }

    private func planReadyIndicator(_ amount: Decimal) -> some View {
        Label(
            "Ton plan est prêt — \(amount.asCurrency(currency)) à mettre de côté ce mois.",
            systemImage: "checkmark.circle"
        )
        .font(PulpeTypography.metricLabelBold)
        .foregroundStyle(Color.textSecondary)
        .sensitiveAmount()
    }

    private func paceLabel(_ pace: SavingsGoalPaceStatus) -> String {
        switch pace {
        case .behind: "Un peu en retrait"
        case .onTrack: "Sur la bonne voie"
        case .ahead: "En avance"
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
