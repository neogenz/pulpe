import SwiftUI

// MARK: - Year Recap (hero zone content)

/// Hero content of the yearly view (ios/DESIGN.md, One Hero per screen): the signed
/// year-end balance, two tiles and a verdict. Painted on `HeroZoneSurface` by the parent.
struct YearRecapCard: View {
    let year: Int
    let budgets: [BudgetSparse]
    var isPastYear: Bool = false

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// Year-end balance = the last budgeted month's cumulative `remaining` (PUL-263).
    /// `remaining` already includes rollover, so the latest month carries the whole-year
    /// balance, including the opening balance brought forward from prior years.
    private var closingBalance: Decimal {
        BudgetFormulas.yearClosingBalance(budgets)
    }

    private var subtitle: String {
        let count = budgets.count
        if count == 0 {
            return AppLocale.string("Aucun mois budgétisé. Commence dès maintenant.")
        }
        if count == 12 {
            return AppLocale.string("Tu as budgétisé toute l'année. Bravo !")
        }
        return AppLocale.string("Tu as budgétisé \(count) mois sur 12 sur l'année.")
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            HeroFigure(
                eyebrow: isPastYear ? AppLocale.string("Bilan de l'année") : AppLocale.string("Solde fin d'année"),
                amount: closingBalance,
                currency: userSettingsStore.currency,
                signed: true,
                alignment: .leading,
                accessibilityIdentifier: "yearRecapAmount"
            )

            HeroMetricTileRow {
                HeroMetricTile(
                    icon: "calendar",
                    label: AppLocale.string("mois"),
                    value: "\(budgets.count) / 12"
                )
            }

            HeroVerdictRow(sentence: subtitle)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            // Same words as the eyebrow above: VoiceOver and the screen have to
            // name the same figure.
            (isPastYear
                ? AppLocale.string("Bilan \(String(year))")
                : AppLocale.string("Solde fin d'année \(String(year))"))
            + ", "
            + (amountsHidden
                ? AppLocale.string("montant masqué")
                : closingBalance.asArithmeticSignedCompactCurrency(userSettingsStore.currency))
            + ", "
            + AppLocale.string("\(budgets.count) mois sur 12")
        )
    }
}

// MARK: - Year Picker

/// Native year control, shared by the compact list and the expanded sidebar.
struct YearPicker: View {
    let years: [Int]
    @Binding var selectedYear: Int

    var body: some View {
        Picker("Année", selection: $selectedYear) {
            ForEach(years, id: \.self) { year in
                Text(String(year)).tag(year)
            }
        }
        .pickerStyle(.menu)
        .accessibilityIdentifier("budgetYearPicker")
        .sensoryFeedback(.selection, trigger: selectedYear)
    }
}
