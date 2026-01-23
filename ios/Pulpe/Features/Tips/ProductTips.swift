import SwiftUI
import TipKit

/// Product tips for first-time user onboarding
/// Aligned with Angular app's product tour content
enum ProductTips {

    // MARK: - Progress Bar Tip

    struct ProgressBarTip: Tip {
        var title: Text {
            Text("Où tu en es")
        }

        var message: Text? {
            Text("D'un coup d'œil, tu sais combien il te reste ce mois-ci. Pas de surprise à la fin du mois.")
        }

        var image: Image? {
            Image(systemName: "chart.bar.fill")
        }
    }

    // MARK: - Add Transaction Tip

    struct AddTransactionTip: Tip {
        var title: Text {
            Text("Note tes dépenses")
        }

        var message: Text? {
            Text("Chaque achat noté, c'est plus de contrôle sur ton budget. Ça prend 5 secondes.")
        }

        var image: Image? {
            Image(systemName: "plus.circle.fill")
        }
    }

    // MARK: - Navigation Tip

    struct NavigationTip: Tip {
        var title: Text {
            Text("Trois espaces, un objectif")
        }

        var message: Text? {
            Text("Ce mois-ci pour suivre, Budgets pour planifier, Modèles pour ta base mensuelle.")
        }

        var image: Image? {
            Image(systemName: "rectangle.3.group.fill")
        }
    }

    // MARK: - Shared Instances

    static let progressBar = ProgressBarTip()
    static let addTransaction = AddTransactionTip()
    static let navigation = NavigationTip()

    // MARK: - Reset

    static func resetAllTips() {
        try? Tips.resetDatastore()
    }
}
