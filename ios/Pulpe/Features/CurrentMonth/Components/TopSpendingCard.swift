import SwiftUI

/// Card showing the top spending budget line (envelope) of the month
struct TopSpendingCard: View {
    let name: String
    let amount: Decimal
    let totalExpenses: Decimal

    private var percentageOfTotal: Int {
        guard totalExpenses > 0 else { return 0 }
        return Int(((amount / totalExpenses * 100) as NSDecimalNumber).doubleValue)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Icon
            Circle()
                .fill(Color.financialExpense.opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: "chart.pie.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.financialExpense)
                }

            // Label and name
            VStack(alignment: .leading, spacing: 2) {
                Text("Où part ton argent")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(name)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)
                    .lineLimit(1)
            }

            Spacer()

            // Amount and percentage
            VStack(alignment: .trailing, spacing: 2) {
                Text(amount.asCHF)
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(.primary)

                Text("\(percentageOfTotal)% de tes dépenses")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Où part ton argent: \(name), \(amount.asCHF), \(percentageOfTotal) pourcent de tes dépenses")
    }
}

// MARK: - Preview

#Preview("Top Spending Card") {
    VStack(spacing: 16) {
        TopSpendingCard(
            name: "Restaurants",
            amount: 450,
            totalExpenses: 2500
        )

        TopSpendingCard(
            name: "Courses alimentaires",
            amount: 800,
            totalExpenses: 3200
        )

        TopSpendingCard(
            name: "Transport",
            amount: 150,
            totalExpenses: 2000
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
