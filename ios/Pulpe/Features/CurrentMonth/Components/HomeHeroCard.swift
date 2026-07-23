import SwiftUI

/// Tour 11 hero — flat mint card, identical across emotion states.
/// Only the state chip, the numbers and the contextual line change:
/// the brand doesn't panic when the month drifts.
struct HomeHeroCard: View {
    let metrics: BudgetFormulas.Metrics
    let monthName: String
    /// Outflows already pointed — expenses *and* savings transfers actually made. Pairs with
    /// `metrics.totalExpenses` (which counts both), so the bar's segments reconcile.
    /// The planned figure alone is `Σ max(line.amount, consumed)`, identical on day 1 and
    /// day 31 of a month spent within plan — it can't drive a bar that sits under
    /// "Jour 23/31" and reads as progress through the month.
    let realizedOutflows: Decimal
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

    /// The bar divides the month's income into `pointé + engagé + restant`, which sum to
    /// `available` — so the third segment *is* the hero figure above it, and the bar finally
    /// explains where that number comes from instead of being unrelated to it.
    ///
    /// Over-committed months normalise against `totalExpenses` instead: the bar fills
    /// completely and the legend carries the negative "restant".
    private var barTotal: Decimal {
        max(metrics.available, metrics.totalExpenses)
    }

    private func fraction(of amount: Decimal) -> Double {
        guard barTotal > 0, amount > 0 else { return 0 }
        return Double(truncating: (amount / barTotal) as NSDecimalNumber)
    }

    /// Committed but not yet gone — planned outflows still waiting to be pointed.
    private var reservedAmount: Decimal {
        max(metrics.totalExpenses - realizedOutflows, 0)
    }

    private var barSegments: [HomeSegmentedBar.Segment] {
        [
            .init(fraction: fraction(of: realizedOutflows), color: .homeHeroInk),
            .init(fraction: fraction(of: reservedAmount), color: .homeHeroReserved)
        ]
    }

    // MARK: - Accessibility

    private var accessibilityDescription: String {
        if amountsHidden {
            return "Reste ce mois — montant masqué"
        }
        var desc = """
        Reste ce mois \(metrics.remaining.asCurrency(currency)). \
        Sur \(metrics.available.asCurrency(currency)) : \
        \(realizedOutflows.asCurrency(currency)) pointé, \
        \(reservedAmount.asCurrency(currency)) engagé
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
            .accessibilityHint("Voir le suivi du budget")

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
                // Sharing one row, the eyebrow truncates to "Reste ce…" and the chip wraps to
                // two lines. Stacked, each gets the card's full width and stays whole.
                if dynamicTypeSize >= .xLarge {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                        eyebrow
                        stateChip
                    }
                } else {
                    HStack {
                        eyebrow
                        Spacer()
                        stateChip
                    }
                }

                HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                    Text(metrics.remaining.asCompactAmount(for: currency))
                        .font(PulpeTypography.heroIcon)
                        .tracking(DesignTokens.Tracking.hero)
                        .monospacedDigit()
                        .minimumScaleFactor(DesignTokens.TextScale.floor)
                        .lineLimit(1)
                        .foregroundStyle(Color.homeHeroInk)
                        .contentTransition(.numericText())
                        .sensitiveAmount()

                    // Scales with the figure beside it — without a matching floor the 20pt
                    // suffix outgrows the shrinking 48pt amount at accessibility sizes.
                    Text(currency.symbol)
                        .font(PulpeTypography.amountCard)
                        .foregroundStyle(Color.homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted))
                        .lineLimit(1)
                        .minimumScaleFactor(DesignTokens.TextScale.floor)
                }
            }

            if let contextLine {
                Text(contextLine)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.homeHeroSupport)
            }

            HomeSegmentedBar(
                segments: barSegments,
                trackColor: .homeHeroOverlay,
                height: DesignTokens.ProgressBar.heroHeight,
                // The track alone is 1.17:1 against the mint card, so the bar's full extent
                // is invisible and a low fill reads as a floating stub with no scale. A
                // hairline carries the extent at 3.50:1 without darkening the track itself,
                // which would sink the fill/track contrast below 3:1 in the process.
                borderColor: .homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted)
            )
            .padding(.top, DesignTokens.Spacing.xxs)

            // The legend is inline and always visible rather than behind an info affordance:
            // a bar whose key needs a tap has failed the glance this screen is built for.
            legend

            // Only below .xLarge — from .xLarge upward the legend stacks vertically and
            // carries `dayLabel` itself; rendering it here too duplicated "Jour X/Y" at
            // exactly .xLarge, where both gates used to be true.
            if dynamicTypeSize < .xLarge {
                dayLabel
            }
        }
        .padding(DesignTokens.Spacing.xl)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    private var eyebrow: some View {
        Text("Reste ce mois · \(monthName)")
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.homeHeroSupport)
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.compact)
    }

    private var stateChip: some View {
        PulpeChip(
            dotColor: stateDotColor,
            label: stateLabel,
            style: .tinted(surface: .homeHeroOverlay, foreground: .homeHeroInk)
        )
    }

    // MARK: - Legend

    /// Names each band of the bar next to its value. Wraps instead of truncating, and drops
    /// to one item per line at large text sizes.
    private struct LegendEntry: Identifiable {
        let swatch: Color
        let label: String
        let amount: Decimal

        var id: String { label }
    }

    private var legendEntries: [LegendEntry] {
        [
            LegendEntry(swatch: .homeHeroInk, label: "Pointé", amount: realizedOutflows),
            LegendEntry(swatch: .homeHeroReserved, label: "Engagé", amount: reservedAmount),
            LegendEntry(swatch: .homeHeroOverlay, label: "Restant", amount: metrics.remaining)
        ]
    }

    @ViewBuilder
    private var legend: some View {
        if dynamicTypeSize >= .xLarge {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                ForEach(legendEntries) { entry in
                    legendItem(entry.swatch, entry.label, entry.amount)
                }
                dayLabel
            }
        } else {
            HStack(spacing: DesignTokens.Spacing.md) {
                ForEach(legendEntries) { entry in
                    legendItem(entry.swatch, entry.label, entry.amount)
                    if entry.id != legendEntries.last?.id { Spacer(minLength: 0) }
                }
            }
        }
    }

    private func legendItem(_ swatch: Color, _ label: String, _ amount: Decimal) -> some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            Circle()
                .fill(swatch)
                .frame(
                    width: DesignTokens.ChipMetrics.stateDotSize,
                    height: DesignTokens.ChipMetrics.stateDotSize
                )
                // The "Restant" swatch is the track colour, near-invisible on the mint card
                // without an edge — the same 1.17:1 problem the bar's hairline solves.
                .overlay {
                    Circle().strokeBorder(
                        Color.homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted),
                        lineWidth: DesignTokens.BorderWidth.thin
                    )
                }

            (
                Text("\(label) ")
                + Text(amount.asCompactAmount(for: currency))
                    .fontWeight(.semibold)
                    .foregroundStyle(Color.homeHeroInk)
            )
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.homeHeroSupport)
            .monospacedDigit()
            .lineLimit(1)
            .minimumScaleFactor(DesignTokens.TextScale.floor)
            .sensitiveAmount()
        }
        .accessibilityElement(children: .combine)
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
                .foregroundStyle(Color.homeHeroInk.opacity(DesignTokens.Opacity.heroInkMuted))
        }
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.vertical, DesignTokens.Spacing.md)
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
                realizedOutflows: 9100,
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
                realizedOutflows: 4200,
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
                realizedOutflows: 2600,
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
