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
    /// The welcome sample draws itself in once; the steps' ring follows the typed amounts.
    var drawsIn = false

    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var isDrawnIn = false

    /// How much of the ring is drawn: 0 until a drawing-in ring has appeared.
    private var drawn: Double { drawsIn && !reduceMotion && !isDrawnIn ? 0 : 1 }

    private var available: Decimal { income - charges - savings }
    private var isOverrun: Bool { available < 0 }
    private var spent: Double { NSDecimalNumber(decimal: charges + savings).doubleValue }
    /// The ring spans the income, or what is spent when that goes past it.
    private var span: Double { max(NSDecimalNumber(decimal: income).doubleValue, spent) }

    private func fraction(_ value: Decimal) -> Double {
        span > 0 ? NSDecimalNumber(decimal: value).doubleValue / span : 0
    }

    /// Half of what separates two segments, as a fraction of the ring: the round caps reach
    /// half a stroke past each end, so the clear gap needs that much on top.
    private var capInset: Double {
        (DesignTokens.Entry.ringStroke + DesignTokens.Entry.ringSegmentGap) / 2
            / (Double.pi * DesignTokens.Entry.ringSize)
    }

    var body: some View {
        let chargesEnd = fraction(charges)
        let savingsEnd = chargesEnd + fraction(savings)
        let restEnd = span > 0 ? 1.0 : 0
        // A lone segment closes the ring: a gap only reads as one between two colours.
        let shown = [chargesEnd, savingsEnd - chargesEnd, restEnd - savingsEnd].filter { $0 > 2 * capInset }.count
        let inset = shown > 1 ? capInset : 0
        ZStack {
            // The empty ring's placeholder only: under the segments it would show through
            // their gaps as a halo around each rounded end.
            Circle()
                .stroke(
                    Color.heroInk.opacity(DesignTokens.Opacity.badgeBackground),
                    lineWidth: DesignTokens.Entry.ringStroke
                )
                .opacity(span > 0 ? 0 : 1)
            segment(from: 0, to: chargesEnd, inset: inset, color: .heroAccentCaution)
            segment(from: chargesEnd, to: savingsEnd, inset: inset, color: .heroAccentPositive)
            segment(from: savingsEnd, to: restEnd, inset: inset, color: .heroInk)
            if isOverrun {
                Circle()
                    .trim(from: 0, to: fraction(-available) * drawn)
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
        .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: available)
        .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: income)
        .onAppear {
            guard drawsIn, !reduceMotion else { return }
            withAnimation(DesignTokens.Animation.ringDrawIn.delay(DesignTokens.Animation.staggerStep * 4)) {
                isDrawnIn = true
            }
        }
        .accessibilityElement(children: .ignore)
        .accessibilityLabel(centreLabel)
        .accessibilityValue(available.magnitude.asCurrency(currency))
    }

    /// A rounded arc with clear space at both ends. One too short to clear its caps fades out
    /// instead of shrinking to a dot.
    private func segment(from start: Double, to end: Double, inset: Double, color: Color) -> some View {
        let from = start * drawn + inset
        let to = max(from, end * drawn - inset)
        return Circle()
            .trim(from: from, to: to)
            .stroke(color, style: StrokeStyle(lineWidth: DesignTokens.Entry.ringStroke, lineCap: .round))
            .rotationEffect(.degrees(-90))
            .opacity(to > from ? 1 : 0)
    }

    /// Plain words over the coral arc: the arc carries the alarm, the label stays readable on
    /// the forest (coral text there falls under 4.5:1).
    private var centreLabel: String {
        isOverrun ? AppLocale.string("Il manque") : AppLocale.string("Disponible")
    }

    private var centre: some View {
        VStack(spacing: DesignTokens.Spacing.xxs) {
            Text(centreLabel)
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.heroInk.opacity(DesignTokens.Opacity.overlay))
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

/// Ring of a step with its legend tiles, driven by the onboarding state. A tile names an
/// outflow the step is filling, always with its amount; what is left is the ring centre's job.
struct OnboardingBudgetZone: View {
    enum Legend { case none, charges, savings }

    let state: OnboardingState
    var legend: Legend = .none
    var subtitle: String?

    @Environment(\.foldsOnboardingRing) private var foldsRing

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if foldsRing {
                OnboardingAvailableBand(state: state)
            } else {
                OnboardingBudgetRing(
                    income: state.totalIncome,
                    charges: state.totalCharges,
                    savings: state.totalSavings,
                    currency: state.currency,
                    subtitle: subtitle
                )
            }
            if legend != .none {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    OnboardingRingLegendTile(
                        color: .heroAccentCaution,
                        label: AppLocale.string("Charges"),
                        amount: state.totalCharges.asAmount(for: state.currency)
                    )
                    if legend == .savings {
                        OnboardingRingLegendTile(
                            color: .heroAccentPositive,
                            label: AppLocale.string("Épargne"),
                            amount: state.totalSavings.asAmount(for: state.currency)
                        )
                    }
                }
            }
        }
    }
}

/// What the ring says, on one line: the zone of a short screen, where the ring and the card's
/// rows don't both fit.
struct OnboardingAvailableBand: View {
    let state: OnboardingState

    var body: some View {
        let available = state.availableToSpend
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
            Text(available < 0 ? AppLocale.string("Il manque") : AppLocale.string("Disponible"))
                .font(PulpeTypography.detailLabel)
                .foregroundStyle(Color.heroInk.opacity(DesignTokens.Opacity.overlay))
            Text(available.magnitude.asCurrency(state.currency))
                .font(PulpeTypography.rowAmount)
                .foregroundStyle(Color.heroInk)
                .contentTransition(.numericText())
        }
        .accessibilityElement(children: .combine)
    }
}

extension EnvironmentValues {
    /// Set by `OnboardingStepView` on a step shorter than `DesignTokens.Entry.ringZoneMinHeight`.
    @Entry var foldsOnboardingRing = false
}
