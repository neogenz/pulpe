import SwiftUI
import TipKit

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) var appState
    // Internal so the same-type routing extension can read these dependencies.
    @Environment(BudgetDetailsRouter.self) var router
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) var tagStore
    // Internal so the routing extension can read it when it dispatches a toggle.
    @Environment(\.amountsHidden) var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State var coordinator: BudgetDetailsCoordinator
    // Internal so the savings-withdrawal extension can read its screen state.
    @State var projector: BudgetDetailsProjector
    @State private var searchText = ""
    @State private var scrollTracker = BudgetDetailsScrollTracker()
    /// Budget ids for which the "mois un peu juste" card was dismissed via
    /// "Plus tard" (PUL-292), comma-joined. Non-private for the card extension.
    @AppStorage(SavingsWithdrawalCardGate.storageKey) var dismissedWithdrawalBudgetIds = ""
    init(
        budgetId: String,
        budgetService: any BudgetServicing = BudgetService.shared,
        budgetLineService: any BudgetLineServicing = BudgetLineService.shared
    ) {
        self.budgetId = budgetId
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

    /// Savings goal names keyed by goal id (PUL-12). Read from the app-level
    /// `SavingsGoalStore` directly, keeping the projection layer independent of the
    /// goals cache. Re-evaluates via Observation when goals load, surfacing the
    /// "Objectif" chip on the saving rows once resolved.
    private var savingsGoalNamesById: [String: String] {
        var names: [String: String] = [:]
        for goal in savingsGoalStore.goals {
            names[goal.id] = goal.name
        }
        return names
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

    var body: some View {
        @Bindable var router = router
        @Bindable var syncStore = coordinator.syncStore
        let screenState = projector.screenState

        return Group {
            switch screenState.content {
            case .loaded:
                content
                    .transition(.opacity)
            case .failed: // the projector sets terminalError in the same pass; the fallback never renders
                ErrorView(error: projector.terminalError ?? APIError.invalidResponse) {
                    await coordinator.dispatch(.loadDetails(force: false))
                }
                .transition(.opacity)
            case .loading:
                BudgetDetailsSkeletonView()
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetDetails")
        .animation(DesignTokens.Animation.smoothEaseOut, value: screenState.content)
        .navigationTitle(screenState.monthYear.isEmpty ? "Budget" : screenState.monthYear)
        .navigationBarTitleDisplayMode(.inline)
        // Hero under the nav bar on the forest surface: light ink when loaded, default ink on error / skeleton.
        .toolbarColorScheme(screenState.content == .loaded ? .dark : nil, for: .navigationBar)
        .heroNavigationBar()
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                // Reads the month back rather than adding to it, so it stays a glyph in the
                // bar: the content zone spends its one filled shape on the action that
                // changes something. Bare, so iOS 26 dresses it in its own Liquid Glass —
                // the hero's tinted disc was our shape where the system already has one.
                Button { router.present(.realizedBalance) } label: {
                    Image(systemName: "chart.bar")
                }
                .accessibilityLabel("Suivi du budget")
                .accessibilityIdentifier("budgetTrackingButton")
            }
        }
        // Scroll-independent month navigation (system title chevron). The sticky
        // pager only reveals once the hero has scrolled under the bar — a short
        // filtered list (e.g. "À pointer" fully checked) can never produce that, so
        // the title menu is the guaranteed path; the pager stays as the scrolled fast path.
        .toolbarTitleMenu {
            // Newest first: a title menu is a quick-jump list and the recent
            // months are the target in practice — chronological order would bury
            // the current month under years of history (the pager keeps its
            // ascending rail; different affordance, different reading order).
            Picker("Mois", selection: monthSelection) {
                ForEach(coordinator.dataStore.pagerMonths.reversed(), id: \.id) { sparse in
                    Text(Self.monthMenuLabel(for: sparse)).tag(sparse.id)
                }
            }
        }
        .task(id: screenState.budgetId) {
            coordinator.bind(
                budgetListStore: budgetListStore,
                dashboardStore: dashboardStore,
                currentMonthStore: currentMonthStore,
                savingsGoalStore: savingsGoalStore
            )
            // The budget first: until its load is dispatched the screen has neither a
            // skeleton nor content, and the two lookups below cost a round trip each.
            if !screenState.hasAllBudgets {
                await coordinator.dispatch(.loadDetails(force: false))
            } else {
                await coordinator.dispatch(.reloadCurrentBudget)
            }
            // Resolve "Objectif" names for saving rows / the line detail chip.
            await savingsGoalStore.loadIfNeeded()
            await tagStore.loadIfNeeded()
        }
        .task(id: screenState.referencedTagIds) { await tagStore.loadIfNeeded(for: screenState.referencedTagIds) }
        .onChange(of: searchText) { _, newValue in projector.setSearchText(newValue) }
        .sheet(item: $router.sheet) { destination in
            BudgetDetailSheetContent(destination: destination)
                .environment(coordinator)
        }
        .navigationDestination(for: BudgetLinePushRoute.self) { route in
            pushDestination(for: route)
                .environment(coordinator)
                .environment(projector)
        }
        .alert(
            "Pointer aussi les mouvements ?",
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
            Text("Cette prévision a des mouvements encore à pointer.")
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
                    rolloverAmount: screenState.rollover?.amount,
                    previousBudgetMonth: screenState.rollover?.previousBudgetMonth,
                    onRolloverTap: screenState.rollover?.previousBudgetId.map { id in
                        { router.present(.previousBudget(PreviousBudgetItem(id: id))) }
                    }
                )
                .onGeometryChange(
                    for: CGFloat.self,
                    of: { $0.frame(in: .global).maxY },
                    action: { maxY in scrollTracker.update(heroMaxY: maxY) }
                )
                .heroZone()

                VStack(spacing: 0) {
                    // Above the tip and the rail: adding a forecast is what this screen is
                    // for, and a reader who has to scroll past a filter to find it reads it
                    // as belonging to the list rather than to the budget.
                    BudgetDetailsAddLineButton { router.present(.addBudgetLine) }
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
                    .padding(.bottom, DesignTokens.Spacing.md)

                    TipView(ProductTips.pessimisticCheck)
                        .pulpeTipBackground()
                        .padding(.horizontal, DesignTokens.Spacing.xxl)
                        .padding(.bottom, DesignTokens.Spacing.sm)

                    if let prefill = tightMonthCardPrefill {
                        tightMonthCard(prefill: prefill)
                    }

                    BudgetTypeFilter(
                        kind: typeFilterBinding,
                        checked: checkedFilterBinding,
                        counts: screenState.kindCounts,
                        checkedCounts: screenState.checkedCounts
                    )
                    // The rail sits inside the zone's top curve: a chip scrolled to the edge
                    // is cut along that same curve rather than drawn over the hero.
                    .padding(.top, DesignTokens.Spacing.lg)
                    .clipShape(
                        UnevenRoundedRectangle(
                            topLeadingRadius: DesignTokens.CornerRadius.zone,
                            topTrailingRadius: DesignTokens.CornerRadius.zone,
                            style: .continuous
                        )
                    )
                    .padding(.top, -DesignTokens.Spacing.lg)

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
                            goalNamesById: savingsGoalNamesById,
                            tagNamesById: tagStore.namesById,
                            savingsWithdrawalOriginMonthName: savingsWithdrawalOriginMonthName,
                            checkingTipLineId: screenState.checkingTipLineId,
                            onPrepareTogglePointed: coordinator.prepareToggleBudgetLine,
                            onTap: { line in
                                router.push(.lineDetail(lineId: line.id))
                            },
                            onTogglePointed: { line in handlePointGesture(on: line) }
                        )
                    }

                    if !free.isEmpty {
                        BudgetDetailsFreeTransactionsList(
                            items: free,
                            currency: userSettingsStore.currency,
                            tagNamesById: tagStore.namesById,
                            onTap: { transaction in
                                router.push(.editTx(transactionId: transaction.id))
                            },
                            onTogglePointed: { transaction in
                                Task {
                                    await coordinator.dispatch(.toggleTransaction(transaction))
                                }
                            }
                        )
                    }

                    Color.clear.frame(height: DesignTokens.Spacing.lg)
                }
                .padding(.top, DesignTokens.Spacing.xxl)
                .contentZone()
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
        .animation(
            reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut,
            value: screenState.checkedTickHash
        )
        .background { Color.appBackground.ignoresSafeArea() }
        .searchable(
            text: $searchText,
            placement: .navigationBarDrawer(displayMode: .automatic),
            prompt: "Rechercher..."
        )
        .searchPresentationToolbarBehavior(.avoidHidingContent)
        // The only field lives in the top search drawer, so resetting the bottom
        // keyboard inset hides nothing. It prevents a stale inset inherited from
        // EditTransactionPage from creating phantom over-scroll after pop.
        // Keep LAST so the sticky pager inherits it; if
        // a bottom text field is ever added here, remove or scope this.
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}
