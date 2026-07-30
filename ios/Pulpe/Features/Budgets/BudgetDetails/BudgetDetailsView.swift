import SwiftUI
import TipKit

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    // Internal so the same-type routing extension can read these dependencies.
    @Environment(BudgetDetailsRouter.self) var router
    @Environment(UserSettingsStore.self) var userSettingsStore
    @Environment(BudgetListStore.self) private var budgetListStore
    @Environment(DashboardStore.self) private var dashboardStore
    @Environment(CurrentMonthStore.self) private var currentMonthStore
    @Environment(SavingsGoalStore.self) private var savingsGoalStore
    @Environment(TagStore.self) var tagStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.tabBarClearance) private var tabBarClearance
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

    var toastContext: ToastContext {
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
        .toolbar {
            ToolbarItem(placement: .topBarTrailing) {
                Button {
                    router.present(.realizedBalance)
                } label: {
                    Image(systemName: "chart.bar.fill")
                }
                .accessibilityLabel("Suivi du budget")
            }
        }
        // Scroll-independent month navigation (system title chevron). The sticky
        // pager only reveals after ~32pt of scroll — a short filtered list (e.g.
        // "À pointer" fully checked) can never produce that, so the title menu is
        // the guaranteed path; the pager stays as the scrolled fast path.
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
                currentMonthStore: currentMonthStore
            )
            // Resolve "Objectif" names for saving rows / the line detail chip.
            await savingsGoalStore.loadIfNeeded()
            await tagStore.loadIfNeeded()
            if !screenState.hasAllBudgets {
                await coordinator.dispatch(.loadDetails(force: false))
            } else {
                await coordinator.dispatch(.reloadCurrentBudget)
            }
        }
        .task(id: screenState.referencedTagIds) { await tagStore.loadIfNeeded(for: screenState.referencedTagIds) }
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
        .alert(
            "Deux prévisions liées",
            isPresented: $syncStore.showSavingsWithdrawalDeleteChoice,
            presenting: syncStore.budgetLineToDeleteWithdrawal
        ) { line in
            Button(savingsWithdrawalKeepIncomeLabel(for: line)) {
                dispatchDeleteSavingsWithdrawal(line, scope: .repayment)
            }
            Button("Tout annuler", role: .destructive) {
                dispatchDeleteSavingsWithdrawal(line, scope: .pair)
            }
            Button("Annuler", role: .cancel) {
                coordinator.syncStore.resetSavingsWithdrawalDeleteChoice()
            }
        } message: { line in
            Text(savingsWithdrawalDeleteMessage(for: line))
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
                    of: { $0.frame(in: .scrollView).minY },
                    action: { newMinY in scrollTracker.update(heroMinY: newMinY) }
                )

                TipView(ProductTips.pessimisticCheck)
                    .padding(.horizontal, DesignTokens.Spacing.lg)
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
                        goalNamesById: savingsGoalNamesById,
                        tagNamesById: tagStore.namesById,
                        savingsWithdrawalOriginMonthName: savingsWithdrawalOriginMonthName,
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
        // Reset the keyboard safe-area inset for this whole subtree — both
        // overlays (sticky pager + FAB) inherit the reset. This screen has no
        // bottom text input (the only field is the `.searchable` bar, which
        // lives in the top nav-bar drawer), so ignoring the bottom keyboard
        // inset hides nothing. Without this, a stale ~keyboard-height bottom
        // inset inherited from a pushed, auto-focused child (EditTransactionPage)
        // strands on pop — phantom over-scroll + FAB floating mid-page. Mirrors
        // the existing guards on the tab bar (MainTabView) and sticky CTA
        // (pulpeStickyBottomCTA). Must stay LAST so both overlays inherit it; if
        // a bottom text field is ever added here, remove or scope this.
        .ignoresSafeArea(.keyboard, edges: .bottom)
    }
}
