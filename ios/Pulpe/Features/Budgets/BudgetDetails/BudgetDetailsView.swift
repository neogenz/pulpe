import SwiftUI

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
        // Kept for the back button of pushed pages; the page states the month in its header.
        .navigationTitle(screenState.monthYear.isEmpty ? "Budget" : screenState.monthYear)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
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
        .sheet(item: $router.sheet) { destination in
            BudgetDetailSheetContent(destination: destination)
                .environment(coordinator)
        }
        .navigationDestination(for: BudgetLinePushRoute.self) { route in
            pushDestination(for: route)
                .environment(coordinator)
                .environment(projector)
        }
        .modifier(CheckAllConfirmation(
            coordinator: coordinator,
            transactionsByLineId: screenState.transactionsByLineId,
            currency: userSettingsStore.currency,
            amountsHidden: amountsHidden,
            toastContext: toastContext
        ))
        .modifier(PlannedWithdrawalUndoAlert(
            syncStore: syncStore, currency: userSettingsStore.currency, amountsHidden: amountsHidden
        ) { tx in
            Task { await coordinator.dispatch(.softDeleteTransaction(tx, toastContext)) }
        })
        .modifier(DeleteMonthMenu(
            coordinator: coordinator,
            screenState: screenState,
            toastContext: toastContext,
            monthSelection: monthSelection,
            typeFilter: typeFilterBinding
        ))
        .modifier(BudgetSidebarSelectionSync(budgetId: budgetId, coordinator: coordinator))
    }

    /// The report as a row of Revenus, under "Tout" only: it is never a thing to point.
    private var sectionRollover: SectionRollover? {
        let screenState = projector.screenState
        guard screenState.checkedFilter == .all,
              let rollover = screenState.rollover, rollover.amount.rounded(2) != 0,
              let month = screenState.hero.month else { return nil }
        return SectionRollover(
            previousMonth: month == 1 ? 12 : month - 1,
            amount: rollover.amount,
            onTap: rollover.previousBudgetId.map { id in
                { router.present(.previousBudget(PreviousBudgetItem(id: id))) }
            },
            subtitle: upcomingReportSubtitle
        )
    }

    private var content: some View {
        let screenState = projector.screenState
        let rollover = sectionRollover
        let upcomingReportMonth = upcomingReportMonth

        return ScrollView {
            LazyVStack(alignment: .leading, spacing: 0) {
                PageHeader(title: pageTitle, subtitle: periodSubtitle)
                    .padding(.top, DesignTokens.Spacing.sm)

                if upcomingReportMonth != nil {
                    InfoBanner(.neutral, systemImage: "calendar", text: AppLocale.string("""
                        Ce mois n'a pas commencé. Ses prévisions viennent de ton modèle : \
                        ajuste-les dès maintenant si tu sais déjà ce qui change.
                        """))
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.lg)
                }

                BudgetDetailHero(
                    metrics: screenState.hero.metrics,
                    rolloverAmount: screenState.rollover?.amount,
                    onRolloverTap: screenState.rollover?.previousBudgetId.map { id in
                        { router.present(.previousBudget(PreviousBudgetItem(id: id))) }
                    },
                    onTapCalculation: { router.present(.realizedBalance) },
                    projectedReportMonth: upcomingReportMonth
                )
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)

                if let prefill = tightMonthCardPrefill {
                    tightMonthCard(prefill: prefill)
                        .padding(.top, DesignTokens.Spacing.lg)
                }

                if upcomingReportMonth == nil {
                    BudgetTypeFilter(checked: checkedFilterBinding, counts: screenState.checkedCounts)
                        .padding(.top, DesignTokens.Spacing.xl)
                }

                if screenState.checkedFilter == .over, screenState.checkedCounts.over > 0 {
                    Button("Rattraper le dépassement") { router.present(.catchUp(focusLineId: nil)) }
                        .secondaryButtonStyle(size: .small)
                        .padding(.horizontal, DesignTokens.Spacing.lg)
                        .padding(.top, DesignTokens.Spacing.md)
                        .accessibilityIdentifier("budgetCatchUpButton")
                }

                if screenState.canShowEmptyChecked {
                    ContentUnavailableView {
                        Label("Tout est pointé", systemImage: "checkmark.circle.fill")
                    } description: {
                        Text("Bien joué ! Passe sur « Tout » pour revoir tes prévisions.")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignTokens.Spacing.xxl)
                }

                ForEach(screenState.sections) { section in
                    BudgetMixedSection(
                        kind: section.kind,
                        items: section.items,
                        total: section.total + (section.kind == .income ? rollover?.amount ?? 0 : 0),
                        rollover: section.kind == .income ? rollover : nil,
                        // The page « + » notes a movement; these footers add a prévision.
                        onAdd: { router.present(.addBudgetLine(section.kind)) },
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

                // No section left to carry a footer (empty month, every kind filtered out).
                if screenState.sections.isEmpty, !screenState.canShowEmptyChecked {
                    SectionAddRow(title: AppLocale.string("Ajouter une prévision")) {
                        router.present(.addBudgetLine(.expense))
                    }
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .pulpeSurfaceCard()
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.top, DesignTokens.Spacing.xl)
                }

                movementLists

                Color.clear.frame(height: DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await coordinator.dispatch(.loadDetails(force: true))
        }
        .animation(
            reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut,
            value: screenState.checkedTickHash
        )
        .animation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseOut, value: screenState.checkedFilter)
        .onChange(of: upcomingReportMonth != nil, initial: true) { _, hidden in
            Task { await coordinator.dispatch(.setFilterRailHidden(hidden)) }
        }
        .pulpeRootBottomInset()
        .background { Color.appBackground.ignoresSafeArea() }
        // The month's own « + »: the tab's one writes into the current month and hides here.
        // The page's bottom safe area already ends at the tab bar (or the home indicator
        // beside a side rail), so only the gap is added.
        .overlay(alignment: .bottomTrailing) {
            FloatingAddButton { router.present(.movement(lineId: nil, transactionId: nil)) }
                .padding(.trailing, DesignTokens.Control.fabTrailingInset)
                .padding(.bottom, DesignTokens.Control.fabTabBarGap)
        }
    }
}
