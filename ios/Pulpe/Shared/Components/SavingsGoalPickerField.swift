import SwiftUI

/// Form field that tags a saving prévision to a savings goal (PUL-12).
///
/// Reused by the template-line editor (primary tagging surface) and the
/// budget-line Add/Edit sheets. Callers show it only for `kind == .saving`;
/// `selection` is the goal id (`nil` = "Aucun objectif"). Reads goals from the
/// app-level `SavingsGoalStore` and refreshes them when it appears.
struct SavingsGoalPickerField: View {
    @Binding var selection: String?

    @Environment(SavingsGoalStore.self) private var store

    private var selectedGoal: SavingsGoal? {
        guard let selection else { return nil }
        return store.goals.first { $0.id == selection }
    }

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Objectif")
                .font(PulpeTypography.labelMedium)
                .foregroundStyle(Color.onSurfaceVariant)

            Menu {
                pickerButton(title: "Aucun objectif", isSelected: selection == nil) {
                    selection = nil
                }
                if !store.goals.isEmpty {
                    Divider()
                    ForEach(store.goals) { goal in
                        pickerButton(title: goal.name, isSelected: goal.id == selection) {
                            selection = goal.id
                        }
                    }
                }
            } label: {
                HStack {
                    Text(selectedGoal?.name ?? "Aucun objectif")
                        .foregroundStyle(selectedGoal == nil ? Color.onSurfaceVariant : Color.textPrimary)
                    Spacer()
                    Image(systemName: "chevron.up.chevron.down")
                        .font(.caption)
                        .foregroundStyle(Color.onSurfaceVariant)
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
                .background(
                    Color.surfaceContainerLow,
                    in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
                )
            }
            .accessibilityLabel("Objectif d'épargne")
            .accessibilityValue(selectedGoal?.name ?? "Aucun objectif")
        }
        .task { await store.loadIfNeeded() }
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
