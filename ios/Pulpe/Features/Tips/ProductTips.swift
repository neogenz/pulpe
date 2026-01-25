import SwiftUI
import TipKit

/// Product tips for contextual user education
/// Uses @Parameter pattern for state management
enum ProductTips {

    // MARK: - Global State

    /// When true, all tips are permanently hidden
    @Parameter
    static var tourDismissed: Bool = false

    /// When true, tips are hidden (sheet/dialog is presented)
    @Parameter
    static var isSheetPresented: Bool = false

    // MARK: - Gestures Tip

    struct GesturesTip: Tip {
        var title: Text {
            Text("Interagis avec tes lignes")
        }

        var message: Text? {
            Text("Touche pour modifier · Glisse pour compléter ou supprimer · Reste appuyé pour voir le détail")
        }

        var image: Image? {
            Image(systemName: "hand.tap.fill")
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }
    }

    // MARK: - Shared Instance

    static let gestures = GesturesTip()

    // MARK: - Reset

    static func resetAllTips() {
        tourDismissed = false
        isSheetPresented = false
        try? Tips.resetDatastore()
    }
}
