import SwiftUI
import TipKit

/// Product tips for first-time user onboarding
/// Uses @Parameter + actions pattern for iOS 17 sequential display
enum ProductTips {

    // MARK: - Global Tour State

    /// When true, all onboarding tips are permanently hidden
    @Parameter
    static var tourDismissed: Bool = false

    /// When true, tips are hidden (sheet/dialog is presented)
    @Parameter
    static var isSheetPresented: Bool = false

    /// Dismisses the entire onboarding tour permanently
    static func dismissEntireTour() {
        tourDismissed = true
        ProgressBarTip.isActive = false
        AddTransactionTip.isActive = false
        NavigationTip.isActive = false
    }

    // MARK: - Progress Bar Tip (Step 1/3)

    struct ProgressBarTip: Tip {
        @Parameter
        static var isActive: Bool = true

        var title: Text {
            Text("Où tu en es")
        }

        var message: Text? {
            Text("D'un coup d'œil, tu sais combien il te reste ce mois-ci. Pas de surprise à la fin du mois.")
        }

        var image: Image? {
            Image(systemName: "chart.bar.fill")
        }

        var rules: [Rule] {
            [
                #Rule(Self.$isActive) { $0 == true },
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }

        var actions: [Action] {
            [
                Action(id: "next", title: "Suivant") {
                    ProgressBarTip.isActive = false
                    AddTransactionTip.isActive = true
                }
            ]
        }
    }

    // MARK: - Add Transaction Tip (Step 2/3)

    struct AddTransactionTip: Tip {
        @Parameter
        static var isActive: Bool = false

        var title: Text {
            Text("Note tes dépenses")
        }

        var message: Text? {
            Text("Chaque achat noté, c'est plus de contrôle sur ton budget. Ça prend 5 secondes.")
        }

        var image: Image? {
            Image(systemName: "plus.circle.fill")
        }

        var rules: [Rule] {
            [
                #Rule(Self.$isActive) { $0 == true },
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }

        var actions: [Action] {
            [
                Action(id: "prev", title: "Précédent") {
                    AddTransactionTip.isActive = false
                    ProgressBarTip.isActive = true
                },
                Action(id: "next", title: "Suivant") {
                    AddTransactionTip.isActive = false
                    NavigationTip.isActive = true
                }
            ]
        }
    }

    // MARK: - Navigation Tip (Step 3/3)

    struct NavigationTip: Tip {
        @Parameter
        static var isActive: Bool = false

        var title: Text {
            Text("Trois espaces, un objectif")
        }

        var message: Text? {
            Text("Tu retrouves tout en bas : ce mois-ci, tes budgets et tes modèles. Navigue selon tes besoins.")
        }

        var image: Image? {
            Image(systemName: "rectangle.3.group.fill")
        }

        var rules: [Rule] {
            [
                #Rule(Self.$isActive) { $0 == true },
                #Rule(ProductTips.$tourDismissed) { $0 == false },
                #Rule(ProductTips.$isSheetPresented) { $0 == false }
            ]
        }

        var actions: [Action] {
            [
                Action(id: "prev", title: "Précédent") {
                    NavigationTip.isActive = false
                    AddTransactionTip.isActive = true
                },
                Action(id: "done", title: "Terminer") {
                    NavigationTip.isActive = false
                }
            ]
        }
    }

    // MARK: - Gesture Tips (Budget Details)
    // Independent from main onboarding - shows only when onboarding is complete

    struct GesturesTip: Tip {
        var title: Text {
            Text("Gère tes prévisions")
        }

        var message: Text? {
            Text("Tes prévisions sont interactives. Explore-les du bout du doigt.")
        }

        var image: Image? {
            Image(systemName: "hand.tap.fill")
        }

        var rules: [Rule] {
            [
                // Don't show while onboarding is in progress (independent of tour dismissal per SC5)
                #Rule(ProgressBarTip.$isActive) { $0 == false },
                #Rule(AddTransactionTip.$isActive) { $0 == false },
                #Rule(NavigationTip.$isActive) { $0 == false }
            ]
        }
    }

    // MARK: - Shared Instances

    static let progressBar = ProgressBarTip()
    static let addTransaction = AddTransactionTip()
    static let navigation = NavigationTip()
    static let gestures = GesturesTip()

    // MARK: - Reset

    static func resetAllTips() {
        // Reset global tour state
        tourDismissed = false
        isSheetPresented = false

        // Reset parameters to initial state
        ProgressBarTip.isActive = true
        AddTransactionTip.isActive = false
        NavigationTip.isActive = false

        // Reset TipKit datastore
        try? Tips.resetDatastore()
    }
}
