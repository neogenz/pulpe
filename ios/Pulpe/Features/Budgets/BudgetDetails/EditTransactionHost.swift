import SwiftUI

/// Hosts an operation's « Modifier » sheet on its own, for the accueil. The sheet is written
/// against the budget feature's stores, so the host owns a coordinator and a projector exactly
/// like the budget page does, and binds them to the app stores (rule 11): every mutation made
/// here reaches the accueil, the list and the dashboard. The budget opens from the cache the
/// accueil already primed.
///
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
            switch screenState.content {
            case .loaded:
                BudgetMovementSheet(transactionId: transactionId)
            case .failed: // the projector sets terminalError in the same pass; the fallback never renders
                ErrorView(error: projector.terminalError ?? APIError.invalidResponse) {
                    await coordinator.dispatch(.loadDetails(force: false))
                }
            case .loading:
                ProgressView()
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
                    .background(Color.sheetBackground)
            }
        }
        .environment(coordinator)
        .environment(projector)
        // « Lisser » closes this sheet: presenting the spread sheet inside it would lose the
        // destination with the dismissal, so the budget page the tab opens next shows it.
        .sheet(item: Binding(
            get: { if case .spreadExisting = router.sheet { nil } else { router.sheet } },
            set: { router.sheet = $0 }
        )) { destination in
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
            // The goal behind an income's origin and the tags on the form.
            await savingsGoalStore.loadIfNeeded()
            await tagStore.loadIfNeeded(for: projector.screenState.referencedTagIds)
        }
    }
}
