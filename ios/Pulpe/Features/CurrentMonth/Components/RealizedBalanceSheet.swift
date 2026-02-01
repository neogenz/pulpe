import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics

    @Environment(\.dismiss) private var dismiss

    private var isPositiveBalance: Bool {
        realizedMetrics.realizedBalance >= 0
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    // Main balance card
                    balanceCard

                    // Progress comparison
                    progressSection

                    // Tip
                    tipSection
                }
                .padding()
            }
            .background(Color.surfacePrimary)
            .navigationTitle("Suivi du budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Balance Card

    private var balanceCard: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            // Label
            Text("Solde à date")
                .font(.subheadline)
                .foregroundStyle(.secondary)

            // Amount
            Text(realizedMetrics.realizedBalance.asCHF)
                .font(PulpeTypography.amountHero)
                .foregroundStyle(isPositiveBalance ? .primary : Color.financialOverBudget)
                .sensitiveAmount()

            // Status badge
            HStack(spacing: 6) {
                Image(systemName: isPositiveBalance ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(.caption)
                Text(isPositiveBalance ? "Tout va bien" : "Solde négatif — on y remédie ?")
                    .font(.caption)
                    .fontWeight(.medium)
            }
            .foregroundStyle(isPositiveBalance ? Color.financialSavings : Color.financialOverBudget)
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, 6)
            .background((isPositiveBalance ? Color.financialSavings : Color.financialOverBudget).opacity(DesignTokens.Opacity.badgeBackground))
            .clipShape(Capsule())

            // Completion info
            Text("Basé sur \(realizedMetrics.checkedItemsCount) éléments comptabilisés sur \(realizedMetrics.totalItemsCount)")
                .font(.caption)
                .foregroundStyle(Color.textTertiary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.xxl)
        .background(Color.surfaceCard)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            Text("Prévu vs Réalisé")
                .font(.headline)

            // Income row
            ProgressRow(
                label: "Revenus",
                icon: "arrow.down.circle.fill",
                iconColor: .financialIncome,
                realized: realizedMetrics.realizedIncome,
                planned: metrics.totalIncome
            )

            // Expenses row
            ProgressRow(
                label: "Dépenses",
                icon: "arrow.up.circle.fill",
                iconColor: .financialExpense,
                realized: realizedMetrics.realizedExpenses,
                planned: metrics.totalExpenses - metrics.totalSavings
            )

            // Savings row
            ProgressRow(
                label: "Épargne",
                icon: TransactionKind.savingsIcon,
                iconColor: .financialSavings,
                realized: realizedSavings,
                planned: metrics.totalSavings
            )
        }
        .padding()
        .background(Color.surfaceCard)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.lg))
    }

    /// Calculate realized savings from realized metrics
    private var realizedSavings: Decimal {
        // Savings are part of realized expenses in the formula
        // For simplicity, show proportion based on completion
        let completionRatio = realizedMetrics.totalItemsCount > 0
            ? Decimal(realizedMetrics.checkedItemsCount) / Decimal(realizedMetrics.totalItemsCount)
            : 0
        return metrics.totalSavings * completionRatio
    }

    // MARK: - Tip Section

    private var tipSection: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(.body)
                .foregroundStyle(Color.warningPrimary)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Astuce")
                    .font(.subheadline)
                    .fontWeight(.semibold)

                Text("Compare ce solde avec ton compte bancaire. S'il y a un écart, vérifie que toutes tes dépenses sont bien cochées.")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.warningBackground)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }
}

// MARK: - Progress Row Component

private struct ProgressRow: View {
    let label: String
    let icon: String
    let iconColor: Color
    let realized: Decimal
    let planned: Decimal

    private var percentage: Double {
        guard planned > 0 else { return 0 }
        return min(Double(truncating: NSDecimalNumber(decimal: realized / planned)), 1.0)
    }

    private var percentageText: String {
        guard planned > 0 else { return "0%" }
        let pct = Int(truncating: NSDecimalNumber(decimal: realized / planned * 100))
        return "\(min(pct, 100))%"
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            // Header
            HStack {
                Image(systemName: icon)
                    .foregroundStyle(iconColor)

                Text(label)
                    .font(.subheadline)
                    .fontWeight(.medium)

                Spacer()

                Text("\(realized.asCompactCHF) / \(planned.asCompactCHF)")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
                    .sensitiveAmount()
            }

            // Progress bar
            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color.progressTrack)

                    Capsule()
                        .fill(iconColor)
                        .frame(width: geometry.size.width * CGFloat(percentage))
                }
            }
            .frame(height: 8)

            // Percentage label
            Text("\(percentageText) réalisé")
                .font(.caption)
                .foregroundStyle(Color.textTertiary)
        }
    }
}

// MARK: - Previews

#Preview("Positive Balance") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 7956,
                    totalExpenses: 4861.30,
                    totalSavings: 500,
                    available: 7956,
                    endingBalance: 3094.70,
                    remaining: 3094.70,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 7956,
                    realizedExpenses: 2500,
                    realizedBalance: 5456,
                    checkedItemsCount: 12,
                    totalItemsCount: 25
                )
            )
        }
}

#Preview("Negative Balance") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 5000,
                    totalExpenses: 5500,
                    totalSavings: 200,
                    available: 5000,
                    endingBalance: -500,
                    remaining: -500,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 5000,
                    realizedExpenses: 5200,
                    realizedBalance: -200,
                    checkedItemsCount: 18,
                    totalItemsCount: 20
                )
            )
        }
}

#Preview("All Checked") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            RealizedBalanceSheet(
                metrics: .init(
                    totalIncome: 6000,
                    totalExpenses: 4000,
                    totalSavings: 800,
                    available: 6000,
                    endingBalance: 2000,
                    remaining: 2000,
                    rollover: 0
                ),
                realizedMetrics: .init(
                    realizedIncome: 6000,
                    realizedExpenses: 4000,
                    realizedBalance: 2000,
                    checkedItemsCount: 15,
                    totalItemsCount: 15
                )
            )
        }
}
