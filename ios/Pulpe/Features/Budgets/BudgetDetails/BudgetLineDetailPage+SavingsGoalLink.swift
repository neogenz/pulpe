import SwiftUI

// MARK: - Savings goal link (PUL-12)

extension BudgetLineDetailPage {
    @ViewBuilder
    func tagChips(for ids: [String]?) -> some View {
        let names = TagChips.names(for: ids, namesById: tagNamesById)
        if !names.isEmpty {
            TagChips(names: names)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.md)
        }
    }

    /// Tappable "Objectif : <name>" row shown on a saving prévision that is
    /// linked to a savings goal. Pushes the goal's progression detail through
    /// the router (the budget stack registers `SavingsGoalDestination`).
    ///
    /// Renders nothing for non-saving lines, unlinked lines, or while the
    /// goals cache hasn't resolved the id yet — the row appears once
    /// `SavingsGoalStore` loads (graceful fallback, no placeholder flash).
    @ViewBuilder
    func savingsGoalLink(for line: BudgetLine) -> some View {
        if line.kind == .saving,
           let goalId = line.savingsGoalId,
           let goal = linkedGoal(id: goalId) {
            Button {
                router.pushSavingsGoal(goal)
            } label: {
                HStack(spacing: DesignTokens.Spacing.md) {
                    Image(systemName: "target")
                        .font(PulpeTypography.actionIcon)
                        .foregroundStyle(Color.financialSavings)

                    Text("Objectif : \(goal.name)")
                        .font(PulpeTypography.listRowTitle)
                        .foregroundStyle(Color.textPrimary)
                        .lineLimit(1)

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textTertiary)
                        .accessibilityHidden(true)
                }
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
                .contentShape(Rectangle())
            }
            .plainPressedButtonStyle()
            .accessibilityLabel("Objectif d'épargne : \(goal.name)")
            .accessibilityHint("Touche pour ouvrir l'objectif")
        }
    }

    func hasSavingsGoalLink(for line: BudgetLine) -> Bool {
        line.kind == .saving
            && line.savingsGoalId.flatMap(linkedGoal(id:)) != nil
    }

    /// Resolves the linked goal from the app-level cache, or `nil` if the id is
    /// stale / not yet loaded.
    private func linkedGoal(id: String) -> SavingsGoal? {
        savingsGoalStore.goals.first { $0.id == id }
    }
}
