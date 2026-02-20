import SwiftUI

/// Quick action buttons for the dashboard
struct QuickActionsBar: View {
    let onAddTransaction: () -> Void
    let onShowStats: () -> Void
    let onShowBudget: () -> Void

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            QuickActionButton(
                title: "Achat",
                systemImage: "plus",
                color: .pulpePrimary,
                action: onAddTransaction
            )

            QuickActionButton(
                title: "Stats",
                systemImage: "chart.bar.fill",
                color: .financialIncome,
                action: onShowStats
            )

            QuickActionButton(
                title: "Budget",
                systemImage: "list.bullet.rectangle",
                color: .financialSavings,
                action: onShowBudget
            )
        }
    }
}

/// Single quick action button
private struct QuickActionButton: View {
    let title: String
    let systemImage: String
    let color: Color
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Image(systemName: systemImage)
                    .font(.system(size: 20, weight: .semibold))
                    .foregroundStyle(color)
                    .frame(width: 44, height: 44)
                    .background(color.opacity(0.12))
                    .clipShape(Circle())

                Text(title)
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(.primary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        }
        .buttonStyle(.plain)
        .accessibilityLabel(title)
    }
}

#Preview {
    VStack {
        QuickActionsBar(
            onAddTransaction: {},
            onShowStats: {},
            onShowBudget: {}
        )
        .padding()
    }
    .background(Color(.systemGroupedBackground))
}
