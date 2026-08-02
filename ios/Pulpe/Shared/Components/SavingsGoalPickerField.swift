import SwiftUI

/// Form field that tags a saving prévision to a savings goal (PUL-12).
///
/// Reused by the template-line editor (primary tagging surface) and the
/// budget-line Add/Edit sheets. Callers show it only for `kind == .saving`;
/// `selection` is the goal id (`nil` = "Aucun objectif"). Reads goals from the
/// app-level `SavingsGoalStore` and refreshes them when it appears.
///
/// PUL-313 — when the caller passes `budgetPeriod`, goals whose deadline falls
/// before it are listed but disabled: `enforce_savings_goal_line_link` would
/// reject the link with a 422. Listed, not hidden — a goal that silently
/// disappears is unexplainable. Template lines pass no period and stay
/// unfiltered; the trigger's horizon branch only bounds `budget_line`.
struct SavingsGoalPickerField: View {
    struct SelectionState: Equatable {
        let hasLoadedOnce: Bool
        let isLoading: Bool
        let hasError: Bool
        let goalIDs: Set<String>

        func reconciled(_ selection: String?) -> String? {
            guard hasLoadedOnce, !isLoading, !hasError, let selection else {
                return selection
            }
            return goalIDs.contains(selection) ? selection : nil
        }
    }

    @Binding var selection: String?
    var budgetPeriod: BudgetPeriod?

    @Environment(SavingsGoalStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore

    /// The deadline period a goal puts a saving out of reach past, or `nil` when
    /// the link is allowed. Mirrors the trigger's own arithmetic through the
    /// shared period port — an undated goal has no horizon to fall outside of,
    /// and neither does a template line, which carries no period at all.
    static func exceededDeadline(
        for goal: SavingsGoal,
        budgetPeriod: BudgetPeriod?,
        payDayOfMonth: Int?
    ) -> BudgetPeriod? {
        guard let budgetPeriod, let targetDate = goal.targetDateValue else { return nil }
        let deadline = BudgetPeriodCalculator.periodForDate(targetDate, payDayOfMonth: payDayOfMonth)
        return BudgetPeriodCalculator.comparePeriods(budgetPeriod, deadline) > 0 ? deadline : nil
    }

    private func exceededDeadline(for goal: SavingsGoal) -> BudgetPeriod? {
        Self.exceededDeadline(
            for: goal,
            budgetPeriod: budgetPeriod,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    private var selectedGoal: SavingsGoal? {
        guard let selection else { return nil }
        return store.goals.first { $0.id == selection }
    }

    private var selectionState: SelectionState {
        SelectionState(
            hasLoadedOnce: store.hasLoadedOnce,
            isLoading: store.isLoading,
            hasError: store.error != nil,
            goalIDs: Set(store.goals.map(\.id))
        )
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Objectif")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            pickerContent
        }
        .task { await store.loadIfNeeded() }
        .onChange(of: selectionState, initial: true) { _, state in
            selection = state.reconciled(selection)
        }
    }

    @ViewBuilder
    private var pickerContent: some View {
        if store.hasError {
            errorContent
        } else if !store.hasLoadedOnce {
            loadingContent
        } else if store.goals.isEmpty {
            emptyContent
        } else {
            menuContent
        }
    }

    private var errorContent: some View {
        fieldSurface {
            Image(systemName: "exclamationmark.triangle")
                .foregroundStyle(Color.destructivePrimary)
            Text("Impossible de charger les objectifs")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
            Spacer()
            Button("Réessayer") {
                Task { await store.forceRefresh() }
            }
            .textLinkButtonStyle()
        }
        .accessibilityElement(children: .contain)
    }

    private var loadingContent: some View {
        fieldSurface {
            ProgressView()
                .controlSize(.small)
            Text("Chargement des objectifs…")
                .font(PulpeTypography.footnote)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .accessibilityElement(children: .combine)
    }

    private var emptyContent: some View {
        fieldSurface {
            Text("Aucun objectif disponible")
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .accessibilityLabel("Aucun objectif d'épargne disponible")
    }

    private var menuContent: some View {
        Menu {
            pickerButton(title: "Aucun objectif", isSelected: selection == nil) {
                selection = nil
            }
            Divider()
            ForEach(store.goals) { goal in
                if let deadline = exceededDeadline(for: goal) {
                    pickerButton(
                        title: goal.name,
                        subtitle: "Échéance dépassée · \(Formatters.monthName(for: deadline.month)) \(deadline.year)",
                        isSelected: goal.id == selection
                    ) {}
                    .disabled(true)
                } else {
                    pickerButton(title: goal.name, isSelected: goal.id == selection) {
                        selection = goal.id
                    }
                }
            }
        } label: {
            fieldSurface {
                Text(selectedGoal?.name ?? "Aucun objectif")
                    .foregroundStyle(selectedGoal == nil ? Color.onSurfaceVariant : Color.textPrimary)
                Spacer()
                Image(systemName: "chevron.up.chevron.down")
                    .font(.caption)
                    .foregroundStyle(Color.onSurfaceVariant)
            }
        }
        .accessibilityLabel("Objectif d'épargne")
        .accessibilityValue(selectedGoal?.name ?? "Aucun objectif")
    }

    private func fieldSurface<Content: View>(
        @ViewBuilder content: () -> Content
    ) -> some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            content()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .background(
            Color.surfaceContainerLow,
            in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
        )
    }

    /// `subtitle` rides in the same button so the reason travels with the goal
    /// it disables — a menu entry cannot carry a separate explanatory row.
    @ViewBuilder
    private func pickerButton(
        title: String,
        subtitle: String? = nil,
        isSelected: Bool,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            if isSelected {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
            if let subtitle {
                Text(subtitle)
            }
        }
    }
}
