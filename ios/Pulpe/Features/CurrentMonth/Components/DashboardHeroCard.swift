import SwiftUI

/// Dashboard hero card with available balance and linear progress bar
struct DashboardHeroCard: View {
    let metrics: BudgetFormulas.Metrics

    // MARK: - Computed Properties

    private var isOverBudget: Bool {
        metrics.remaining < 0
    }

    private var usagePercentage: Double {
        guard metrics.available > 0 else { return 1 }
        return Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
    }

    private var clampedPercentage: Double {
        min(max(usagePercentage, 0), 1)
    }

    private var displayPercentage: Int {
        Int(usagePercentage * 100)
    }

    private var progressColor: Color {
        if usagePercentage >= 1 { return .red }
        if usagePercentage >= 0.8 { return .orange }
        return .green
    }

    private var balanceColor: Color {
        isOverBudget ? .red : .primary
    }

    // MARK: - Body

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Label
            Text("Disponible")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)

            // Amount
            Text(metrics.remaining.asCHF)
                .font(.system(size: 42, weight: .bold, design: .rounded))
                .foregroundStyle(balanceColor)
                .contentTransition(.numericText())

            // Progress bar with percentage
            HStack(spacing: 12) {
                // Linear progress bar
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        // Track
                        RoundedRectangle(cornerRadius: 4)
                            .fill(Color.progressTrack)
                            .frame(height: 8)

                        // Fill
                        RoundedRectangle(cornerRadius: 4)
                            .fill(progressColor)
                            .frame(width: geometry.size.width * clampedPercentage, height: 8)
                            .animation(.spring(duration: 0.6), value: clampedPercentage)
                    }
                }
                .frame(height: 8)

                // Percentage text
                Text("\(displayPercentage)% utilisé")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(progressColor)
                    .fixedSize()
            }
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 24)
        .heroCardStyle()
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Disponible \(metrics.remaining.asCHF), \(displayPercentage) pourcent du budget utilisé")
    }
}

// MARK: - Preview

#Preview("Dashboard Hero Card") {
    ScrollView {
        VStack(spacing: 24) {
            // Normal state (under 80%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 2340,
                    rollover: 500
                )
            )

            // Warning state (80-99%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 4200,
                    totalSavings: 300,
                    available: 5000,
                    endingBalance: 800,
                    remaining: 500,
                    rollover: 0
                )
            )

            // Over budget (≥100%)
            DashboardHeroCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5500,
                    totalSavings: 200,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -700,
                    rollover: 0
                )
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
