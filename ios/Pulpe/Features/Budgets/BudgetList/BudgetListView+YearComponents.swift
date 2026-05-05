import SwiftUI

// MARK: - Year Recap Card

struct YearRecapCard: View {
    let year: Int
    let budgets: [BudgetSparse]
    var isPastYear: Bool = false

    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// Sum of endingBalance per month (remaining - rollover) to avoid double-counting rollover across months
    private var yearTotal: Decimal {
        budgets.compactMap { budget in
            guard let remaining = budget.remaining else { return nil as Decimal? }
            return remaining - (budget.rollover ?? 0)
        }.reduce(0, +)
    }

    private var emotionColor: Color {
        yearTotal >= 0 ? Color.pulpePrimary : Color.financialExpense
    }

    private var monthProgress: Double {
        guard !budgets.isEmpty else { return 0 }
        return Double(budgets.count) / 12.0
    }

    private var subtitle: String {
        let count = budgets.count
        if count == 0 {
            return "Aucun mois budgétisé. Commence dès maintenant."
        }
        if count == 12 {
            return "Tu as budgétisé toute l'année. Bravo !"
        }
        return "Tu as budgétisé \(count) mois sur 12 sur l'année. "
            + "Ton potentiel de croissance est encore incomplet."
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(isPastYear ? "Bilan de l'année" : "Potentiel de l'année")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
                .tracking(DesignTokens.Tracking.title)

            heroAmount

            progressBar

            Text(subtitle)
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.secondary)
        }
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "\(isPastYear ? "Bilan" : "Potentiel") \(year), "
            + (amountsHidden
                ? "montant masqué"
                : yearTotal.asArithmeticSignedCompactCurrency(userSettingsStore.currency))
            + ", \(budgets.count) mois sur 12"
        )
    }

    private var heroAmount: some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.xs) {
            Text(yearTotal.asSignedCompactAmount(for: userSettingsStore.currency))
                .font(PulpeTypography.heroIcon)
                .monospacedDigit()
                .tracking(DesignTokens.Tracking.hero)
                .foregroundStyle(emotionColor)
                .sensitiveAmount()
            Text(userSettingsStore.currency.symbol)
                .font(PulpeTypography.tutorialTitle)
                .foregroundStyle(emotionColor)
        }
    }

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.textPrimary.opacity(DesignTokens.Opacity.highlightBackground))
                    .frame(height: DesignTokens.ProgressBar.heroHeight)
                Capsule()
                    .fill(emotionColor)
                    .frame(
                        width: max(
                            geo.size.width * monthProgress,
                            DesignTokens.ProgressBar.heroHeight
                        ),
                        height: DesignTokens.ProgressBar.heroHeight
                    )
            }
        }
        .frame(height: DesignTokens.ProgressBar.heroHeight)
    }
}

// MARK: - Year Picker

struct YearPicker: View {
    let years: [Int]
    @Binding var selectedYear: Int

    var body: some View {
        ScrollViewReader { proxy in
            ScrollView(.horizontal, showsIndicators: false) {
                HStack(spacing: 0) {
                    ForEach(Array(years.enumerated()), id: \.element) { index, year in
                        let isSelected = selectedYear == year
                        Button {
                            withAnimation(.snappy(duration: DesignTokens.Animation.fast)) {
                                selectedYear = year
                            }
                        } label: {
                            Text(String(year))
                                .font(PulpeTypography.labelLargeBold)
                                .foregroundStyle(
                                    isSelected ? Color.pulpePrimary : Color.secondary
                                )
                                .padding(.horizontal, DesignTokens.Spacing.xxl)
                                .padding(.vertical, DesignTokens.Spacing.sm)
                                .background(
                                    isSelected
                                        ? Color.pulpePrimary.opacity(DesignTokens.Opacity.faint)
                                        : Color.clear
                                )
                                .clipShape(Capsule())
                                .overlay(
                                    Capsule().strokeBorder(
                                        isSelected
                                            ? Color.pulpePrimary
                                            : Color.clear,
                                        lineWidth: DesignTokens.BorderWidth.thin
                                    )
                                )
                        }
                        .id(year)
                        .frame(minHeight: DesignTokens.TapTarget.minimum)
                        .contentShape(Capsule())
                        .plainPressedButtonStyle()
                        .accessibilityLabel("Année \(year)")
                        .accessibilityAddTraits(
                            isSelected ? [.isButton, .isSelected] : .isButton
                        )

                        // Separator between years
                        if index < years.count - 1 {
                            Text("|")
                                .font(PulpeTypography.onboardingSubtitle)
                                .foregroundStyle(
                                    Color.secondary.opacity(DesignTokens.Opacity.secondary)
                                )
                                .padding(.horizontal, DesignTokens.Spacing.xs)
                                .accessibilityHidden(true)
                        }
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
            }
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
