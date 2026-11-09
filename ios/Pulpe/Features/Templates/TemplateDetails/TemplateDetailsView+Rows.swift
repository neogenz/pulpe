import SwiftUI

// MARK: - Template Line Row

/// One ledger row of the template detail (V2 `row`): the name, a words-only subtitle
/// (« Mensuel », the linked goal, the tag count) and the amount in ink, no icon.
struct TemplateLineRow: View {
    let line: TemplateLine
    let tagNamesById: [String: String]
    let onEdit: () -> Void

    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore

    static func goalName(for goalId: String?, in goals: [SavingsGoal]) -> String? {
        guard let goalId else { return nil }
        return goals.first { $0.id == goalId }?.name
    }

    private var goalName: String? {
        Self.goalName(for: line.savingsGoalId, in: savingsGoalStore.goals)
    }

    private var subtitle: String {
        TemplatePresentation.lineSubtitle(recurrence: line.recurrence, isLinkedToGoal: goalName != nil)
    }

    /// An income is signed, the rest are plain.
    private var amountText: String {
        let amount = line.amount.asAmount(for: userSettingsStore.currency)
        return line.kind == .income ? "+" + amount : amount
    }

    var body: some View {
        Button(action: onEdit) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.dividerGap) {
                    Text(line.name)
                        .font(PulpeTypography.rowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Text(subtitle)
                            .font(PulpeTypography.captionRegular)
                            .foregroundStyle(Color.textSecondary)
                            .lineLimit(1)
                            .ifLet(goalName) { view, _ in
                                view.accessibilityIdentifier("templateLineGoalChip-\(line.id)")
                            }

                        let tagNames = TagChips.names(for: line.tagIds, namesById: tagNamesById)
                        if !tagNames.isEmpty {
                            TagChips(names: tagNames, presentation: .count, followsText: true)
                        }
                    }
                }

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(amountText)
                    .font(PulpeTypography.rowAmount)
                    .foregroundStyle(Color.textPrimary)
                    .lineLimit(1)
                    .sensitiveAmount()

                RowChevron()
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding + DesignTokens.Spacing.xxs)
            .frame(minHeight: DesignTokens.ListRow.minHeight)
            .contentShape(Rectangle())
        }
        .plainPressedButtonStyle()
        .accessibilityHint("Touche pour modifier")
    }
}
