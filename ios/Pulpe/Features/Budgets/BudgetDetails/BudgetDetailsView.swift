import SwiftUI
import TipKit

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    @Environment(BudgetDetailsRouter.self) private var router
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.tabBarClearance) private var tabBarClearance
    @State private var coordinator: BudgetDetailsCoordinator
    @State private var projector: BudgetDetailsProjector

    @State private var searchText = ""
    @State private var scrollTracker = BudgetDetailsScrollTracker()

    init(budgetId: String) {
        self.budgetId = budgetId
        let initialCoordinator = BudgetDetailsCoordinator(budgetId: budgetId)
        self._coordinator = State(initialValue: initialCoordinator)
        self._projector = State(
            initialValue: BudgetDetailsProjector(
                dataStore: initialCoordinator.dataStore,
                filtersStore: initialCoordinator.filtersStore,
                syncStore: initialCoordinator.syncStore
            )
        )
    }

    /// Pay-day-aware elapsed percentage. Computed in the view (not the
    /// projector) so the projection layer stays independent of
    /// `UserSettingsStore` — its only consumer is the hero.
    private var timeElapsedPercentage: Double {
        guard let month = projector.screenState.hero.month,
              let year = projector.screenState.hero.year else { return 0 }
        return BudgetPeriodCalculator.timeElapsedPercentage(
            month: month,
            year: year,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    private var checkedFilterBinding: Binding<CheckedFilterOption> {
        let coord = coordinator
        return Binding(
            get: { coord.filtersStore.checkedFilter },
            set: { newValue in Task { await coord.dispatch(.setCheckedFilter(newValue)) } }
        )
    }

    private var typeFilterBinding: Binding<BudgetLineKindFilter> {
        let coord = coordinator
        return Binding(
            get: { coord.filtersStore.typeFilter },
            set: { newValue in Task { await coord.dispatch(.setTypeFilter(newValue)) } }
        )
    }

    private var toastContext: ToastContext {
        ToastContext(
            toastManager: appState.toastManager,
            presentationCurrency: userSettingsStore.currency
        )
    }

    var body: some View {
        @Bindable var router = router
        @Bindable var syncStore = coordinator.syncStore
        let screenState = projector.screenState

        return Group {
            if screenState.isLoading && !screenState.isBudgetPresent {
                BudgetDetailsSkeletonView()
                    .transition(.opacity)
            } else if screenState.errorIsTerminal, let error = projector.terminalError {
                ErrorView(error: error) {
                    await coordinator.dispatch(.loadDetails(force: false))
                }
                .transition(.opacity)
            } else if screenState.isBudgetPresent {
                content
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetDetails")
        .animation(DesignTokens.Animation.smoothEaseOut, value: screenState.isLoading)
        .navigationTitle(screenState.monthYear.isEmpty ? "Budget" : screenState.monthYear)
        .navigationBarTitleDisplayMode(.inline)
        .toolbarBackground(Color.appBackground, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .task(id: screenState.budgetId) {
            if !screenState.hasAllBudgets {
                await coordinator.dispatch(.loadDetails(force: false))
            } else {
                await coordinator.dispatch(.reloadCurrentBudget)
            }
        }
        .onChange(of: searchText) { _, newValue in
            projector.setSearchText(newValue)
        }
        .sheet(item: $router.sheet) { dest in
            sheetContent(for: dest)
        }
        .navigationDestination(for: BudgetLinePushRoute.self) { route in
            pushDestination(for: route)
                .environment(coordinator)
                .environment(projector)
        }
        .alert(
            "Pointer les transactions ?",
            isPresented: $syncStore.showCheckAllTransactionsAlert,
            presenting: coordinator.syncStore.budgetLineToCheckAll
        ) { line in
            Button("Non, juste la prévision", role: .cancel) {
                Task {
                    await coordinator.dispatch(
                        .confirmCheckAll(line: line, checkAll: false, toastContext, amountsHidden: amountsHidden)
                    )
                }
            }
            Button("Oui, tout pointer") {
                Task {
                    await coordinator.dispatch(
                        .confirmCheckAll(line: line, checkAll: true, toastContext, amountsHidden: amountsHidden)
                    )
                }
            }
        } message: { _ in
            Text("Des transactions non pointées sont liées à cette prévision.")
        }
    }

    private var content: some View {
        let screenState = projector.screenState
        let sections = screenState.sections
        let free = screenState.free

        return ScrollView {
            LazyVStack(spacing: 0) {
                BudgetDetailHero(
                    metrics: screenState.hero.metrics,
                    timeElapsedPercentage: timeElapsedPercentage,
                    onTapChart: { router.present(.realizedBalance) },
                    rolloverAmount: screenState.rollover?.amount,
                    previousBudgetMonth: screenState.rollover?.previousBudgetMonth,
                    onRolloverTap: screenState.rollover?.previousBudgetId.map { id in
                        { router.present(.previousBudget(PreviousBudgetItem(id: id))) }
                    }
                )
                .onGeometryChange(
                    for: CGFloat.self,
                    of: { $0.frame(in: .scrollView).minY },
                    action: { newMinY in scrollTracker.update(heroMinY: newMinY) }
                )

                TipView(ProductTips.pessimisticCheck)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.sm)

                BudgetTypeFilter(
                    kind: typeFilterBinding,
                    checked: checkedFilterBinding,
                    counts: screenState.kindCounts,
                    checkedCounts: screenState.checkedCounts
                )
                .popoverTip(ProductTips.checking)

                if !searchText.isEmpty && sections.isEmpty && free.isEmpty {
                    ContentUnavailableView("Aucune prévision trouvée", systemImage: "magnifyingglass")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.xxl)
                }

                if screenState.canShowEmptyChecked {
                    ContentUnavailableView {
                        Label("Tout est pointé", systemImage: "checkmark.circle.fill")
                    } description: {
                        Text("Bien joué ! Passe sur « Tout voir » pour revoir tes prévisions.")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignTokens.Spacing.xxl)
                }

                ForEach(sections) { section in
                    BudgetMixedSection(
                        kind: section.kind,
                        items: section.items,
                        currency: userSettingsStore.currency,
                        onTap: { line in
                            router.push(.lineDetail(lineId: line.id))
                        },
                        onTogglePointed: { line in
                            Task {
                                await coordinator.dispatch(
                                    .toggleLine(line, toastContext, amountsHidden: amountsHidden)
                                )
                            }
                        },
                        tip: section.kind == screenState.firstSectionKind ? ProductTips.gestures : nil
                    )
                }

                if !free.isEmpty {
                    BudgetDetailsFreeTransactionsList(
                        items: free,
                        currency: userSettingsStore.currency,
                        onTap: { transaction in
                            router.push(.editTx(transactionId: transaction.id))
                        }
                    )
                }

                Color.clear.frame(height: tabBarClearance + DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await coordinator.dispatch(.loadDetails(force: true))
        }
        .overlay(alignment: .top) {
            BudgetDetailsStickyPagerLayer(
                months: coordinator.dataStore.pagerMonths,
                currentBudgetId: coordinator.dataStore.budgetId,
                onSelect: { id in
                    guard id != coordinator.dataStore.budgetId else { return }
                    Task { await coordinator.dispatch(.prepareNavigation(to: id)) }
                },
                tracker: scrollTracker
            )
        }
        .overlay(alignment: .bottomTrailing) {
            BudgetDetailsAddFAB { router.present(.addBudgetLine) }
        }
        .animation(
            reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
            value: screenState.checkedTickHash
        )
        .pulpeBackground()
        .searchable(
            text: $searchText,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "Rechercher..."
        )
        .searchPresentationToolbarBehavior(.avoidHidingContent)
    }

    // MARK: - Routing

    @ViewBuilder
    private func pushDestination(for route: BudgetLinePushRoute) -> some View {
        switch route {
        case .lineDetail(let lineId):
            BudgetLineDetailPage(
                lineId: lineId,
                onEditLine: { line in router.present(.editBudgetLine(line)) }
            )
        case .addAllocatedTx(let lineId):
            AddAllocatedTransactionPage(lineId: lineId)
        case .editTx(let transactionId):
            EditTransactionPage(transactionId: transactionId)
        }
    }

    @ViewBuilder
    private func sheetContent(for destination: BudgetDetailDestination) -> some View {
        switch destination {
        case .addBudgetLine:
            AddBudgetLineSheet(budgetId: coordinator.dataStore.budgetId) { budgetLine in
                Task { await coordinator.dispatch(.addBudgetLine(budgetLine)) }
            }
        case .editBudgetLine(let line):
            EditBudgetLineSheet(budgetLine: line, userCurrency: userSettingsStore.currency) { updatedLine in
                Task { await coordinator.dispatch(.updateBudgetLine(updatedLine)) }
            }
        case .previousBudget(let item):
            PreviousBudgetSheet(budgetId: item.id)
        case .realizedBalance:
            RealizedBalanceSheet(
                metrics: coordinator.dataStore.metrics,
                realizedMetrics: coordinator.dataStore.realizedMetrics
            )
        }
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
    .environment(AppState())
    .environment(BudgetDetailsRouter())
    .environment(UserSettingsStore())
}
#Preview("Gestures Tip") {
    List {
        Section("Dépenses") {
            TipView(ProductTips.gestures)
            Text("Courses alimentaires")
        }
    }
    .listStyle(.insetGrouped)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
    .task { try? Tips.resetDatastore() }
}
