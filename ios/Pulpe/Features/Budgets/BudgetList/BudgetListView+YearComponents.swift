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
            (isPastYear
                ? AppLocale.string("Bilan \(String(year))")
                : AppLocale.string("Potentiel \(String(year))"))
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

/// Horizontal year selector in hero ink: the selection is a `heroTile` tile, the others
/// plain `heroInkSecondary` text.
struct YearPicker: View {
    let years: [Int]
    @Binding var selectedYear: Int

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: DesignTokens.Spacing.xs) {
                    ForEach(years, id: \.self) { year in
                        let isSelected = selectedYear == year
                        Button {
                            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                                selectedYear = year
                            }
                        } label: {
                            Text(String(year))
                                .font(PulpeTypography.labelLargeBold)
                                .foregroundStyle(isSelected ? Color.heroInk : Color.heroInkSecondary)
                                .padding(.horizontal, DesignTokens.Spacing.lg)
                                .padding(.vertical, DesignTokens.Spacing.sm)
                                .background(
                                    isSelected ? Color.heroTile : Color.clear,
                                    in: .rect(cornerRadius: DesignTokens.CornerRadius.button)
                                )
                        }
                        .id(year)
                        .frame(minHeight: DesignTokens.TapTarget.minimum)
                        .contentShape(Rectangle())
                        .plainPressedButtonStyle()
                        .accessibilityLabel("Année \(year)")
                        .accessibilityAddTraits(
                            isSelected ? [.isButton, .isSelected] : .isButton
                        )
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .scrollClipDisabled()
            .sensoryFeedback(.selection, trigger: selectedYear)
            .task {
                await Task.yield()
                proxy.scrollTo(selectedYear, anchor: .center)
            }
            .onChange(of: selectedYear) { _, newYear in
                withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                    proxy.scrollTo(newYear, anchor: .center)
                }
            }
        }
    }
}
