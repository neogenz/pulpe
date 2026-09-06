import SwiftUI

// MARK: - Template Line Row

/// One ledger row of the template detail: nature disc, name, a words-only subtitle
/// (« Mensuel » / « Ponctuel », the linked goal, the tag count) and the signed amount.
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
        var parts = [line.recurrence.label]
        if let goalName {
            parts.append(AppLocale.string("Objectif : \(goalName)"))
        }
        return parts.joined(separator: " · ")
    }

    var body: some View {
        Button(action: onEdit) {
            HStack(spacing: DesignTokens.Spacing.sm) {
                RowIcon(systemName: line.kind.icon, tint: line.kind.color)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text(line.name)
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    HStack(spacing: DesignTokens.Spacing.xs) {
                        Text(subtitle)
                            .font(PulpeTypography.listRowSubtitle)
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

                Text(line.amount.asSignedAmount(for: line.kind, in: userSettingsStore.currency))
                    .font(PulpeTypography.listRowTitle)
                    .monospacedDigit()
                    .foregroundStyle(line.kind.color)
                    .sensitiveAmount()

                Image(systemName: "chevron.right")
                    .font(.footnote.weight(.semibold))
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .padding(.vertical, DesignTokens.ListRow.verticalPadding)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityHint("Touche pour modifier")
    }
}
