import SwiftUI

/// Card displaying a financial metric with colored accent bar
struct FinancialSummaryCard: View {
    let title: String
    let amount: Decimal
    let type: FinancialType

    enum FinancialType {
        case income
        case expense
        case savings
        case balance

        var accentColor: Color {
            switch self {
            case .income: .financialIncome
            case .expense: .financialExpense
            case .savings: .financialSavings
            case .balance: .pulpePrimary
            }
        }
    }

    private var amountColor: Color {
        if type == .balance && amount < 0 {
            return .red
        }
        return .primary
    }

    var body: some View {
        HStack(spacing: 0) {
            // Colored accent bar
            RoundedRectangle(cornerRadius: 2)
                .fill(type.accentColor)
                .frame(width: 4)

            VStack(alignment: .leading, spacing: 6) {
                Text(title)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                HStack(alignment: .firstTextBaseline, spacing: 4) {
                    Text("CHF")
                        .font(.subheadline)
                        .fontWeight(.regular)
                        .foregroundStyle(Color.textTertiary)

                    Text(amount.formatted(.number.grouping(.automatic)))
                        .font(.title2)
                        .fontWeight(.semibold)
                        .monospacedDigit()
                        .foregroundStyle(amountColor)
                }
            }
            .padding(.leading, 12)
            .padding(.vertical, 14)
            .padding(.trailing, 16)
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

/// Horizontal row of financial summary cards
struct FinancialSummaryRow: View {
    let metrics: BudgetFormulas.Metrics

    var body: some View {
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
                    title: "Disponible",
                    amount: metrics.remaining,
                    type: .balance
                )
                .frame(width: 160)
            }
            .padding(.horizontal)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        FinancialSummaryCard(
            title: "Revenus",
            amount: 7956,
            type: .income
        )
        .frame(width: 160)

        FinancialSummaryCard(
            title: "Disponible",
            amount: -500,
            type: .balance
        )
        .frame(width: 160)

        FinancialSummaryRow(metrics: .init(
            totalIncome: 5000,
            totalExpenses: 3500,
            totalSavings: 500,
            available: 5500,
            endingBalance: 2000,
            remaining: 2000,
            rollover: 500
        ))
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
