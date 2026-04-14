import SwiftUI

extension View {
    /// Keyboard toolbar with previous / next field navigation and a dismiss control.
    ///
    /// Matches Apple's documented pattern for [ToolbarItemPlacement.keyboard](https://developer.apple.com/documentation/swiftui/toolbaritemplacement/keyboard):
    /// a single `ToolbarItemGroup(placement: .keyboard)` with bare `Button { } label: { Image(...) }`
    /// items and a `Spacer()` separating leading actions from the trailing dismiss control.
    func keyboardFieldNavigation<Field: Hashable>(
        focus: FocusState<Field?>.Binding,
        order: [Field]
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

                Spacer()

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
