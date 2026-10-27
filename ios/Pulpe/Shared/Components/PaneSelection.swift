import SwiftUI

extension View {
    /// A list row that picks what the pane beside the list shows (the open iPhone Duo) instead
    /// of pushing a page. The row picked reads as a lifted tile on the bare canvas.
    func selectsBesidePane(isSelected: Bool, action: @escaping () -> Void) -> some View {
        modifier(PaneSelectionModifier(isSelected: isSelected, action: action))
    }
}

private struct PaneSelectionModifier: ViewModifier {
    let isSelected: Bool
    let action: () -> Void

    func body(content: Content) -> some View {
        content
            .background {
                if isSelected {
                    // Bleeds past the text column so the row reads as a lifted tile.
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button, style: .continuous)
                        .fill(Color.surfaceContainerLowest)
                        .padding(.horizontal, -DesignTokens.Spacing.sm)
                }
            }
            .contentShape(Rectangle())
            // A tap, not a Button: a swipe that starts on the list means « back » on the page
            // beside it, and a Button still fires when the finger lifts inside a wide row.
            .onTapGesture(perform: action)
            .accessibilityElement(children: .combine)
            .accessibilityAction(.default, action)
            .accessibilityAddTraits(isSelected ? [.isButton, .isSelected] : .isButton)
    }
}
