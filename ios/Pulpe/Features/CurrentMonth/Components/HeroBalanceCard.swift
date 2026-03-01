import SwiftUI

/// Hero card with gauge-style progress ring, gradient background, and metric columns.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var periodLabel: String?
    var timeElapsedPercentage: Double = 0
    let onTapProgress: () -> Void

    // MARK: - Constants

    private static let twentyPercent: Decimal = 2 / 10
    /// Arc spans 300° (0.83 of circle) with a 60° gap at the bottom.
    private static let arcFraction: Double = 0.83
    /// Rotation to center the 60° gap at 6 o'clock.
    private static let arcRotation: Angle = .degrees(90 + (1 - arcFraction) * 360 / 2)

    // MARK: - Static Formatters (avoid recreation on every render)

    private static let balanceFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "fr_CH")
        return formatter
    }()

    private static let compactFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 0
        formatter.locale = Locale(identifier: "fr_CH")
        return formatter
    }()

    // MARK: - Environment

    @Environment(\.colorScheme) private var colorScheme
    @ScaledMetric(relativeTo: .largeTitle) private var ringSize: CGFloat = 170
    @ScaledMetric(relativeTo: .body) private var ringStrokeWidth: CGFloat = 15

    // MARK: - Computed Properties

    private var heroTintColor: Color {
        switch metrics.emotionState {
        case .comfortable: .pulpePrimary
        case .tight: .financialOverBudget
        case .deficit: .heroTintDeficit
        }
    }

    private var contextLabel: String {
        metrics.isDeficit ? "Déficit" : "Disponible"
    }

    private var motivationalMessage: String {
        switch metrics.emotionState {
        case .deficit: "Ça arrive — on gère"
        case .tight: "Serré — mais tu le sais"
        case .comfortable: comfortableMessage
        }
    }

    private var comfortableMessage: String {
        if metrics.totalIncome > 0, metrics.remaining > metrics.totalIncome * Self.twentyPercent {
            return "Belle marge ce mois"
        }
        if metrics.remaining > 0 {
            return "Tu gères bien"
        }
        return "Pile à l\u{2019}équilibre"
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var formattedBalance: String {
        Self.compactFormatter.string(from: abs(metrics.remaining) as NSDecimalNumber) ?? "0"
    }

    private var metricBarMax: Decimal {
        max(metrics.totalIncome, metrics.totalExpenses, metrics.totalSavings, 1)
    }

    // MARK: - Body

    var body: some View {
        gradientCard
            .accessibilityElement(children: .contain)
    }

    // MARK: - Gradient Card

    private var gradientCard: some View {
        VStack(spacing: 0) {
            // Ring section
            VStack(spacing: DesignTokens.Spacing.sm) {
                if let periodLabel {
                    Text(periodLabel)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.white.opacity(0.7))
                        .padding(.bottom, DesignTokens.Spacing.md)
                }

                progressRing

                // Metric columns
                metricColumns
            }
            .padding(.top, DesignTokens.Spacing.xxl)
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .frame(maxWidth: .infinity)
        .background {
            ZStack {
                heroTintColor
                decorativeCircles
            }
        }
        .clipShape(.rect(cornerRadius: 32))
        .overlay {
            if colorScheme == .dark {
                RoundedRectangle(cornerRadius: 32)
                    .stroke(.white.opacity(0.05), lineWidth: 1)
            }
        }
        .shadow(DesignTokens.Shadow.elevated)
    }

    // MARK: - Progress Ring

    private var progressRing: some View {
        Button(action: onTapProgress) {
            ZStack {
                // Track (background arc)
                Circle()
                    .trim(from: 0, to: Self.arcFraction)
                    .stroke(
                        .white.opacity(0.2),
                        style: StrokeStyle(lineWidth: ringStrokeWidth, lineCap: .round)
                    )
                    .rotationEffect(Self.arcRotation)

                // Fill arc (proportional to usage)
                Circle()
                    .trim(from: 0, to: Self.arcFraction * fillPercentage)
                    .stroke(
                        .white,
                        style: StrokeStyle(lineWidth: ringStrokeWidth, lineCap: .round)
                    )
                    .rotationEffect(Self.arcRotation)
                    .animation(.easeInOut(duration: 1.0), value: fillPercentage)

                // Balance inside ring
                VStack(spacing: 2) {
                    Text("CHF")
                        .font(PulpeTypography.labelLargeBold)
                        .foregroundStyle(.white)

                    Text(formattedBalance)
                        .font(PulpeTypography.amountHero)
                        .minimumScaleFactor(0.7)
                        .lineLimit(1)
                        .monospacedDigit()
                        .foregroundStyle(.white)
                        .contentTransition(.numericText())
                        .sensitiveAmount()

                    Text(contextLabel)
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(.white.opacity(0.6))
                        .tracking(1.2)
                }
            }
            .frame(width: ringSize, height: ringSize)
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(contextLabel) \(formattedBalance) CHF")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Decorative Circles

    private var decorativeCircles: some View {
        ZStack {
            Circle()
                .fill(.white.opacity(0.07))
                .frame(width: 224, height: 224)
                .blur(radius: 48)
                .offset(x: 100, y: 80)

            Circle()
                .fill(.white.opacity(0.05))
                .frame(width: 144, height: 144)
                .blur(radius: 32)
                .offset(x: 80, y: -60)

            Circle()
                .fill(.white.opacity(0.03))
                .frame(width: 96, height: 96)
                .blur(radius: 32)
                .offset(x: -60, y: 0)
        }
        .allowsHitTesting(false)
    }

    // MARK: - Metric Columns

    private var metricColumns: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            metricColumn(
                icon: "arrow.up.right",
                label: "Revenus",
                value: metrics.totalIncome
            )

            metricColumn(
                icon: "arrow.down.right",
                label: "Dépenses",
                value: metrics.totalExpenses
            )

            metricColumn(
                icon: TransactionKind.savingsIcon,
                label: "Épargne",
                value: metrics.totalSavings
            )
        }
    }

    private func metricColumn(icon: String, label: String, value: Decimal) -> some View {
        let ratio = Double(truncating: (value / metricBarMax) as NSDecimalNumber)

        return VStack(spacing: DesignTokens.Spacing.sm) {
            Text(Self.compactFormatter.string(from: value as NSDecimalNumber) ?? "0")
                .font(PulpeTypography.amountMedium)
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .sensitiveAmount()

            GeometryReader { geo in
                Capsule()
                    .fill(.white.opacity(0.25))
                    .overlay(alignment: .leading) {
                        Capsule()
                            .fill(.white)
                            .frame(width: geo.size.width * min(max(ratio, 0), 1))
                            .animation(.easeInOut(duration: 0.8), value: ratio)
                    }
            }
            .frame(height: 10)

            HStack(spacing: DesignTokens.Spacing.xs) {
                Image(systemName: icon)
                    .font(.caption2.weight(.semibold))
                    .foregroundStyle(.white)

                Text(label)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(.white)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
        .accessibilityLabel("\(label) \(value.asCHF)")
    }
}

// MARK: - Preview

#Preview("Hero Balance Card -- 3 States") {
    ScrollView {
        VStack(spacing: 24) {
            // Comfortable: <80% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 100000,
                    rollover: 500
                ),
                periodLabel: "27 fév. - 26 mars",
                timeElapsedPercentage: 50,
                onTapProgress: {}
            )

            // Tight: 80-100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 4200,
                    totalSavings: 500,
                    available: 5000,
                    endingBalance: 300,
                    remaining: 48000,
                    rollover: 0
                ),
                timeElapsedPercentage: 75,
                onTapProgress: {}
            )

            // Deficit: >100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 8500,
                    totalExpenses: 58400,
                    totalSavings: 0,
                    available: 8500,
                    endingBalance: -119,
                    remaining: -4504,
                    rollover: 0
                ),
                timeElapsedPercentage: 90,
                onTapProgress: {}
            )
        }
        .padding()
    }
    .pulpeBackground()
}
