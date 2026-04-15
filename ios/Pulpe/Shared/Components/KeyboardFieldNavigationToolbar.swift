import SwiftUI

extension View {
    /// Keyboard toolbar with previous / next field navigation and an optional dismiss control.
    ///
    /// Matches Apple's documented pattern for [ToolbarItemPlacement.keyboard](https://developer.apple.com/documentation/swiftui/toolbaritemplacement/keyboard):
    /// a single `ToolbarItemGroup(placement: .keyboard)` with bare `Button { } label: { Image(...) }`
    /// items inside an `HStack` with a flexible `Spacer` so prev/next stay **leading**; with `showsKeyboardDismiss`,
    /// the checkmark stays **trailing**. Without `HStack` + `Spacer`, SwiftUI centers the few keyboard items.
    /// - Parameter showsKeyboardDismiss: When false (e.g. onboarding), only field navigation is shown.
    func keyboardFieldNavigation<Field: Hashable>(
        focus: FocusState<Field?>.Binding,
        order: [Field],
        showsKeyboardDismiss: Bool = true
    ) -> some View {
        toolbar {
            ToolbarItemGroup(placement: .keyboard) {
                let currentIndex = focus.wrappedValue.flatMap { order.firstIndex(of: $0) }

                HStack(spacing: 0) {
                    Button {
                        guard let currentIndex, currentIndex > 0 else { return }
                        focus.wrappedValue = order[currentIndex - 1]
                    } label: {
                        Image(systemName: "chevron.up")
                    }
                    .accessibilityLabel("Champ précédent")
                    .disabled((currentIndex ?? 0) == 0)

                    Button {
                        guard let currentIndex, currentIndex < order.count - 1 else { return }
                        focus.wrappedValue = order[currentIndex + 1]
                    } label: {
                        Image(systemName: "chevron.down")
                    }
                    .accessibilityLabel("Champ suivant")
                    .disabled((currentIndex ?? order.count - 1) >= order.count - 1)

                    Spacer(minLength: 0)

                    if showsKeyboardDismiss {
                        Button {
                            focus.wrappedValue = nil
                        } label: {
                            Image(systemName: "checkmark")
                        }
                        .accessibilityLabel("Fermer le clavier")
                    }
                }
            }
        }
    }
}
