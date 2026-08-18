import SwiftUI

/// « Ton suivi » section of `SavingsGoalDetailView` — the goal's linked
/// forecasts, each with its real transactions, in one ledger card. Extracted
/// from the detail view to keep both files under the
/// `file_length`/`type_body_length` ceilings.
struct GoalContributionsSection: View {
    let contributions: [SavingsGoalContribution]
    let currency: SupportedCurrency
    let isLoading: Bool
    let error: Error?
    let onRetry: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            SectionHeader(title: AppLocale.string("Ton suivi"))

            if isLoading, contributions.isEmpty {
                ProgressView("Chargement du suivi…")
                    .frame(maxWidth: .infinity)
                    .padding(DesignTokens.Spacing.xl)
            } else if let error, contributions.isEmpty {
                GoalInfoCard(
                    icon: "arrow.clockwise",
                    title: AppLocale.string("Suivi indisponible"),
                    message: DomainErrorLocalizer.localize(error)
                ) {
                    Button("Réessayer", action: onRetry)
                        .secondaryButtonStyle()
                }
            } else if !contributions.isEmpty {
                // One card holds the whole list, hairlines inside it: a card per
                // month turned a plan of twelve into twelve floating blocks. The
                // card is what needs the emptiness guard, not the list: an empty
                // `ForEach` drew nothing, an empty card draws a hollow block.
                VStack(spacing: DesignTokens.Spacing.none) {
                    ForEach(Array(contributions.enumerated()), id: \.element.id) { index, contribution in
                        if index > 0 { Divider() }
                        contributionRow(contribution)
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.vertical, DesignTokens.Spacing.xs)
                .pulpeRowCard()
            }
        }
    }

    private func contributionRow(_ contribution: SavingsGoalContribution) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(contribution.name)
                        .font(PulpeTypography.labelLarge)
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
                    .font(PulpeTypography.amountMedium)
                    .monospacedDigit()
                    .foregroundStyle(Color.textPrimary)
                    .sensitiveAmount()
            }
            .accessibilityElement(children: .combine)

            if !contribution.transactions.isEmpty {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    // Même rôle que « Retraits planifiés » : une étiquette qui
                    // nomme un groupe, pas un titre de rangée.
                    Text("Réel")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.textTertiary)

                    ForEach(Array(contribution.transactions.enumerated()), id: \.element.id) { index, transaction in
                        if index > 0 { Divider() }
                        contributionTransactionRow(transaction)
                    }
                }
                .padding(.leading, DesignTokens.Spacing.md)
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
    }

    private func contributionTransactionRow(_ transaction: Transaction) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(transaction.name)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(dynamicTypeSize.isAccessibilitySize ? nil : 2)
                statusSubtitle(
                    base: transaction.transactionDate.abbreviatedDateFormatted,
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
        let status = isChecked
            ? Text("Pointé").foregroundStyle(Color.financialSavings)
            : Text("À pointer").foregroundStyle(Color.textTertiary)
        return (
            Text(verbatim: "\(base) · ")
                .foregroundStyle(Color.textTertiary)
            + status
        )
        .font(PulpeTypography.labelMedium)
    }
}
