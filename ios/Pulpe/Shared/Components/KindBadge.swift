import SwiftUI

/// Badge displaying transaction kind (income, expense, saving)
struct KindBadge: View {
    let kind: TransactionKind
    let style: BadgeStyle

    enum BadgeStyle {
        case full      // Icon + text
        case compact   // Icon only
        case text      // Text only
    }

    init(_ kind: TransactionKind, style: BadgeStyle = .full) {
        self.kind = kind
        self.style = style
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            if style != .text {
                Image(systemName: kind.icon)
                    .font(PulpeTypography.caption2)
            }

            if style != .compact {
                Text(kind.label)
                    .font(PulpeTypography.caption2)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, style == .compact ? DesignTokens.Spacing.tightGap : DesignTokens.Spacing.sm)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .foregroundStyle(kind.color)
        .background(kind.color.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
    }
}

/// Badge displaying recurrence type (fixed, one_off)
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

/// Combined badge row for budget lines
struct BudgetLineBadges: View {
    let kind: TransactionKind
    let recurrence: TransactionRecurrence

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            KindBadge(kind, style: .compact)
            RecurrenceBadge(recurrence, style: .compact)
        }
    }
}

#Preview {
    VStack(spacing: 16) {
        HStack {
            KindBadge(.income, style: .full)
            KindBadge(.expense, style: .full)
            KindBadge(.saving, style: .full)
        }

        HStack {
            KindBadge(.income, style: .compact)
            KindBadge(.expense, style: .compact)
            KindBadge(.saving, style: .compact)
        }

        HStack {
            RecurrenceBadge(.fixed)
            RecurrenceBadge(.oneOff)
        }

        BudgetLineBadges(kind: .expense, recurrence: .fixed)
    }
    .padding()
}
