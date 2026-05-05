import SwiftUI

extension View {
    /// Keyboard toolbar with previous / next field navigation and an optional dismiss control.
    ///
    /// Matches Apple's documented pattern for `ToolbarItemPlacement.keyboard`:
    /// Uses a `ToolbarItemGroup` with a flexible `Spacer` so prev/next stay **leading**
    /// and the dismiss button stays **trailing**.
    ///
    /// - Parameters:
    ///   - focus: The current focused field binding.
    ///   - order: The array defining the logical navigation order of the fields.
    ///   - showsKeyboardDismiss: When false (e.g. onboarding), only field navigation is shown.
    func keyboardFieldNavigation<Field: Hashable>(
        focus: FocusState<Field?>.Binding,
        order: [Field],
        showsKeyboardDismiss: Bool = true
    ) -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                let currentIndex = focus.wrappedValue.flatMap { order.firstIndex(of: $0) }

                Button {
                    guard let currentIndex, currentIndex > 0 else { return }
                    focus.wrappedValue = order[currentIndex - 1]
                } label: {
                    Image(systemName: "chevron.up")
                }
                .accessibilityLabel(String(localized: "Champ précédent"))
                .disabled(currentIndex == nil || currentIndex == 0)

                Button {
                    guard let currentIndex, currentIndex < order.count - 1 else { return }
                    focus.wrappedValue = order[currentIndex + 1]
                } label: {
                    Image(systemName: "chevron.down")
                }
                .accessibilityLabel(String(localized: "Champ suivant"))
                .disabled(currentIndex == nil || currentIndex == order.count - 1)

                Spacer()

                if showsKeyboardDismiss {
                    Button {
                        focus.wrappedValue = nil
                    } label: {
                        // Standard Apple icon for dismissing the keyboard
                        Image(systemName: "keyboard.chevron.compact.down")
                    }
                    .accessibilityLabel(String(localized: "Fermer le clavier"))
                }
            }
        }
    }
}
