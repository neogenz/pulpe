import SwiftUI

/// The forest-zone ring of the onboarding: what is left of the income once charges (amber) and
/// savings (mint) are taken. An overrun adds a coral arc around it. Mirrors the entered amounts live.
struct OnboardingBudgetRing: View {
    let income: Decimal
    let charges: Decimal
    let savings: Decimal
    let currency: SupportedCurrency
    /// Centre sub-line ("CHF · pour l'instant", "CHF").
    var subtitle: String?

    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var available: Decimal { income - charges - savings }
    private var isOverrun: Bool { available < 0 }
    private var spent: Double { NSDecimalNumber(decimal: charges + savings).doubleValue }
    /// The ring spans the income, or what is spent when that goes past it.
    private var span: Double { max(NSDecimalNumber(decimal: income).doubleValue, spent) }

    private func fraction(_ value: Decimal) -> Double {
        span > 0 ? NSDecimalNumber(decimal: value).doubleValue / span : 0
    }

    var body: some View {
        let chargesEnd = fraction(charges)
        let savingsEnd = chargesEnd + fraction(savings)
        ZStack {
            Circle().stroke(Color.heroInk, lineWidth: DesignTokens.Entry.ringStroke)
            arc(from: 0, to: chargesEnd, color: .heroAccentCaution)
            arc(from: chargesEnd, to: savingsEnd, color: .heroAccentPositive)
            if isOverrun {
                Circle()
                    .trim(from: 0, to: fraction(-available))
                    .stroke(
                        Color.heroAccentDeficit,
                        style: StrokeStyle(lineWidth: DesignTokens.Entry.ringOverflowStroke, lineCap: .round)
                    )
                    .rotationEffect(.degrees(-90))
                    .padding(-DesignTokens.Entry.ringOverflowGap)
            }
            centre
        }
        .frame(width: DesignTokens.Entry.ringSize, height: DesignTokens.Entry.ringSize)
        .padding(DesignTokens.Entry.ringOverflowGap)
        .animation(reduceMotion ? nil : DesignTokens.Animation.defaultSpring, value: available)
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(isOverrun ? "À combler" : "Disponible")
        .accessibilityValue(available.magnitude.asCurrency(currency))
    }

    private func arc(from start: Double, to end: Double, color: Color) -> some View {
        Circle()
            .trim(from: start, to: end)
            .stroke(color, style: StrokeStyle(lineWidth: DesignTokens.Entry.ringStroke, lineCap: .butt))
            .rotationEffect(.degrees(-90))
    }

    private var centre: some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text(isOverrun ? "À combler" : "Disponible")
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(
                    isOverrun ? Color.heroAccentDeficit : Color.heroInk.opacity(DesignTokens.Opacity.overlay)
                )
            Text(available.magnitude.asAmount(for: currency))
                .font(PulpeTypography.ringAmount)
                .foregroundStyle(Color.heroInk)
                .contentTransition(.numericText())
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.floor)
            Text(subtitle ?? currency.rawValue)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.heroInkSecondary)
        }
        .padding(.horizontal, DesignTokens.Spacing.xxl)
    }
}

/// Legend tile under the ring: a dot and a label ("● Charges 3'021.50").
struct OnboardingRingLegendTile: View {
    let color: Color
    let label: String
    var amount: String?

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            Circle().fill(color)
                .frame(width: DesignTokens.ChipMetrics.stateDotSize, height: DesignTokens.ChipMetrics.stateDotSize)
            Text(label)
            if let amount { Text(amount).monospacedDigit() }
        }
        .font(PulpeTypography.metricLabelBold)
        .foregroundStyle(Color.heroInk)
        .padding(.horizontal, DesignTokens.Spacing.md)
        .frame(minHeight: DesignTokens.FrameHeight.chip)
        .background(Color.heroTile, in: Capsule())
        .accessibilityElement(children: .combine)
    }
}

/// Ring of a step with its legend tiles, driven by the onboarding state.
struct OnboardingBudgetZone: View {
    enum Legend { case none, charges, savings, all }

    let state: OnboardingState
    var legend: Legend = .none
    var subtitle: String?

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            OnboardingBudgetRing(
                income: state.totalIncome,
                charges: state.totalCharges,
                savings: state.totalSavings,
                currency: state.currency,
                subtitle: subtitle
            )
            if legend != .none {
                // One row when it fits; a long deficit label drops the remainder tile to its own row.
                ViewThatFits(in: .horizontal) {
                    HStack(spacing: DesignTokens.Spacing.sm) { outflowTiles; remainderTile }
                    VStack(spacing: DesignTokens.Spacing.sm) {
                        HStack(spacing: DesignTokens.Spacing.sm) { outflowTiles }
                        remainderTile
                    }
                }
            }
        }
    }

    @ViewBuilder
    private var outflowTiles: some View {
        OnboardingRingLegendTile(
            color: .heroAccentCaution,
            label: AppLocale.string("Charges"),
            amount: legend == .all ? nil : state.totalCharges.asAmount(for: state.currency)
        )
        if legend != .charges {
            OnboardingRingLegendTile(
                color: .heroAccentPositive,
                label: AppLocale.string("Épargne"),
                amount: legend == .all ? nil : state.totalSavings.asAmount(for: state.currency)
            )
        }
    }

    /// The savings step names both outflows instead; the ring centre already says what is left.
    @ViewBuilder
    private var remainderTile: some View {
        if legend != .savings {
            OnboardingRingLegendTile(
                color: state.availableToSpend < 0 ? .heroAccentDeficit : .heroInk,
                label: state.availableToSpend < 0
                    ? AppLocale.string("Au-delà des revenus") : AppLocale.string("Disponible")
            )
        }
    }
}
