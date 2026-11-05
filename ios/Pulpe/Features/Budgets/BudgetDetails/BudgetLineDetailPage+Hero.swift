import SwiftUI

/// V2 `Enveloppe` hero: what went through the line over what was planned, the bar, then
/// one sentence. An overrun reads in the ocre and offers to take it back elsewhere.
struct BudgetLineHeroCard: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let currency: SupportedCurrency
    let onCatchUp: () -> Void

    var body: some View {
        let isOverrun = line.kind == .expense && consumption.isOverBudget
        let progress = CGFloat(min(max(consumption.percentage / 100, 0), 1))

        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                (Text(verbatim: consumption.allocated.asAmount(for: currency))
                    .font(PulpeTypography.heroAmount)
                    .tracking(DesignTokens.Tracking.hero)
                    + Text(verbatim: " \(currency.symbol)")
                    .font(PulpeTypography.heroCurrencySuffix)
                    .foregroundStyle(Color.textTertiary))
                    .foregroundStyle(Color.textPrimary)
                    .monospacedDigit()
                    .minimumScaleFactor(DesignTokens.TextScale.floor)
                    .lineLimit(1)
                    .contentTransition(.numericText())
                    .accessibilityIdentifier("budgetLineDetailHeroAmount")

                Text(plannedCaption(kind: line.kind, planned: line.amount.asAmount(for: currency)))
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textSecondary)
                    .monospacedDigit()
            }
            .sensitiveAmount()

            ZStack(alignment: .leading) {
                Capsule().fill(Color.sunk)
                ProgressBarShape(progress: progress)
                    .fill(isOverrun ? Color.financialOverBudget : Color.financialColor(for: line.kind))
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
            .accessibilityHidden(true)

            statusSentence(isOverrun: isOverrun)

            if isOverrun {
                Button { onCatchUp() } label: {
                    Text("Rattraper sur une autre prévision")
                        .frame(maxWidth: .infinity)
                }
                .secondaryButtonStyle(size: .small)
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
    }

    private func plannedCaption(kind: TransactionKind, planned: String) -> String {
        switch kind {
        case .expense: AppLocale.string("dépensés sur \(planned) prévus")
        case .income: AppLocale.string("reçus sur \(planned) prévus")
        case .saving: AppLocale.string("épargnés sur \(planned) prévus")
        }
    }

    @ViewBuilder
    private func statusSentence(isOverrun: Bool) -> some View {
        let left = line.amount - consumption.allocated
        if isOverrun {
            let over = (-left).asAmount(for: currency)
            (Text("\(over) au-delà du prévu").bold().foregroundStyle(Color.financialOverBudget)
                + Text(verbatim: ". ")
                + Text("Ces \(over) sortent de ton disponible, sauf si tu les reprends sur une autre prévision."))
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textPrimary)
                .monospacedDigit()
                .sensitiveAmount()
        } else if left > 0 {
            Text("Reste \(left.asAmount(for: currency))")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)
                .monospacedDigit()
                .sensitiveAmount()
        }
    }
}

#Preview {
    BudgetLineHeroCard(
        line: BudgetLine(
            id: "courses", budgetId: "b", templateLineId: nil, savingsGoalId: nil, name: "Courses",
            amount: 600, kind: .expense, recurrence: .fixed, isManuallyAdjusted: false,
            checkedAt: nil, createdAt: Date(), updatedAt: Date()
        ),
        consumption: BudgetFormulas.Consumption(allocated: 664.20, available: -64.20, percentage: 110.7),
        currency: .chf,
        onCatchUp: {}
    )
    .padding()
    .background(Color.appBackground)
}

// MARK: - Empty movements

extension BudgetLineDetailPage {
    func emptyStateView(for kind: TransactionKind) -> some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(PulpeTypography.amountHeroLight)
                .foregroundStyle(.quaternary)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Rien de noté ici")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(Color.textSecondary)

                Text(emptyStateMessage(for: kind))
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.stepHeaderTop)
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }

    func emptyStateMessage(for kind: TransactionKind) -> String {
        switch kind {
        case .income: AppLocale.string("Note ce qui passe sur ton compte pour suivre tes revenus")
        case .saving: AppLocale.string("Note ce qui passe sur ton compte pour suivre ton épargne")
        case .expense: AppLocale.string("Note ce qui passe sur ton compte pour suivre tes dépenses")
        }
    }
}
