import SwiftUI

struct RealizedBalanceSheet: View {
    let metrics: BudgetFormulas.Metrics
    let realizedMetrics: BudgetFormulas.RealizedMetrics

    @Environment(\.dismiss) private var dismiss

    private var balanceColor: Color {
        realizedMetrics.realizedBalance >= 0 ? .financialIncome : .red
    }

    private var progressPercentage: Double {
        realizedMetrics.completionPercentage
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    financialOverviewSection
                    realizedBalanceSection
                    explanationSection
                }
                .padding(.top, 8)
                .padding(.bottom, 32)
            }
            .background(Color(.systemGroupedBackground))
            .navigationTitle("Vue d'ensemble")
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

    // MARK: - Financial Overview (4 cards)

    private var financialOverviewSection: some View {
        ScrollView(.horizontal, showsIndicators: false) {
            HStack(spacing: 12) {
                FinancialSummaryCard(
                    title: "Revenus",
                    amount: metrics.totalIncome,
                    type: .income
                )
                .frame(width: 160)

                FinancialSummaryCard(
                    title: "Dépenses",
                    amount: metrics.totalExpenses,
                    type: .expense
                )
                .frame(width: 160)

                FinancialSummaryCard(
                    title: "Épargne",
                    amount: metrics.totalSavings,
                    type: .savings
                )
                .frame(width: 160)

                FinancialSummaryCard(
                    title: "Disponible",
                    amount: metrics.remaining,
                    type: .balance
                )
                .frame(width: 160)
            }
            .padding(.horizontal)
        }
    }

    // MARK: - Realized Balance Section

    private var realizedBalanceSection: some View {
        VStack(spacing: 16) {
            // Header with realized expenses and current balance
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: 4) {
                    Text("Dépenses réalisées CHF")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Text(realizedMetrics.realizedExpenses.asCHF)
                        .font(.title2)
                        .fontWeight(.semibold)
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    Text("Solde actuel CHF")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    Text(realizedMetrics.realizedBalance.asCHF)
                        .font(.title2)
                        .fontWeight(.semibold)
                        .foregroundStyle(balanceColor)
                }
            }

            // Progress bar
            VStack(spacing: 8) {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Capsule()
                            .fill(Color(.systemGray5))

                        Capsule()
                            .fill(Color.pulpePrimary)
                            .frame(width: geometry.size.width * CGFloat(min(progressPercentage / 100, 1)))
                    }
                }
                .frame(height: 10)

                Text("\(realizedMetrics.checkedItemsCount)/\(realizedMetrics.totalItemsCount) éléments exécutés")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    // MARK: - Explanation Section

    private var explanationSection: some View {
        HStack(alignment: .top, spacing: 12) {
            Image(systemName: "info.circle")
                .font(.title3)
                .foregroundStyle(.secondary)

            Text("Ce solde est calculé en fonction des dépenses que vous avez cochées comme effectuées. Comparez-le à votre solde bancaire pour vérifier qu'il n'y a pas d'écart.")
                .font(.subheadline)
                .foregroundStyle(.secondary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }
}

// MARK: - Previews

#Preview("Normal Balance") {
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
