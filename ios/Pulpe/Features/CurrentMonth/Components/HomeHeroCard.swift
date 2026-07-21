import SwiftUI

/// Tour 11 hero — flat mint card, identical across emotion states.
/// Only the state chip, the numbers and the contextual line change:
/// the brand doesn't panic when the month drifts.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    let monthName: String
    let dayProgress: (day: Int, totalDays: Int)?
    let dailyMargin: Decimal
    /// Deficit-only contextual line ("Report auto en août · retour au vert en septembre").
    let deficitContext: String?
    var onTapMetrics: () -> Void
    var onTapDetail: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @State private var tapTrigger = false

    private var currency: SupportedCurrency { userSettingsStore.currency }

    // MARK: - State Mapping

    private var stateLabel: String {
        switch metrics.emotionState {
        case .comfortable: "Belle marge"
        case .tight: "Serré"
        case .deficit: "On gère"
        }
    }

    private var stateDotColor: Color {
        switch metrics.emotionState {
        case .comfortable: .financialSavings
        case .tight: .heroTintTight
        case .deficit: .driftAccent
        }
    }

    private var contextLine: String? {
        switch metrics.emotionState {
        case .deficit: deficitContext
        case .tight, .comfortable: dailyAllowanceLine
        }
    }

    /// Actionable daily allowance. The state chip already carries the mood, so the
    /// line stays purely useful. Nil when there's no positive margin to spread.
    private var dailyAllowanceLine: String? {
        guard dailyMargin > 0 else { return nil }
        return "Tu peux dépenser ≈\(dailyMargin.asCompactCurrency(currency))/jour"
    }

    // MARK: - Progress Fractions

    /// Planned part of the bar: usage when within plan, `available / spent` when over.
    private var fillFraction: Double {
        if metrics.remaining < 0 {
            guard metrics.totalExpenses > 0, metrics.available > 0 else { return 0 }
            return Double(truncating: (metrics.available / metrics.totalExpenses) as NSDecimalNumber)
        }
        return min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var overflowFraction: Double {
        guard metrics.remaining < 0, metrics.totalExpenses > 0 else { return 0 }
        return 1 - fillFraction
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        if amountsHidden {
            return "Reste ce mois — montant masqué"
        }
        var desc = """
        Reste ce mois \(metrics.remaining.asCurrency(currency)). \
        Dépensé \(metrics.totalExpenses.asCurrency(currency)) sur \(metrics.available.asCurrency(currency))
        """
        if let dayProgress {
            desc += ". Jour \(dayProgress.day) sur \(dayProgress.totalDays)"
        }
        if let contextLine {
            desc += ". \(contextLine)"
        }
        return desc
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            Button {
                tapTrigger.toggle()
                onTapMetrics()
            } label: {
                metricsContent
            }
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .sensoryFeedback(.impact(flexibility: .soft), trigger: tapTrigger)
            .accessibilityLabel(accessibilityDescription)
            .accessibilityHint("Voir le solde réalisé")

            Rectangle()
                .fill(Color.homeHeroInk.opacity(DesignTokens.Opacity.badgeBackground))
                .frame(height: DesignTokens.BorderWidth.thin)
                .padding(.horizontal, DesignTokens.Spacing.xl)

            Button(action: onTapDetail) {
                detailRow
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .plainPressedButtonStyle()
            .accessibilityLabel("Détail du budget")
        }
        .background {
            LinearGradient(
                colors: [Color.homeHeroSurfaceTop, Color.homeHeroSurface],
                startPoint: .top,
                endPoint: .bottom
            )
        }
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
        .overlay {
            // Rim light on the top lip — fades to clear by mid-card so it reads as
            // light on a material, not a border.
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg)
                .strokeBorder(
                    LinearGradient(
                        colors: [Color.homeHeroHighlight, .clear],
                        startPoint: .top,
                        endPoint: .center
                    ),
                    lineWidth: DesignTokens.BorderWidth.thin
                )
        }
        .shadow(DesignTokens.Shadow.elevated)
        .animation(DesignTokens.Animation.smoothEaseInOut, value: metrics)
    }

    // MARK: - Metrics Zone

    private var metricsContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            // Eyebrow + amount read as one unit — the label captions the number.
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                HStack {
                    Text("Reste ce mois · \(monthName)")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(Color.homeHeroSupport)

                    Spacer()

                    PulpeChip(
                        dotColor: stateDotColor,
                        label: stateLabel,
                        style: .tinted(surface: .homeHeroOverlay, foreground: .homeHeroInk)
                    )
                }

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(metrics.remaining.asCompactAmount(for: currency))
                        .font(PulpeTypography.heroIcon)
                        .tracking(DesignTokens.Tracking.hero)
                        .monospacedDigit()
                        .minimumScaleFactor(0.6)
                        .lineLimit(1)
                        .foregroundStyle(Color.homeHeroInk)
                        .contentTransition(.numericText())
                        .sensitiveAmount()

                    Text(currency.symbol)
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(Color.homeHeroInk.opacity(DesignTokens.Opacity.heavy))
                }
            }

            if let contextLine {
                Text(contextLine)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.homeHeroSupport)
            }

            HomeSegmentedBar(
                fillFraction: fillFraction,
                overflowFraction: overflowFraction,
                fillColor: .homeHeroInk,
                overflowColor: .driftAccent,
                trackColor: .homeHeroOverlay,
                height: DesignTokens.ProgressBar.heroHeight
            )
            .padding(.top, DesignTokens.Spacing.xxs)

            // Side by side these two wrap into each other at accessibility sizes
            // ("Dépensé 2'991 sur 4'300" spilling onto 3 lines beside "Jour 21/31").
            if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    spentLabel
                    dayLabel
                }
            } else {
                HStack {
                    spentLabel
                    Spacer()
                    dayLabel
                }
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var spentLabel: some View {
        (
            Text("Dépensé ")
            + Text(metrics.totalExpenses.asCompactAmount(for: currency))
                .fontWeight(.semibold)
                .foregroundStyle(Color.homeHeroInk)
            + Text(" sur ")
            + Text(metrics.available.asCompactAmount(for: currency))
                .fontWeight(.semibold)
                .foregroundStyle(Color.homeHeroInk)
        )
        .font(PulpeTypography.labelMedium)
        .foregroundStyle(Color.homeHeroSupport)
        .monospacedDigit()
        .sensitiveAmount()
    }

    @ViewBuilder
    private var dayLabel: some View {
        if let dayProgress {
            (
                Text("Jour ")
                + Text("\(dayProgress.day)")
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.homeHeroInk)
                + Text("/\(dayProgress.totalDays)")
            )
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.homeHeroSupport)
            .monospacedDigit()
        }
    }

    // MARK: - Detail Row

    private var detailRow: some View {
        HStack {
            Text("Détail du budget")
                .font(PulpeTypography.labelLarge)
                .foregroundStyle(Color.homeHeroInk)

            Spacer()

            Image(systemName: "chevron.right")
                .font(PulpeTypography.metricLabel)
                .foregroundStyle(Color.homeHeroInk.opacity(DesignTokens.Opacity.heavy))
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
    }
}

// MARK: - Segmented Bar

/// Two-segment capsule bar: planned fill + overflow segment on a solid track.
/// Shared by the home hero and the drift card mini-bars.
struct HomeSegmentedBar: View {
    let fillFraction: Double
    let overflowFraction: Double
    let fillColor: Color
    let overflowColor: Color
    let trackColor: Color
    let height: CGFloat

    var body: some View {
        GeometryReader { geo in
            HStack(spacing: DesignTokens.Spacing.none) {
                fillColor
                    .frame(width: geo.size.width * min(max(fillFraction, 0), 1))
                overflowColor
                    .frame(width: geo.size.width * min(max(overflowFraction, 0), 1 - min(max(fillFraction, 0), 1)))
                Spacer(minLength: 0)
            }
        }
        .background(trackColor)
        .clipShape(Capsule())
        .frame(height: height)
        .accessibilityHidden(true)
    }
}

// MARK: - Preview

#Preview("Home Hero — 3 states") {
    ScrollView {
        VStack(spacing: 24) {
            // Deficit
            HomeHeroCard(
                metrics: .init(
                    totalIncome: 8032,
                    totalExpenses: 10700,
                    totalSavings: 0,
                    available: 8032,
                    endingBalance: -2668,
                    remaining: -2668,
                    rollover: 0
                ),
                monthName: "juillet",
                dayProgress: (day: 17, totalDays: 31),
                dailyMargin: 0,
                deficitContext: "Report auto en août · retour au vert en septembre",
                onTapMetrics: {},
                onTapDetail: {}
            )

            // Tight
            HomeHeroCard(
                metrics: .init(
                    totalIncome: 8032,
                    totalExpenses: 7400,
                    totalSavings: 0,
                    available: 8032,
                    endingBalance: 632,
                    remaining: 632,
                    rollover: 0
                ),
                monthName: "juillet",
                dayProgress: (day: 17, totalDays: 31),
                dailyMargin: 45,
                deficitContext: nil,
                onTapMetrics: {},
                onTapDetail: {}
            )

            // Comfortable
            HomeHeroCard(
                metrics: .init(
                    totalIncome: 8032,
                    totalExpenses: 4900,
                    totalSavings: 500,
                    available: 8032,
                    endingBalance: 3132,
                    remaining: 3132,
                    rollover: 0
                ),
                monthName: "juillet",
                dayProgress: (day: 17, totalDays: 31),
                dailyMargin: 224,
                deficitContext: nil,
                onTapMetrics: {},
                onTapDetail: {}
            )
        }
        .padding()
    }
    .background(Color.homeBackground)
    .environment(UserSettingsStore())
}
