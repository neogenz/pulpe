import SwiftUI

/// Revolut-style section header with title, count badge, and total amount
struct SectionHeader: View {
    let title: String
    let count: Int
    let totalAmount: Decimal?
    var totalColor: Color = .primary

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            // Title
            Text(title)
                .font(.headline)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            // Count badge
            Text("\(count)")
                .font(.system(.caption, design: .rounded, weight: .semibold))
                .foregroundStyle(Color.textOnPrimary)
                .padding(.horizontal, DesignTokens.Spacing.sm)
                .padding(.vertical, 3)
                .background(Color.countBadge)
                .clipShape(Capsule())

            Spacer()

            // Total amount (optional)
            if let total = totalAmount {
                Text(total.asCHF)
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(totalColor)
                    .sensitiveAmount()
            }
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        SectionHeader(
            title: "Dépenses récurrentes",
            count: 5,
            totalAmount: 2500,
            totalColor: .financialExpense
        )

        SectionHeader(
            title: "Autres dépenses",
            count: 3,
            totalAmount: 450.50,
            totalColor: .financialExpense
        )

        SectionHeader(
            title: "Sans total",
            count: 0,
            totalAmount: nil
        )
    }
    .padding(.vertical)
    .background(Color(.systemGroupedBackground))
}
