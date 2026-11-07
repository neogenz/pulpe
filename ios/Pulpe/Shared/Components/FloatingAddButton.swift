import SwiftUI

/// The one global add button (V2 `fab`): a solid `pulpePrimary` circle with a white plus.
/// Solid, not glass: it is the screen's single filled action.
struct FloatingAddButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Image(systemName: "plus")
                .font(.system(size: DesignTokens.Control.fabGlyph, weight: .semibold))
                .foregroundStyle(Color.textOnPrimary)
                .frame(width: DesignTokens.Control.fab, height: DesignTokens.Control.fab)
                .background(Color.pulpePrimary, in: Circle())
                .shadow(DesignTokens.Shadow.floatingAction)
                .contentShape(Circle())
        }
        .buttonStyle(FloatingAddButtonStyle())
        .accessibilityLabel("Ajouter une opération")
        .accessibilityIdentifier("floatingAddButton")
    }
}

private struct FloatingAddButtonStyle: ButtonStyle {
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? DesignTokens.Animation.pressedButtonScale : 1)
            .animation(
                reduceMotion ? nil : .easeOut(duration: DesignTokens.Animation.fast),
                value: configuration.isPressed
            )
    }
}

#Preview {
    FloatingAddButton {}
        .padding()
        .background(Color.appBackground)
}
