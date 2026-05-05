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

    /// Tracks whether the user has seen the pessimistic check explanation
    @Parameter
    static var pessimisticCheckSeen: Bool = false

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

    // MARK: - Checking Tip

    struct CheckingTip: Tip {
        var title: Text {
            Text("Pointage")
        }

        var message: Text? {
            Text("Quand un mouvement est passé sur ton compte, pointe-le ici pour garder le fil.")
        }

        var image: Image? {
            Image(systemName: "checkmark.circle")
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }
    }

    // MARK: - Pessimistic Check Tip

    struct PessimisticCheckTip: Tip {
        var title: Text {
            Text("Budget protégé")
        }

        var message: Text? {
            Text("Quand tu dépenses moins que prévu, Pulpe garde le montant prévu pour protéger ton budget.")
        }

        var image: Image? {
            Image(systemName: "shield.checkered")
        }

        var rules: [Rule] {
            [
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false },
                #Rule(ProductTips.$pessimisticCheckSeen) { $0 == true }
            ]
        }
    }

    // MARK: - Shared Instances

    static let gestures = GesturesTip()
    static let checking = CheckingTip()
    static let pessimisticCheck = PessimisticCheckTip()

    // MARK: - Reset

    static func resetAllTips() {
        tourDismissed = false
        isSheetPresented = false
        pessimisticCheckSeen = false
        try? Tips.resetDatastore()
    }
}
