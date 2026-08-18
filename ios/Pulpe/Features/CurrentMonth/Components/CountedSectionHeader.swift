import SwiftUI

/// Inline list header with title, count badge, and total amount — the header of
/// a grouped list, not of a page section. `Shared/Components/SectionHeader`
/// names a page section; this one counts what a group holds.
struct CountedSectionHeader: View {
    let title: String
    let count: Int
    let totalAmount: Decimal?
    var totalColor: Color = .primary

    @Environment(UserSettingsStore.self) private var userSettingsStore

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            // Title
            Text(title)
                .font(PulpeTypography.headline)
                .foregroundStyle(Color.textPrimary)
                .lineLimit(1)

            // Count badge
            Text(verbatim: "\(count)")
                .font(PulpeTypography.inputHelper)
                .foregroundStyle(Color.textOnPrimary)
                .padding(.horizontal, DesignTokens.Spacing.sm)
                .padding(.vertical, DesignTokens.Spacing.dividerGap)
                .background(Color.countBadge)
                .clipShape(Capsule())

            Spacer()

            // Total amount (optional)
            if let total = totalAmount {
                Text(total.asArithmeticSignedCompactCurrency(userSettingsStore.currency))
                    .font(PulpeTypography.labelLarge)
                    .monospacedDigit()
                    .foregroundStyle(totalColor)
                    .sensitiveAmount()
            }
        }
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isHeader)
        .accessibilityValue(totalAmount?.asArithmeticSignedCompactCurrency(userSettingsStore.currency) ?? "")
    }
}

// MARK: - Preview

#Preview {
    VStack(spacing: 24) {
        CountedSectionHeader(
            title: "Dépenses récurrentes",
            count: 5,
            totalAmount: 2500,
            totalColor: .financialExpense
        )

        CountedSectionHeader(
            title: "Autres dépenses",
            count: 3,
            totalAmount: 450.50,
            totalColor: .financialExpense
        )

        CountedSectionHeader(
            title: "Sans total",
            count: 0,
            totalAmount: nil
        )
    }
    .padding(.vertical)
    .background(Color.surface)
    .environment(UserSettingsStore())
}
