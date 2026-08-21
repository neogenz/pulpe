import SwiftUI

/// Badge displaying transaction kind (income, expense, saving)
struct RecurrenceBadge: View {
    let recurrence: TransactionRecurrence
    let style: BadgeStyle

    enum BadgeStyle {
        case full
        case compact
        case text
    }

    init(_ recurrence: TransactionRecurrence, style: BadgeStyle = .full) {
        self.recurrence = recurrence
        self.style = style
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            if style != .text {
                Image(systemName: recurrence.icon)
                    .font(PulpeTypography.caption2)
            }

            if style != .compact {
                Text(recurrence.label)
                    .font(PulpeTypography.caption2)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, style == .compact ? DesignTokens.Spacing.tightGap : DesignTokens.Spacing.sm)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .foregroundStyle(Color.textSecondary)
        .background(.secondary.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
    }
}

#Preview {
    HStack {
        RecurrenceBadge(.fixed)
        RecurrenceBadge(.oneOff)
    }
    .padding()
}
