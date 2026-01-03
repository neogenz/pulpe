import SwiftUI

/// Card displaying a financial metric
struct FinancialSummaryCard: View {
    let title: String
    let amount: Decimal
    let icon: String
    let type: FinancialType

    enum FinancialType {
        case income
        case expense
        case savings
        case balance
        case neutral

        var color: Color {
            switch self {
            case .income: .green
            case .expense: .red
            case .savings: .blue
            case .balance: .primary
            case .neutral: .secondary
            }
        }

        var backgroundColor: Color {
            switch self {
            case .income: .green.opacity(0.1)
            case .expense: .red.opacity(0.1)
            case .savings: .blue.opacity(0.1)
            case .balance: .primary.opacity(0.1)
            case .neutral: .secondary.opacity(0.1)
            }
        }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 8) {
            HStack {
                Image(systemName: icon)
                    .font(.title3)
                    .foregroundStyle(type.color)
                    .frame(width: 32, height: 32)
                    .background(type.backgroundColor, in: Circle())

                Spacer()
            }

            Text(title)
                .font(.caption)
                .foregroundStyle(.secondary)

            Text(amount.formatted(.currency(code: "CHF")))
                .font(.title3)
                .fontWeight(.semibold)
                .foregroundStyle(type == .balance && amount < 0 ? .red : .primary)
        }
        .padding()
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
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
                    icon: "arrow.down.circle.fill",
                    type: .income
                )
                .frame(width: 140)

                FinancialSummaryCard(
                    title: "Dépenses",
                    amount: metrics.totalExpenses,
                    icon: "arrow.up.circle.fill",
                    type: .expense
                )
                .frame(width: 140)

                FinancialSummaryCard(
                    title: "Disponible",
                    amount: metrics.remaining,
                    icon: "banknote.fill",
                    type: .balance
                )
                .frame(width: 140)
            }
            .padding(.horizontal)
        }
    }
}

#Preview {
    VStack(spacing: 20) {
        FinancialSummaryCard(
            title: "Revenus",
            amount: 5000,
            icon: "arrow.down.circle.fill",
            type: .income
        )
        .frame(width: 150)

        FinancialSummaryRow(metrics: .init(
            totalIncome: 5000,
            totalExpenses: 3500,
            available: 5500,
            endingBalance: 2000,
            remaining: 2000,
            rollover: 500
        ))
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
