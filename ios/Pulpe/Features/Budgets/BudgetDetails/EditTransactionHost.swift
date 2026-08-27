import SwiftUI

/// Hosts an operation's « Modifier » page on its own, for the accueil's one-push route.
/// The page is written against the budget feature's stores, so the host owns a
/// coordinator and a projector exactly like the budget page does, and binds them to the
/// app stores (rule 11): every mutation made here reaches the accueil, the list and the
/// dashboard. The budget opens from the cache the accueil already primed.
///
/// The page is only shown once the budget is present: it auto-pops after
/// `autoPopGraceMs` when its operation is missing, which is also what an empty store
/// looks like during the first load.
/// A tapped row is always in the entry or the entry is absent: the accueil mirrors its
/// own row changes into it (`CurrentMonthStore.applyLocalRowChange`).
struct EditTransactionHost: View {
    let budgetId: String
    let transactionId: String
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) private var tagStore
    @State private var coordinator: BudgetDetailsCoordinator
    @State private var projector: BudgetDetailsProjector

    init(
        budgetId: String,
        transactionId: String,
        budgetService: any BudgetServicing = BudgetService.shared,
        budgetLineService: any BudgetLineServicing = BudgetLineService.shared
    ) {
        self.budgetId = budgetId
        self.transactionId = transactionId
        let initialCoordinator = BudgetDetailsCoordinator(
            budgetId: budgetId,
            budgetService: budgetService,
            budgetLineService: budgetLineService
        )
        self._coordinator = State(initialValue: initialCoordinator)
        self._projector = State(
            initialValue: BudgetDetailsProjector(
                dataStore: initialCoordinator.dataStore,
                filtersStore: initialCoordinator.filtersStore,
                syncStore: initialCoordinator.syncStore
            )
        )
    }

    var body: some View {
        @Bindable var router = router
        let screenState = projector.screenState

        return Group {
            if screenState.isBudgetPresent {
                EditTransactionPage(transactionId: transactionId)
            } else if screenState.errorIsTerminal, let error = projector.terminalError {
                ErrorView(error: error) {
                    await coordinator.dispatch(.loadDetails(force: false))
                }
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .pulpeBackground()
            }
        }
        // The page sets the same title itself; this covers the spinner and the error.
        .localizedNavigationTitle("Modifier")
        .navigationBarTitleDisplayMode(.inline)
        .environment(coordinator)
        .environment(projector)
        .sheet(item: $router.sheet) { destination in
            BudgetDetailSheetContent(destination: destination)
                .environment(coordinator)
        }
        .task(id: budgetId) {
            coordinator.bind(
                budgetListStore: budgetListStore,
                dashboardStore: dashboardStore,
                currentMonthStore: currentMonthStore,
                savingsGoalStore: savingsGoalStore
            )
            await coordinator.dispatch(.loadDetails(force: false))
            // The page's "Objectif" source chip and the tags on the form.
            await savingsGoalStore.loadIfNeeded()
            await tagStore.loadIfNeeded(for: projector.screenState.referencedTagIds)
        }
    }
}
