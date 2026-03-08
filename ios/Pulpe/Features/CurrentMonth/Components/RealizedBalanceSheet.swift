import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics

    private var isPositiveBalance: Bool {
        realizedMetrics.realizedBalance >= 0
    }

    private var completionRatio: Double {
        guard realizedMetrics.totalItemsCount > 0 else { return 0 }
        return Double(realizedMetrics.checkedItemsCount) / Double(realizedMetrics.totalItemsCount)
    }

    private var statusColor: Color {
        isPositiveBalance ? .financialSavings : .financialOverBudget
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    balanceSection
                    completionSection
                    progressSection
                    tipSection
                }
                .padding(.horizontal)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .background(Color.sheetBackground)
            .navigationTitle("Suivi du budget")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .standardSheetPresentation(detents: [.medium, .large])
    }

    // MARK: - Balance Section

    private var balanceSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            Text("Solde à date")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.secondary)

            Text(realizedMetrics.realizedBalance.asCHF)
                .font(PulpeTypography.amountHero)
                .monospacedDigit()
                .foregroundStyle(isPositiveBalance ? .primary : Color.financialOverBudget)
                .contentTransition(.numericText())
                .sensitiveAmount()

            // Status badge
            HStack(spacing: 6) {
                Image(systemName: isPositiveBalance ? "checkmark.circle.fill" : "exclamationmark.triangle.fill")
                    .font(PulpeTypography.caption)
                Text(isPositiveBalance ? "Tout va bien" : "Solde négatif — on y remédie ?")
                    .font(PulpeTypography.inputHelper)
            }
            .foregroundStyle(statusColor)
            .padding(.horizontal, DesignTokens.Spacing.md)
            .padding(.vertical, 6)
            .background(statusColor.opacity(DesignTokens.Opacity.badgeBackground))
            .clipShape(Capsule())
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.xxl)
    }

    // MARK: - Completion Section

    private var completionSection: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            HStack {
                Text("Pointage")
                    .font(PulpeTypography.labelLarge)

                Spacer()

                Text("\(realizedMetrics.checkedItemsCount) / \(realizedMetrics.totalItemsCount)")
                    .font(PulpeTypography.labelLargeBold)
                    .monospacedDigit()
                    .foregroundStyle(statusColor)
            }

            // Segmented progress bar
            CompletionBar(
                checked: realizedMetrics.checkedItemsCount,
                total: realizedMetrics.totalItemsCount,
                color: statusColor
            )
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            Text("Prévu vs Réalisé")
                .font(PulpeTypography.headline)

            VStack(spacing: 0) {
                CategoryRow(
                    label: "Revenus",
                    icon: "arrow.down.circle.fill",
                    iconColor: .financialIncome,
                    realized: realizedMetrics.realizedIncome,
                    planned: metrics.totalIncome
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.badge + DesignTokens.Spacing.md)

                CategoryRow(
                    label: "Dépenses",
                    icon: "arrow.up.circle.fill",
                    iconColor: .financialExpense,
                    realized: realizedMetrics.realizedExpenses,
                    planned: metrics.totalExpenses - metrics.totalSavings
                )

                Divider()
                    .padding(.leading, DesignTokens.IconSize.badge + DesignTokens.Spacing.md)

                CategoryRow(
                    label: "Épargne",
                    icon: TransactionKind.savingsIcon,
                    iconColor: .financialSavings,
                    realized: realizedMetrics.checkedSavingsAmount,
                    planned: metrics.totalSavings
                )
            }
            .padding(DesignTokens.Spacing.lg)
            .pulpeCardBackground()
        }
    }

    // MARK: - Tip Section

    private var tipSection: some View {
        HStack(alignment: .top, spacing: DesignTokens.Spacing.md) {
            Image(systemName: "lightbulb.fill")
                .font(.system(size: 14))
                .foregroundStyle(Color.warningPrimary)
                .frame(width: 28, height: 28)
                .background(Color.warningPrimary.opacity(DesignTokens.Opacity.badgeBackground))
                .clipShape(Circle())

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Astuce")
                    .font(PulpeTypography.labelLarge)

                Text(
                    "Compare ce solde avec ton compte bancaire. S'il y a un écart, " +
                    "vérifie que toutes tes dépenses sont bien pointées."
                )
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .pulpeCardBackground()
    }
}

// MARK: - Completion Bar (segmented)

private struct CompletionBar: View {
    let checked: Int
    let total: Int
    let color: Color

    private let segmentCount = 10
    private let segmentSpacing: CGFloat = 3
    private let segmentHeight: CGFloat = 8

    private var filledSegments: Int {
        guard total > 0 else { return 0 }
        return Int((Double(checked) / Double(total)) * Double(segmentCount))
    }

    var body: some View {
        HStack(spacing: segmentSpacing) {
            ForEach(0..<segmentCount, id: \.self) { index in
                Capsule()
                    .fill(index < filledSegments ? color : Color.progressTrack)
                    .frame(height: segmentHeight)
            }
        }
        .animation(DesignTokens.Animation.gentleSpring, value: filledSegments)
    }
}

// MARK: - Category Row

private struct CategoryRow: View {
    let label: String
    let icon: String
    let iconColor: Color
    let realized: Decimal
    let planned: Decimal

    @State private var barWidth: CGFloat = 0

    private var percentage: Double {
        guard planned > 0 else { return 0 }
        return min(Double(truncating: NSDecimalNumber(decimal: realized / planned)), 1.0)
    }

    private var percentageText: String {
        guard planned > 0 else { return "0%" }
        let pct = Int(truncating: NSDecimalNumber(decimal: realized / planned * 100))
        return "\(min(pct, 999))%"
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            // Icon badge
            Image(systemName: icon)
                .font(.system(size: 16))
                .foregroundStyle(.white)
                .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                .background(iconColor)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.sm + 2))

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                // Label + amounts
                HStack(alignment: .firstTextBaseline) {
                    Text(label)
                        .font(PulpeTypography.buttonSecondary)

                    Spacer()

                    Text("\(realized.asCompactCHF) / \(planned.asCompactCHF)")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                        .sensitiveAmount()
                }

                // Progress bar + percentage
                HStack(spacing: DesignTokens.Spacing.sm) {
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color.progressTrack)

                        Capsule()
                            .fill(iconColor)
                            .frame(width: barWidth * CGFloat(percentage))
                            .animation(.spring(duration: DesignTokens.Animation.slow), value: percentage)
                    }
                    .frame(height: DesignTokens.ProgressBar.thickHeight)
                    .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { barWidth = $0 }

                    Text(percentageText)
                        .font(PulpeTypography.progressUnit)
                        .foregroundStyle(Color.pulpeTextTertiary)
                        .monospacedDigit()
                        .frame(minWidth: 28, alignment: .trailing)
                }
            }
        }
        .padding(.vertical, DesignTokens.Spacing.md)
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
                    totalItemsCount: 25,
                    checkedSavingsAmount: 250
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
                    totalItemsCount: 20,
                    checkedSavingsAmount: 200
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
                    totalItemsCount: 15,
                    checkedSavingsAmount: 800
                )
            )
        }
}
