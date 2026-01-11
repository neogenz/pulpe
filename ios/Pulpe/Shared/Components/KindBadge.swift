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
        HStack(spacing: 4) {
            if style != .text {
                Image(systemName: kind.icon)
                    .font(.caption2)
            }

            if style != .compact {
                Text(kind.shortLabel)
                    .font(.caption2)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, style == .compact ? 6 : 8)
        .padding(.vertical, 4)
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
        HStack(spacing: 4) {
            if style != .text {
                Image(systemName: recurrence.icon)
                    .font(.caption2)
            }

            if style != .compact {
                Text(recurrence.label)
                    .font(.caption2)
                    .fontWeight(.medium)
            }
        }
        .padding(.horizontal, style == .compact ? 6 : 8)
        .padding(.vertical, 4)
        .foregroundStyle(.secondary)
        .background(.secondary.opacity(DesignTokens.Opacity.badgeBackground), in: Capsule())
    }
}

/// Combined badge row for budget lines
struct BudgetLineBadges: View {
    let kind: TransactionKind
    let recurrence: TransactionRecurrence

    var body: some View {
        HStack(spacing: 6) {
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
