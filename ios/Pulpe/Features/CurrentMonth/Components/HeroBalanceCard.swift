import SwiftUI

/// Revolut-style hero card displaying the available balance prominently
struct HeroBalanceCard: View {
    let metrics: BudgetFormulas.Metrics
    let onTapProgress: () -> Void

    // MARK: - Computed Properties

    private var isOverBudget: Bool {
        metrics.remaining < 0
    }

    private var progressPercentage: Double {
        guard metrics.available > 0 else { return 1 }
        let ratio = Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
        return min(max(ratio, 0), 1)
    }

    private var displayPercentage: Int {
        guard metrics.available > 0 else { return 100 }
        let ratio = Double(truncating: (metrics.totalExpenses / metrics.available) as NSDecimalNumber)
        return Int(ratio * 100)
    }

    private var progressColor: Color {
        if isOverBudget { return .red }
        if progressPercentage > 0.85 { return .orange }
        return .pulpePrimary
    }

    private var balanceColor: Color {
        isOverBudget ? .red : .primary
    }

    // MARK: - Body

    var body: some View {
        VStack(spacing: 20) {
            // Main balance section
            balanceSection

            // Quick stats row
            statsRow
        }
        .padding(.horizontal, 20)
        .padding(.vertical, 24)
        .heroCardStyle()
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        HStack(alignment: .center) {
            VStack(alignment: .leading, spacing: 6) {
                Text("Disponible à dépenser")
                    .font(.subheadline)
                    .fontWeight(.medium)
                    .foregroundStyle(.secondary)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text(metrics.remaining.formatted(.number.precision(.fractionLength(0...2))))
                        .font(.system(size: 42, weight: .bold, design: .rounded))
                        .foregroundStyle(balanceColor)
                        .contentTransition(.numericText())

                    Text("CHF")
                        .font(.title3)
                        .fontWeight(.semibold)
                        .foregroundStyle(.secondary)
                }

                if isOverBudget {
                    Label("Budget dépassé", systemImage: "exclamationmark.triangle.fill")
                        .font(.caption)
                        .fontWeight(.medium)
                        .foregroundStyle(.red)
                }
            }

            Spacer()

            // Circular progress indicator
            progressIndicator
        }
    }

    // MARK: - Progress Indicator

    private var progressIndicator: some View {
        Button(action: onTapProgress) {
            ZStack {
                Circle()
                    .stroke(Color(.systemGray5), lineWidth: 6)

                Circle()
                    .trim(from: 0, to: CGFloat(progressPercentage))
                    .stroke(progressColor, style: StrokeStyle(lineWidth: 6, lineCap: .round))
                    .rotationEffect(.degrees(-90))
                    .animation(.spring(duration: 0.6), value: progressPercentage)

                VStack(spacing: 0) {
                    Text("\(displayPercentage)")
                        .font(.system(size: 18, weight: .bold, design: .rounded))
                        .foregroundStyle(progressColor)

                    Text("%")
                        .font(.system(size: 10, weight: .medium))
                        .foregroundStyle(.secondary)
                }
            }
            .frame(width: 64, height: 64)
        }
        .buttonStyle(.plain)
    }

    // MARK: - Stats Row

    private var statsRow: some View {
        HStack(spacing: 0) {
            statItem(
                label: "Dépenses",
                value: metrics.totalExpenses,
                color: .financialExpense
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, 16)

            statItem(
                label: "Revenus",
                value: metrics.totalIncome,
                color: .financialIncome
            )

            Divider()
                .frame(height: 32)
                .padding(.horizontal, 16)

            statItem(
                label: "Épargne",
                value: metrics.totalSavings,
                color: .financialSavings
            )
        }
    }

    private func statItem(label: String, value: Decimal, color: Color) -> some View {
        VStack(alignment: .center, spacing: 2) {
            Text(label)
                .font(.caption)
                .foregroundStyle(.tertiary)

            Text(value.asCompactCHF)
                .font(.system(.subheadline, design: .rounded, weight: .semibold))
                .foregroundStyle(color)
        }
        .frame(maxWidth: .infinity)
    }
}

// MARK: - Hero Card Style Modifier

private struct HeroCardStyleModifier: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26, *) {
            content
                .glassEffect(.regular.interactive(), in: .rect(cornerRadius: 20))
        } else {
            content
                .background(Color(.secondarySystemGroupedBackground))
                .clipShape(RoundedRectangle(cornerRadius: 20))
                .shadow(color: .black.opacity(0.08), radius: 8, y: 4)
        }
    }
}

extension View {
    func heroCardStyle() -> some View {
        modifier(HeroCardStyleModifier())
    }
}

// MARK: - Preview

#Preview("Hero Balance Card") {
    ScrollView {
        VStack(spacing: 24) {
            // Normal state
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 2000,
                    totalSavings: 500,
                    available: 5500,
                    endingBalance: 3500,
                    remaining: 3000,
                    rollover: 500
                ),
                onTapProgress: {}
            )

            // High usage
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 4500,
                    totalSavings: 300,
                    available: 5000,
                    endingBalance: 500,
                    remaining: 200,
                    rollover: 0
                ),
                onTapProgress: {}
            )

            // Over budget
            HeroBalanceCard(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5500,
                    totalSavings: 200,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -700,
                    rollover: 0
                ),
                onTapProgress: {}
            )
        }
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
