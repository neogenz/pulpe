import SwiftUI

// MARK: - Year Recap

/// The year's one figure, on a white card (V2 `Annee`): the year-end balance to the cent,
/// in ink (ocre below zero), and the sentence it rests on.
struct YearRecapCard: View {
    let year: Int
    let budgets: [BudgetSparse]
    var isPastYear: Bool = false
    var showsDetails = true

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// Year-end balance = the last budgeted month's cumulative `remaining` (PUL-263).
    /// `remaining` already includes rollover, so the latest month carries the whole-year
    /// balance, including the opening balance brought forward from prior years.
    private var closingBalance: Decimal {
        BudgetFormulas.yearClosingBalance(budgets)
    }

    private var currency: SupportedCurrency { userSettingsStore.currency }

    private var eyebrow: String {
        BudgetListPresentation.recapEyebrow(year: year, isPastYear: isPastYear)
    }

    private var sentence: String {
        BudgetListPresentation.recapSentence(year: year, budgetCount: budgets.count, isPastYear: isPastYear)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(eyebrow)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.textSecondary)

            (Text(verbatim: closingBalance.rounded(2).asAmount(for: currency))
                .font(PulpeTypography.heroAmount)
                .tracking(DesignTokens.Tracking.hero)
                + Text(verbatim: " \(currency.symbol)")
                .font(PulpeTypography.heroCurrencySuffix)
                .foregroundStyle(Color.textTertiary))
                .monospacedDigit()
                .minimumScaleFactor(DesignTokens.TextScale.floor)
                .lineLimit(1)
                .foregroundStyle(closingBalance.rounded(2) < 0 ? Color.financialOverBudget : Color.textPrimary)
                .contentTransition(.numericText())
                .sensitiveAmount()
                .accessibilityIdentifier("yearRecapAmount")

            if showsDetails {
                Text(sentence)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textPrimary)
                    .fixedSize(horizontal: false, vertical: true)
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeSurfaceCard()
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            eyebrow
                + ", "
                + (amountsHidden
                    ? AppLocale.string("montant masqué")
                    : closingBalance.asArithmeticSignedCompactCurrency(currency))
                + ", "
                + sentence
        )
    }
}
