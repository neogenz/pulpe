import SwiftUI

/// « Ton suivi » section of `SavingsGoalDetailView` — one card per linked
/// forecast with its real transactions. Extracted from the detail view to
/// keep both files under the `file_length`/`type_body_length` ceilings.
struct GoalContributionsSection: View {
    let contributions: [SavingsGoalContribution]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onRetry: () -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ton suivi")
                .font(PulpeTypography.title)
                .foregroundStyle(Color.textPrimary)

            if isLoading, contributions.isEmpty {
                ProgressView("Chargement du suivi…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if let error, contributions.isEmpty {
                GoalInfoCard(
                    icon: "arrow.clockwise",
                    title: "Suivi indisponible",
                    message: DomainErrorLocalizer.localize(error)
                ) {
                    Button("Réessayer", action: onRetry)
                        .secondaryButtonStyle()
                }
            } else {
                ForEach(contributions) { contribution in
                    contributionCard(contribution)
                }
            }
        }
    }

    private func contributionCard(_ contribution: SavingsGoalContribution) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: contribution.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(PulpeTypography.actionIcon)
                    .foregroundStyle(contribution.isChecked ? Color.financialSavings : Color.textTertiary)
                    .accessibilityLabel(contribution.isChecked ? "Prévision pointée" : "Prévision à pointer")

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(contribution.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(2)
                    Text("\(Formatters.monthName(for: contribution.budgetMonth)) \(contribution.budgetYear)")
                        .font(PulpeTypography.listRowSubtitle)
                        .foregroundStyle(Color.textTertiary)
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(contribution.amount.asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }

            if !contribution.transactions.isEmpty {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    Text("Transactions réelles")
                        .font(PulpeTypography.metricLabel)
                        .foregroundStyle(Color.textSecondary)

                    ForEach(Array(contribution.transactions.enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 { Divider() }
                        contributionTransactionRow(transaction)
                    }
                }
                .padding(.leading, DesignTokens.IconSize.compact + DesignTokens.Spacing.md)
            }
        }
        .pulpeCard()
    }

    private func contributionTransactionRow(_ transaction: Transaction) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: transaction.isChecked ? "checkmark.circle.fill" : "circle")
                .foregroundStyle(transaction.isChecked ? Color.financialSavings : Color.textTertiary)
                .accessibilityLabel(transaction.isChecked ? "Transaction pointée" : "Transaction à pointer")

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(2)
                Text(transaction.transactionDate.formatted(date: .abbreviated, time: .omitted))
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(transaction.amount.asCurrency(currency))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
        }
    }
}
