import SwiftUI

// MARK: - Shared chrome of the three savings-goal pickers

/// Internal rather than file-private: `SavingsGoalPlannedWithdrawalPicker` wears
/// the same chrome from its own file. `.standalone` is the soft input surface;
/// `.row` is one bare line of a `FormCard`.
@ViewBuilder
func savingsGoalFieldSurface(
    style: FormRowStyle = .standalone,
    @ViewBuilder content: () -> some View
) -> some View {
    switch style {
    case .standalone:
        HStack(spacing: DesignTokens.Spacing.sm) {
            content()
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .background(
            Color.surfaceContainerLow,
            in: RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button)
        )
    case .row:
        HStack(spacing: DesignTokens.Spacing.sm) {
            content()
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
    }
}

/// The label of a goal `Menu`: the chosen goal on a soft surface, or, as a row,
/// the field title on the left and the chosen goal with a chevron on the right.
@ViewBuilder
func savingsGoalMenuLabel(
    style: FormRowStyle,
    title: String,
    value: String,
    isPlaceholder: Bool
) -> some View {
    let valueColor = isPlaceholder ? Color.onSurfaceVariant : Color.textPrimary
    switch style {
    case .standalone:
        savingsGoalFieldSurface {
            Text(value)
                .foregroundStyle(valueColor)
            Spacer()
            Image(systemName: "chevron.up.chevron.down")
                .font(.caption)
                .foregroundStyle(Color.onSurfaceVariant)
        }
    case .row:
        savingsGoalFieldSurface(style: .row) {
            Text(title)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textPrimary)
            Spacer()
            Text(value)
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(valueColor)
                .lineLimit(1)
            Image(systemName: "chevron.right")
                .font(.caption)
                .foregroundStyle(Color.onSurfaceVariant)
        }
        .contentShape(Rectangle())
    }
}

/// Failed load, with the retry the caller owns — the three pickers fetch from
/// three different places but say the same thing when the fetch fails.
/// `@MainActor` because `textLinkButtonStyle()` is: a free function inherits no
/// isolation from the view body that calls it.
@MainActor @ViewBuilder
func savingsGoalFieldError(retry: @escaping () -> Void) -> some View {
    savingsGoalFieldSurface {
        Image(systemName: "exclamationmark.triangle")
            .foregroundStyle(Color.destructivePrimary)
        Text("Impossible de charger les objectifs")
            .font(PulpeTypography.footnote)
            .foregroundStyle(Color.onSurfaceVariant)
        Spacer()
        Button("Réessayer", action: retry)
            .textLinkButtonStyle()
    }
    .accessibilityElement(children: .contain)
}

@ViewBuilder
func savingsGoalFieldLoading() -> some View {
    savingsGoalFieldSurface {
        ProgressView()
            .controlSize(.small)
        Text("Chargement des objectifs…")
            .font(PulpeTypography.footnote)
            .foregroundStyle(Color.onSurfaceVariant)
    }
    .accessibilityElement(children: .combine)
}

/// `subtitle` rides in the same button so the reason travels with the goal
/// it disables — a menu entry cannot carry a separate explanatory row.
@ViewBuilder
func savingsGoalPickerButton(
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
