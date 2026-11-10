import SwiftUI

/// A row of the month sheets' form card (V2 `frow`): the field's name, its value, and a
/// chevron when the row opens a picker.
struct BudgetFormValueRow: View {
    let title: String
    let value: String
    var emphasizesValue = true
    var showsChevron = true

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.sm) {
            Text(title)
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(value)
                .font(emphasizesValue ? PulpeTypography.rowTitle : PulpeTypography.rowTitleRegular)
                .foregroundStyle(emphasizesValue ? Color.textPrimary : Color.textSecondary)
                .lineLimit(1)
                .minimumScaleFactor(DesignTokens.TextScale.compact)
            if showsChevron {
                RowChevron()
            }
        }
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}

/// The sheets' bottom call to action, above the home indicator.
struct BudgetSheetCTA: View {
    let title: String
    let isEnabled: Bool
    var accessibilityIdentifier: String?
    let action: () -> Void

    var body: some View {
        Button(title, action: action)
            .primaryButtonStyle(isEnabled: isEnabled)
            .disabled(!isEnabled)
            .ifLet(accessibilityIdentifier) { view, id in view.accessibilityIdentifier(id) }
            .padding(.horizontal, DesignTokens.Spacing.xl)
            .padding(.vertical, DesignTokens.Spacing.md)
            .background(Color.sheetBackground)
    }
}

// MARK: - Preview

#Preview("Create Budget") {
    CreateBudgetView(month: 1, year: 2025) { budget in
        print("Created: \(budget)")
    }
    .environment(UserSettingsStore())
}
