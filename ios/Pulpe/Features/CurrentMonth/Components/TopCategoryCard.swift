import SwiftUI

/// Card showing the top spending category of the month
struct TopCategoryCard: View {
    let categoryName: String
    let amount: Decimal
    let totalExpenses: Decimal

    private var percentageOfTotal: Int {
        guard totalExpenses > 0 else { return 0 }
        return Int(((amount / totalExpenses * 100) as NSDecimalNumber).doubleValue)
    }

    var body: some View {
        HStack(spacing: 12) {
            // Category icon
            Circle()
                .fill(Color.financialExpense.opacity(0.15))
                .frame(width: 40, height: 40)
                .overlay {
                    Image(systemName: "chart.pie.fill")
                        .font(.system(size: 18))
                        .foregroundStyle(Color.financialExpense)
                }

            // Category info
            VStack(alignment: .leading, spacing: 2) {
                Text("Top catégorie")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(categoryName)
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

                Text("\(percentageOfTotal)% des dépenses")
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Top catégorie: \(categoryName), \(amount.asCHF), \(percentageOfTotal) pourcent des dépenses")
    }
}

// MARK: - Preview

#Preview("Top Category Card") {
    VStack(spacing: 16) {
        TopCategoryCard(
            categoryName: "Restaurants",
            amount: 450,
            totalExpenses: 2500
        )

        TopCategoryCard(
            categoryName: "Courses alimentaires",
            amount: 800,
            totalExpenses: 3200
        )

        TopCategoryCard(
            categoryName: "Transport",
            amount: 150,
            totalExpenses: 2000
        )
    }
    .padding()
    .background(Color(.systemGroupedBackground))
}
