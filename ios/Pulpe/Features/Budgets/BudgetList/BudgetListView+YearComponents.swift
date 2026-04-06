import SwiftUI

// MARK: - Year Recap Card

struct YearRecapCard: View {
    let year: Int
    let budgets: [BudgetSparse]

    @Environment(\.amountsHidden) private var amountsHidden

    /// Sum of endingBalance per month (remaining - rollover) to avoid double-counting rollover across months
    private var yearTotal: Decimal {
        budgets.compactMap { budget in
            guard let remaining = budget.remaining else { return nil as Decimal? }
            return remaining - (budget.rollover ?? 0)
        }.reduce(0, +)
    }

    private var monthProgress: Double {
        guard !budgets.isEmpty else { return 0 }
        return Double(budgets.count) / 12.0
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Label
            Text("Bilan \(String(year))")
                .font(PulpeTypography.detailLabelBold)
                .foregroundStyle(Color.secondary)
                .textCase(.uppercase)
                .tracking(DesignTokens.Tracking.uppercase)

            // Big amount
            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(
                    Formatters.chfWholeNumber.string(
                        from: yearTotal as NSDecimalNumber
                    ) ?? "0"
                )
                .font(PulpeTypography.heroIcon)
                .monospacedDigit()
                .tracking(DesignTokens.Tracking.hero)
                .foregroundStyle(Color.textPrimary)
                .sensitiveAmount()
                Text("CHF")
                    .font(PulpeTypography.tutorialTitle)
                    .foregroundStyle(Color.pulpePrimary)
            }

            // Progress bar
            GeometryReader { geo in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.secondary.opacity(DesignTokens.Opacity.highlightBackground))
                        .frame(height: DesignTokens.ProgressBar.heroHeight)
                    Capsule()
                        .fill(
                            LinearGradient(
                                colors: Color.heroGradientComfortable,
                                startPoint: .leading,
                                endPoint: .trailing
                            )
                        )
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

            // Subtitle
            Text("\(budgets.count) mois budgétisés sur 12")
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.secondary)
                .padding(.top, DesignTokens.Spacing.xs)
        }
        .padding(DesignTokens.Spacing.xxl)
        .background {
            ZStack(alignment: .topTrailing) {
                Color.surfaceContainerLowest
                Circle()
                    .fill(
                        LinearGradient(
                            colors: Color.heroGradientComfortable,
                            startPoint: .topLeading,
                            endPoint: .bottomTrailing
                        )
                    )
                    .frame(width: 160, height: 160)
                    .blur(radius: 32)
                    .opacity(DesignTokens.Opacity.faint)
                    .offset(x: 32, y: -32)
            }
        }
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
        .shadow(DesignTokens.Shadow.elevated)
        .accessibilityElement(children: .combine)
        .accessibilityLabel(
            "Bilan \(year), "
            + (amountsHidden ? "montant masqué" : "total disponible \(yearTotal.asCompactCHF)")
            + ", \(budgets.count) mois sur 12"
        )
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
                                .font(
                                    isSelected
                                    ? PulpeTypography.labelLargeBold
                                    : PulpeTypography.onboardingSubtitle
                                )
                                .padding(.horizontal, DesignTokens.Spacing.xxl)
                                .padding(.vertical, DesignTokens.Spacing.sm)
                                .background(isSelected ? Color.pulpePrimary : .clear)
                                .foregroundStyle(isSelected ? Color.textOnPrimary : Color.secondary)
                                .clipShape(Capsule())
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
            .onAppear {
                proxy.scrollTo(selectedYear, anchor: .center)
            }
            .onChange(of: selectedYear) { _, newYear in
                withAnimation {
                    proxy.scrollTo(newYear, anchor: .center)
                }
            }
        }
    }
}
