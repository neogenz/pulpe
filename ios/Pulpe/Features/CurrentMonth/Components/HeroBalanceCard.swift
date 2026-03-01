import SwiftUI

/// Hero balance card — 4 chunks: contextual label, hero amount, emotional message, spent ratio + bar.
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    var timeElapsedPercentage: Double = 0
    let onTapProgress: () -> Void

    // MARK: - Static Formatters (avoid recreation on every render)

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

    // MARK: - Computed Properties

    private var contextLabel: String {
        metrics.isDeficit ? "DÉFICIT" : "DISPONIBLE"
    }

    private var motivationalMessage: String {
        switch metrics.emotionState {
        case .deficit: "Ça arrive — on gère"
        case .tight: "Serré — mais tu le sais"
        case .comfortable: comfortableMessage
        }
    }

    private var comfortableMessage: String {
        let twentyPercent: Decimal = 2 / 10
        if metrics.totalIncome > 0, metrics.remaining > metrics.totalIncome * twentyPercent {
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

    private var formattedSpent: String {
        Self.compactFormatter.string(from: metrics.totalExpenses as NSDecimalNumber) ?? "0"
    }

    private var formattedAvailable: String {
        Self.compactFormatter.string(from: metrics.available as NSDecimalNumber) ?? "0"
    }

    private var usagePercentageText: String {
        "\(Int(metrics.usagePercentage))%"
    }

    private var supportingTextOpacity: Double {
        switch metrics.emotionState {
        case .tight:
            0.96
        case .comfortable, .deficit:
            0.88
        }
    }

    private var subduedTextOpacity: Double {
        switch metrics.emotionState {
        case .tight:
            0.94
        case .comfortable, .deficit:
            0.82
        }
    }

    // MARK: - Body

    var body: some View {
        Button(action: onTapProgress) {
            cardContent
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .contain)
        .accessibilityLabel(
            """
            \(contextLabel) \(formattedBalance) CHF. \
            \(motivationalMessage). \
            Dépensé \(formattedSpent) sur \(formattedAvailable)
            """
        )
    }

    // MARK: - Card Content

    private var cardContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Chunk 1 — Contextual label
            Text(contextLabel)
                .font(PulpeTypography.labelLargeBold)
                .foregroundStyle(.white.opacity(supportingTextOpacity))

            // Chunk 2 — Hero amount
            Text("\(formattedBalance) CHF")
                .font(PulpeTypography.amountHero)
                .minimumScaleFactor(0.6)
                .lineLimit(1)
                .monospacedDigit()
                .foregroundStyle(.white)
                .contentTransition(.numericText())
                .sensitiveAmount()

            // Chunk 3 — Motivational message
            Text(motivationalMessage)
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(.white.opacity(subduedTextOpacity))

            Spacer()
                .frame(height: DesignTokens.Spacing.md)

            // Chunk 4 — Spent ratio + progress bar
            spentRatio
        }
        .padding(DesignTokens.Spacing.xxl)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background { cardBackground }
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
        .overlay(alignment: .top) {
            // Subtle specular highlight to keep the hero vivid without using shadows.
            Capsule()
                .fill(.white.opacity(0.15))
                .frame(height: 1)
                .padding(.horizontal, 28)
        }
        .overlay {
            if colorScheme == .dark {
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                    .stroke(.white.opacity(0.05), lineWidth: 1)
            }
        }
        .animation(.spring(response: 0.7, dampingFraction: 0.8), value: metrics.emotionState)
    }

    // MARK: - Spent Ratio + Bar

    private var spentRatio: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text("Dépensé \(formattedSpent)")
                    .font(PulpeTypography.labelLargeBold)
                    .foregroundStyle(.white)
                    .sensitiveAmount()

                Spacer()

                Text("sur \(formattedAvailable)")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(.white.opacity(subduedTextOpacity))
                    .sensitiveAmount()
            }

            HStack(spacing: DesignTokens.Spacing.sm) {
                Text(usagePercentageText)
                    .font(PulpeTypography.progressValue)
                    .foregroundStyle(.white)
                    .monospacedDigit()
                    .frame(minWidth: 36, alignment: .leading)

                progressBar
            }
        }
    }

    // MARK: - Progress Bar with Pace Indicator

    private var progressBar: some View {
        GeometryReader { geo in
            ZStack(alignment: .leading) {
                // Track
                Capsule()
                    .fill(.white.opacity(0.2))

                // Fill
                Capsule()
                    .fill(.white)
                    .frame(width: geo.size.width * fillPercentage)
                    .animation(.easeInOut(duration: 0.8), value: fillPercentage)

                // Pace indicator (vertical white line)
                if timeElapsedPercentage > 0 {
                    RoundedRectangle(cornerRadius: 1)
                        .fill(.white.opacity(0.4))
                        .frame(width: 2, height: geo.size.height + 4)
                        .offset(
                            x: geo.size.width * min(timeElapsedPercentage / 100, 1) - 1,
                            y: -2
                        )
                }
            }
        }
        .frame(height: DesignTokens.ProgressBar.heroHeight)
    }

    // MARK: - Card Background

    private var cardBackground: some View {
        ZStack {
            // Gradient crossfade for smooth state transitions
            LinearGradient(
                colors: Color.heroGradientComfortable,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .comfortable ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientTight,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .tight ? 1 : 0)

            LinearGradient(
                colors: Color.heroGradientDeficit,
                startPoint: UnitPoint(x: 0.1, y: 0),
                endPoint: UnitPoint(x: 0.9, y: 1)
            )
            .opacity(metrics.emotionState == .deficit ? 1 : 0)

            decorativeCircles
        }
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
}

// MARK: - Preview

#Preview("Hero Balance Card — 3 States") {
    ScrollView {
        VStack(spacing: 24) {
            // Comfortable: <80% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5500,
                    totalExpenses: 2200,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3300,
                    remaining: 3300,
                    rollover: 0
                ),
                timeElapsedPercentage: 50,
                onTapProgress: {}
            )

            // Tight: 80-100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 4300,
                    totalExpenses: 3800,
                    totalSavings: 0,
                    available: 4300,
                    endingBalance: 500,
                    remaining: 500,
                    rollover: 0
                ),
                timeElapsedPercentage: 65,
                onTapProgress: {}
            )

            // Deficit: >100% used
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 4121,
                    totalExpenses: 5351,
                    totalSavings: 0,
                    available: 4121,
                    endingBalance: -1230,
                    remaining: -1230,
                    rollover: 0
                ),
                timeElapsedPercentage: 85,
                onTapProgress: {}
            )
        }
        .padding()
    }
    .pulpeBackground()
}
