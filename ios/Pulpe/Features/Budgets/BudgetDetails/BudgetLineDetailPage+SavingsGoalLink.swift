import SwiftUI

// MARK: - Savings goal link (PUL-12)

extension BudgetLineDetailPage {
    @ViewBuilder
    func contextualLinksSection(for line: BudgetLine) -> some View {
        if hasSavingsGoalLink(for: line) || line.isSpread || line.savingsGoalSource != nil {
            Section {
                // Both links live in one row: each `ContextLinkRow` carries its
                // own card, so the List only has to stay out of the way — a
                // default row background would paint the system band back in.
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
                    savingsGoalLink(for: line)
                    savingsGoalSourceLink(for: line)

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
                title: AppLocale.string("Objectif : \(goal.name)"),
                accessibilityLabel: AppLocale.string("Objectif d'épargne : \(goal.name)"),
                accessibilityHint: AppLocale.string("Touche pour ouvrir l'objectif"),
                action: { router.pushSavingsGoal(goal) }
            )
            .accessibilityIdentifier("budgetLineDetailGoalLink")
        }
    }

    /// PUL-329 v2 — the goal an income forecast announces a withdrawal FROM, the
    /// opposite direction of the link above. Same read-only treatment as the
    /// transaction editor's origin row: fixed at creation, and neutral once the
    /// goal is gone.
    @ViewBuilder
    func savingsGoalSourceLink(for line: BudgetLine) -> some View {
        if let source = line.savingsGoalSource {
            switch source {
            case .active(let goalId, _):
                ContextLinkRow(
                    icon: source.icon,
                    iconTint: .financialSavings,
                    title: source.label,
                    accessibilityLabel: source.accessibilityLabel,
                    accessibilityHint: AppLocale.string("Touche pour ouvrir l'objectif"),
                    action: {
                        guard let goal = linkedGoal(id: goalId) else { return }
                        router.pushSavingsGoal(goal)
                    }
                )
            case .broken:
                // No action, no chevron: a row that looked navigable would promise
                // a screen that cannot open.
                ContextLinkRow(
                    icon: source.icon,
                    iconTint: .textTertiary,
                    title: source.label,
                    detail: SavingsGoalSource.brokenExplanation,
                    accessibilityLabel: source.accessibilityLabel
                )
            }
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
