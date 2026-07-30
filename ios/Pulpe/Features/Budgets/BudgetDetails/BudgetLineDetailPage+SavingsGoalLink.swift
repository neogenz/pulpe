import SwiftUI

// MARK: - Savings goal link (PUL-12)

extension BudgetLineDetailPage {
    @ViewBuilder
    func contextualLinksSection(for line: BudgetLine) -> some View {
        if hasSavingsGoalLink(for: line) || line.isSpread {
            Section {
                // Both links live in one row: each `ContextLinkRow` carries its
                // own card, so the List only has to stay out of the way — a
                // default row background would paint the system band back in.
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    savingsGoalLink(for: line)

                    if let spreadGroupId = line.spreadGroupId {
                        SpreadAffordanceButton(kind: line.kind) {
                            router.present(
                                .spreadOccurrences(
                                    spreadGroupId: spreadGroupId.uuidString,
                                    kind: line.kind
                                )
                            )
                        }
                    }
                }
                .listRowCustomStyled()
            }
            .listSectionSeparator(.hidden)
        }
    }

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
            ContextLinkRow(
                icon: "target",
                iconTint: .financialSavings,
                title: "Objectif : \(goal.name)",
                accessibilityLabel: "Objectif d'épargne : \(goal.name)",
                accessibilityHint: "Touche pour ouvrir l'objectif",
                action: { router.pushSavingsGoal(goal) }
            )
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
