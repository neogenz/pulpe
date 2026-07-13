import SwiftUI

/// Form field that tags a saving prévision to a savings goal (PUL-12).
///
/// Reused by the template-line editor (primary tagging surface) and the
/// budget-line Add/Edit sheets. Callers show it only for `kind == .saving`;
/// `selection` is the goal id (`nil` = "Aucun objectif"). Reads goals from the
/// app-level `SavingsGoalStore` and refreshes them when it appears.
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

    @Environment(SavingsGoalStore.self) private var store

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
                pickerButton(title: goal.name, isSelected: goal.id == selection) {
                    selection = goal.id
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

    @ViewBuilder
    private func pickerButton(title: String, isSelected: Bool, action: @escaping () -> Void) -> some View {
        Button(action: action) {
            if isSelected {
                Label(title, systemImage: "checkmark")
            } else {
                Text(title)
            }
        }
    }
}
