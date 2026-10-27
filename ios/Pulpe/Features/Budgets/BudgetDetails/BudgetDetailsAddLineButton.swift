import SwiftUI

/// The one filled element in the budget's content zone, and the same shape the accueil gives
/// to recording an operation — only the word changes. Adding a forecast is what this screen
/// is for; the other action it offers only reads what is already there, so it stays a glyph
/// in the navigation bar rather than competing here for the same weight.
struct BudgetDetailsAddLineButton: View {
    let action: () -> Void

    var body: some View {
        Button(action: action) {
            Label(AppLocale.string("Ajouter une prévision"), systemImage: "plus")
        }
        .primaryButtonStyle()
        .accessibilityIdentifier("budgetAddLineButton")
    }
}

#Preview {
    BudgetDetailsAddLineButton(action: {})
        .padding(DesignTokens.Spacing.lg)
        .pulpeBackground()
}

/// Where a vertical bar carries the controls (the iPhone Duo in landscape, or closed), adding a
/// forecast also sits in that bar, under the thumb, the way Mail keeps Compose there. Inert on
/// a horizontal bar, so no other iPhone gains a bottom toolbar.
struct AddLineInVerticalBar: ViewModifier {
    let action: () -> Void

    func body(content: Content) -> some View {
        #if compiler(>=6.4)
        if #available(iOS 27.1, *) {
            content.modifier(VerticalBarAddLine(action: action))
        } else {
            content
        }
        #else
        content
        #endif
    }
}

#if compiler(>=6.4)
@available(iOS 27.1, *)
private struct VerticalBarAddLine: ViewModifier {
    let action: () -> Void
    @Environment(\.toolbarVerticalEdge) private var verticalEdge

    func body(content: Content) -> some View {
        content.toolbar {
            if verticalEdge != nil {
                ToolbarItem(placement: .bottomBar) {
                    Button(AppLocale.string("Ajouter une prévision"), systemImage: "plus", action: action)
                        .accessibilityIdentifier("budgetAddLineBarButton")
                }
            }
        }
    }
}
#endif
