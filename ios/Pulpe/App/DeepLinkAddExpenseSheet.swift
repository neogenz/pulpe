import SwiftUI

/// The widget's "add an expense" deep link: the same movement sheet as the floating button, over
/// the month the accueil already loaded.
struct DeepLinkAddExpenseSheet: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @State private var viewModel = DeepLinkAddExpenseViewModel()

    var body: some View {
        Group {
            if let budgetId = viewModel.currentBudgetId {
                MovementSheet(
                    context: MovementSheetContext(store: currentMonthStore, budgetId: budgetId, source: .widget),
                    userCurrency: userSettingsStore.currency,
                    onAdd: { transaction in
                        currentMonthStore.addTransaction(transaction)
                        dismiss()
                    }
                )
            } else {
                NavigationStack {
                    Group {
                        if viewModel.isLoading {
                            LoadingView(message: AppLocale.string("Chargement..."))
                        } else if let error = viewModel.error {
                            ContentUnavailableView {
                                Label("Erreur de connexion", systemImage: "wifi.exclamationmark")
                            } description: {
                                Text(DomainErrorLocalizer.localize(error))
                            } actions: {
                                Button("Réessayer") {
                                    Task {
                                        await viewModel.loadCurrentBudget(
                                            payDayOfMonth: userSettingsStore.payDayOfMonth
                                        )
                                    }
                                }
                                .buttonStyle(.bordered)
                            }
                        } else {
                            ContentUnavailableView(
                                "Pas encore de budget",
                                systemImage: "calendar.badge.exclamationmark",
                                description: Text("Crée d'abord un budget pour ce mois")
                            )
                        }
                    }
                    .toolbar {
                        ToolbarItem(placement: .cancellationAction) {
                            SheetCloseButton()
                        }
                    }
                }
            }
        }
        .task {
            await viewModel.loadCurrentBudget(payDayOfMonth: userSettingsStore.payDayOfMonth)
            await currentMonthStore.loadDetailsIfNeeded()
        }
    }
}

@Observable @MainActor
final class DeepLinkAddExpenseViewModel {
    private(set) var currentBudgetId: String?
    private(set) var isLoading = true
    private(set) var error: Error?

    func loadCurrentBudget(payDayOfMonth: Int? = nil) async {
        isLoading = true
        defer { isLoading = false }
        error = nil
        do {
            let budget = try await BudgetService.shared.getCurrentMonthBudget(payDayOfMonth: payDayOfMonth)
            currentBudgetId = budget?.id
        } catch {
            self.error = error
            currentBudgetId = nil
        }
    }
}
