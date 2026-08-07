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

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ton suivi")
                .font(PulpeTypography.title2)
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
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(contribution.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                    // Statut en texte, pas en glyphe : le cercle vide est le
                    // vocabulaire du `PointCircle` interactif partout ailleurs —
                    // ici la surface est passive, un faux contrôle trahit le tap.
                    // `String(year)` : l'interpolation d'Int dans Text applique le
                    // groupement localisé ("2'026" en de-CH) — jamais sur une année.
                    statusSubtitle(
                        base: "\(Formatters.monthName(for: contribution.budgetMonth)) "
                            + String(contribution.budgetYear),
                        isChecked: contribution.isChecked
                    )
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(contribution.amount.asCurrency(currency))
                    .font(PulpeTypography.amountCard)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }
            .accessibilityElement(children: .combine)

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
                .padding(.leading, DesignTokens.Spacing.md)
            }
        }
        .pulpeCard()
    }

    private func contributionTransactionRow(_ transaction: Transaction) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.listRowSubtitle)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                statusSubtitle(
                    base: transaction.transactionDate.formatted(date: .abbreviated, time: .omitted),
                    isChecked: transaction.isChecked
                )
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            Text(transaction.amount.asCurrency(currency))
                .font(PulpeTypography.metricLabelBold)
                .monospacedDigit()
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
        }
        .accessibilityElement(children: .combine)
    }

    /// « Juillet 2026 · Pointé » / « 23 juil. 2026 · À pointer » — le statut de
    /// pointage vit dans la ligne de métadonnées ; seul « Pointé » prend la
    /// couleur épargne pour signaler le comptabilisé d'un coup d'œil.
    private func statusSubtitle(base: String, isChecked: Bool) -> some View {
        (
            Text("\(base) · ")
                .foregroundStyle(Color.textTertiary)
            + Text(isChecked ? "Pointé" : "À pointer")
                .foregroundStyle(isChecked ? Color.financialSavings : Color.textTertiary)
        )
        .font(PulpeTypography.listRowSubtitle)
    }
}
