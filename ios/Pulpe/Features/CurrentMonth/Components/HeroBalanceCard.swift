import SwiftUI

/// Hero card with colored gradient background, decorative blur circles, and summary pills below.
/// Inspired by the Angular dashboard-hero component.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var periodLabel: String?
    var timeElapsedPercentage: Double = 0
    let onTapProgress: () -> Void

    // MARK: - Constants

    private static let twentyPercent: Decimal = 2 / 10

    // MARK: - Static Formatters (avoid recreation on every render)

    private static let balanceFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
        formatter.minimumFractionDigits = 0
        formatter.maximumFractionDigits = 2
        formatter.locale = Locale(identifier: "fr_CH")
        return formatter
    }()

    private static let pillFormatter: NumberFormatter = {
        let formatter = NumberFormatter()
        formatter.numberStyle = .decimal
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
    @ScaledMetric(relativeTo: .largeTitle) private var heroFontSize: CGFloat = 40

    // MARK: - Pulsing Dot

    @State private var isPulsing = false

    // MARK: - Computed Properties

    private var heroTintColor: Color {
        switch metrics.emotionState {
        case .comfortable: .pulpePrimary
        case .tight: .financialOverBudget
        case .deficit: .heroTintDeficit
        }
    }

    private var contextLabel: String {
        metrics.isDeficit ? "D\u{00E9}ficit" : "Disponible"
    }

    private var motivationalMessage: String {
        switch metrics.emotionState {
        case .deficit: "\u{00C7}a arrive \u{2014} on g\u{00E8}re"
        case .tight: "Serr\u{00E9} \u{2014} mais tu le sais"
        case .comfortable: comfortableMessage
        }
    }

    private var comfortableMessage: String {
        if metrics.totalIncome > 0, metrics.remaining > metrics.totalIncome * Self.twentyPercent {
            return "Belle marge ce mois"
        }
        if metrics.remaining > 0 {
            return "Tu g\u{00E8}res bien"
        }
        return "Pile \u{00E0} l\u{2019}\u{00E9}quilibre"
    }

    private var statusIcon: String {
        switch metrics.emotionState {
        case .comfortable: "bolt.fill"
        case .tight: "exclamationmark.triangle.fill"
        case .deficit: "xmark.circle.fill"
        }
    }

    private var fillPercentage: Double {
        min(max(metrics.usagePercentage / 100, 0), 1)
    }

    private var pacePosition: Double {
        min(max(timeElapsedPercentage / 100, 0), 1)
    }

    private var formattedBalance: String {
        Self.balanceFormatter.string(from: abs(metrics.remaining) as NSDecimalNumber) ?? "0"
    }

    private var formattedExpenses: String {
        Self.balanceFormatter.string(from: metrics.totalExpenses as NSDecimalNumber) ?? "0"
    }

    private var formattedAvailable: String {
        Self.balanceFormatter.string(from: metrics.available as NSDecimalNumber) ?? "0"
    }

    private var formattedIncome: String {
        Self.compactFormatter.string(from: metrics.totalIncome as NSDecimalNumber) ?? "0"
    }

    private var formattedRollover: String {
        Self.compactFormatter.string(from: metrics.rollover as NSDecimalNumber) ?? "0"
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            gradientCard
            pillChips
        }
        .accessibilityElement(children: .contain)
    }

    // MARK: - Gradient Card

    private var gradientCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            headerRow
            amountSection
            progressPanel
        }
        .padding(DesignTokens.Spacing.xxl)
        .background {
            ZStack {
                heroTintColor
                LinearGradient(
                    colors: [.clear, .black.opacity(0.25)],
                    startPoint: UnitPoint(x: 0.15, y: 0),
                    endPoint: UnitPoint(x: 0.85, y: 1)
                )
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

    // MARK: - Decorative Circles

    private var decorativeCircles: some View {
        ZStack {
            Circle()
                .fill(.white.opacity(0.15))
                .frame(width: 224, height: 224)
                .blur(radius: 48)
                .offset(x: 100, y: 80)

            Circle()
                .fill(.white.opacity(0.10))
                .frame(width: 144, height: 144)
                .blur(radius: 32)
                .offset(x: 80, y: -60)

            Circle()
                .fill(.white.opacity(0.05))
                .frame(width: 96, height: 96)
                .blur(radius: 32)
                .offset(x: -60, y: 0)
        }
        .allowsHitTesting(false)
    }

    // MARK: - Header Row

    private var headerRow: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                HStack(spacing: DesignTokens.Spacing.sm) {
                    Circle()
                        .fill(.white)
                        .frame(width: 8, height: 8)
                        .opacity(0.9)
                        .animation(DesignTokens.Animation.pulse, value: isPulsing)
                        .onAppear { isPulsing = true }

                    Text("Mois en cours")
                        .font(PulpeTypography.labelMedium)
                        .foregroundStyle(.white)
                        .textCase(.uppercase)
                        .tracking(0.8)
                }

                if let periodLabel {
                    Text(periodLabel)
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(.white)
                        .tracking(-0.5)
                }
            }

            Spacer()

            ZStack {
                Circle().fill(.white.opacity(0.2))
                Image(systemName: statusIcon)
                    .font(.body.weight(.semibold))
                    .foregroundStyle(.white)
            }
            .frame(width: 44, height: 44)
        }
    }

    // MARK: - Amount Section

    private var amountSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text(contextLabel)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(.white.opacity(0.8))
                .textCase(.uppercase)

            HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.sm) {
                Text(formattedBalance)
                    .font(.custom("Manrope-Bold", size: heroFontSize, relativeTo: .largeTitle))
                    .monospacedDigit()
                    .foregroundStyle(.white)
                    .contentTransition(.numericText())
                    .sensitiveAmount()

                Text("CHF")
                    .font(PulpeTypography.stepTitle)
                    .foregroundStyle(.white.opacity(0.7))
            }
            .accessibilityElement(children: .combine)
            .accessibilityLabel("\(contextLabel) \(formattedBalance) CHF")

            Text(motivationalMessage)
                .font(PulpeTypography.caption)
                .foregroundStyle(.white.opacity(0.75))

            incomeSubtitle
        }
    }

    private var incomeSubtitle: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Revenus \(formattedIncome)")

            if metrics.rollover != 0 {
                Text("Report \(metrics.rollover > 0 ? "+" : "")\(formattedRollover)")
                    .opacity(0.8)
            }
        }
        .font(PulpeTypography.caption)
        .foregroundStyle(.white.opacity(0.6))
        .sensitiveAmount()
    }

    // MARK: - Progress Panel

    private var progressPanel: some View {
        HeroProgressPanel(
            formattedExpenses: formattedExpenses,
            formattedAvailable: formattedAvailable,
            fillPercentage: fillPercentage,
            pacePosition: pacePosition,
            timeElapsedPercentage: timeElapsedPercentage,
            usagePercentage: metrics.usagePercentage,
            onTap: onTapProgress
        )
    }

    // MARK: - Pill Chips

    private var pillChips: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            pillChip(
                icon: "arrow.up.right",
                label: "Revenus",
                value: metrics.totalIncome,
                color: .financialIncome
            )

            pillChip(
                icon: "arrow.down.right",
                label: "D\u{00E9}penses",
                value: metrics.totalExpenses,
                color: .financialExpense
            )

            pillChip(
                icon: TransactionKind.savingsIcon,
                label: "\u{00C9}pargne",
                value: metrics.totalSavings,
                color: .financialSavings
            )
        }
    }

    private func pillChip(icon: String, label: String, value: Decimal, color: Color) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Image(systemName: icon)
                .font(.subheadline.weight(.semibold))
                .foregroundStyle(color)

            VStack(alignment: .leading, spacing: 1) {
                Text(label)
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(.primary)

                Text(Self.pillFormatter.string(from: value as NSDecimalNumber) ?? "0")
                    .font(PulpeTypography.amountMedium)
                    .foregroundStyle(color)
                    .contentTransition(.numericText())
                    .sensitiveAmount()
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.md)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .background(color.opacity(DesignTokens.Opacity.highlightBackground), in: Capsule())
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
                    remaining: 2500,
                    rollover: 500
                ),
                periodLabel: "27 f\u{00E9}v. - 26 mars",
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
                    remaining: 300,
                    rollover: 0
                ),
                timeElapsedPercentage: 75,
                onTapProgress: {}
            )

            // Deficit: >100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 8500,
                    totalExpenses: 8619,
                    totalSavings: 0,
                    available: 8500,
                    endingBalance: -119,
                    remaining: -119,
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
