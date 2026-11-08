import SwiftUI

/// Net worth as the dominant figure, with what I have and what I owe beside it. A negative
/// net reads in the warning ink, never the error red (`docs/BUSINESS_RULES.md`, Patrimoine).
struct NetWorthHero: View {
    let sections: NetWorthSections

    private var isNegative: Bool { sections.net < 0 }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            Text("Ma fortune nette")
                .font(PulpeTypography.pageSubtitle)
                .foregroundStyle(Color.textSecondary)
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
                Text(sections.net.asCompactAmount(for: sections.baseCurrency))
                    .font(PulpeTypography.bigAmount)
                Text(sections.baseCurrency.symbol)
                    .font(PulpeTypography.bigCurrencySuffix)
                    .foregroundStyle(Color.textSecondary)
            }
            .foregroundStyle(isNegative ? Color.financialOverBudget : Color.textPrimary)
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .sensitiveAmount()

            HStack(spacing: DesignTokens.Spacing.xl) {
                figure(title: AppLocale.string("Ce que j'ai"), amount: sections.gross)
                figure(title: AppLocale.string("Ce que je dois"), amount: sections.debtsTotal)
            }

            if isNegative {
                // swiftlint:disable:next line_length
                note("Ce que je dois dépasse ce que j'ai aujourd'hui. Chaque remboursement pointé ramène ce chiffre vers zéro.")
            }
            if sections.hasForeignValues {
                note("Les valeurs en devise étrangère sont converties au taux du jour.")
            }
            if sections.incomplete, !sections.unconverted.isEmpty {
                InfoBanner(.over, systemImage: "exclamationmark.circle", text: incompleteNotice)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private func figure(title: String, amount: Decimal) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(title)
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
            Text(amount.asCompactCurrency(sections.baseCurrency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
        }
    }

    private func note(_ key: LocalizedStringKey) -> some View {
        Text(key)
            .font(PulpeTypography.captionRegular)
            .foregroundStyle(Color.textSecondary)
    }

    /// Currencies and names only, never an amount.
    private var incompleteNotice: String {
        let unconverted = sections.unconverted
        let formatter = ListFormatter()
        formatter.locale = AppLocale.currentUILocale
        let currencies = formatter.string(from: Array(Set(unconverted.map(\.currency.rawValue))).sorted()) ?? ""
        let names = formatter.string(from: unconverted.map(\.name)) ?? ""
        return AppLocale.string(
            // swiftlint:disable:next line_length
            "Je n'ai pas le taux \(currencies) du jour : le total ne compte pas \(names). Il reviendra dès que le taux sera disponible."
        )
    }
}
