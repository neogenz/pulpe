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
    @State private var viewModel: BudgetDetailsViewModel

    @State private var searchText = ""
    @State private var scrollTracker = BudgetDetailsScrollTracker()

    init(budgetId: String) {
        self.budgetId = budgetId
        self._viewModel = State(initialValue: BudgetDetailsViewModel(budgetId: budgetId))
    }

    private var timeElapsedPercentage: Double {
        guard let budget = viewModel.budget else { return 0 }
        return BudgetPeriodCalculator.timeElapsedPercentage(
            month: budget.month,
            year: budget.year,
            payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }

    private var checkedFilterBinding: Binding<CheckedFilterOption> {
        let vm = viewModel
        return Binding(
            get: { vm.checkedFilter },
            set: { vm.setCheckedFilter($0) }
        )
    }

    private var typeFilterBinding: Binding<BudgetLineKindFilter> {
        let vm = viewModel
        return Binding(
            get: { vm.typeFilter },
            set: { vm.setTypeFilter($0) }
        )
    }

    var body: some View {
        // Bindable shadow so `$router.sheet` resolves to a Binding for the
        // sheet(item:) modifier below. Standard iOS 17+ idiom for
        // environment-injected `@Observable` types that need binding.
        @Bindable var router = router

        return Group {
            if viewModel.isLoading && viewModel.budget == nil {
                BudgetDetailsSkeletonView()
                    .transition(.opacity)
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
                .transition(.opacity)
            } else if viewModel.budget != nil {
                content
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetDetails")
        .animation(DesignTokens.Animation.smoothEaseOut, value: viewModel.isLoading)
        .navigationTitle(viewModel.budget?.monthYear ?? "Budget")
        .navigationBarTitleDisplayMode(.inline)
        // Force an opaque title bar so content scrolling under it does NOT bleed through
        // (iOS 26 defaults to translucent Liquid Glass on the nav bar; on a light theme that
        // reads as "title floating over blurred content"). The sticky pager below provides
        // the blur — the title stays solid so the global header reads as a layered stack:
        // opaque title → variable-blur chip strate → fade-to-clear → crisp content.
        .toolbarBackground(Color.appBackground, for: .navigationBar)
        .toolbarBackgroundVisibility(.visible, for: .navigationBar)
        .task(id: viewModel.budgetId) {
            if viewModel.allBudgets.isEmpty {
                await viewModel.loadDetails()
            } else {
                await viewModel.reloadCurrentBudget()
            }
        }
        #if DEBUG
        .onAppear { applyPUL209VerifyPriming() }
        #endif
        .sheet(item: $router.sheet) { dest in
            sheetContent(for: dest)
        }
        .navigationDestination(for: BudgetLinePushRoute.self) { route in
            pushDestination(for: route)
                .environment(viewModel)
        }
        .alert(
            "Pointer les transactions ?",
            isPresented: $viewModel.showCheckAllTransactionsAlert,
            presenting: viewModel.budgetLineToCheckAll
        ) { line in
            Button("Non, juste la prévision", role: .cancel) {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: false)
                    if succeeded {
                        viewModel.showCheckToastIfNeeded(
                            for: line, toastManager: appState.toastManager,
                            presentationCurrency: userSettingsStore.currency, amountsHidden: amountsHidden
                        )
                    }
                }
            }
            Button("Oui, tout pointer") {
                Task {
                    let succeeded = await viewModel.confirmToggle(for: line, checkAll: true)
                    if succeeded {
                        viewModel.showCheckToastIfNeeded(
                            for: line, toastManager: appState.toastManager,
                            presentationCurrency: userSettingsStore.currency, amountsHidden: amountsHidden
                        )
                    }
                }
            }
        } message: { _ in
            Text("Des transactions non pointées sont liées à cette prévision.")
        }
    }

    private var content: some View {
        // Apply both checked filter (from VM) and search filter (from view) on top
        // of the VM's already-type-filtered sections. Empty sections are dropped so
        // headers never render without rows.
        let searchFilteredSections = viewModel.displayedSections
            .map { (kind: $0.kind, items: viewModel.filteredLines($0.items, searchText: searchText)) }
            .filter { !$0.items.isEmpty }
        let filteredFree = viewModel.combinedFilteredFreeTransactions(searchText: searchText)
        let firstSectionKind = searchFilteredSections.first?.kind

        return ScrollView {
            LazyVStack(spacing: 0) {
                BudgetDetailHero(
                    metrics: viewModel.metrics,
                    timeElapsedPercentage: timeElapsedPercentage,
                    onTapChart: { router.present(.realizedBalance) },
                    rolloverAmount: viewModel.rolloverInfo?.amount,
                    previousBudgetMonth: viewModel.previousBudgetMonth,
                    onRolloverTap: viewModel.rolloverInfo?.previousBudgetId.map { id in
                        { router.present(.previousBudget(PreviousBudgetItem(id: id))) }
                    }
                )
                // Drives the sticky pager by measuring the hero's frame relative to the
                // ScrollView. `minY` is 0 when the hero's top is flush with the scroll-view
                // top and becomes negative as the user scrolls down. Writes go to
                // `scrollTracker` (an @Observable owned only by the pager subview), so the
                // parent body never re-evals on scroll — only the sticky overlay does.
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
                    counts: viewModel.kindCounts,
                    checkedCounts: viewModel.checkedCounts
                )
                .popoverTip(ProductTips.checking)

                // Empty search state
                if !searchText.isEmpty && searchFilteredSections.isEmpty && filteredFree.isEmpty {
                    ContentUnavailableView("Aucune prévision trouvée", systemImage: "magnifyingglass")
                        .frame(maxWidth: .infinity)
                        .padding(.vertical, DesignTokens.Spacing.xxl)
                }

                // All checked empty state (À pointer filter active, nothing left to check)
                if searchText.isEmpty && viewModel.isShowingOnlyUnchecked &&
                    searchFilteredSections.isEmpty && filteredFree.isEmpty &&
                    (!viewModel.budgetLines.isEmpty || !viewModel.transactions.isEmpty) {
                    ContentUnavailableView {
                        Label("Tout est pointé", systemImage: "checkmark.circle.fill")
                    } description: {
                        Text("Bien joué ! Passe sur « Tout voir » pour revoir tes prévisions.")
                    }
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, DesignTokens.Spacing.xxl)
                }

                // Mixed budget line sections (tip on first visible section)
                ForEach(searchFilteredSections, id: \.kind) { section in
                    BudgetMixedSection(
                        kind: section.kind,
                        items: section.items,
                        transactions: viewModel.transactions,
                        syncingIds: viewModel.syncingBudgetLineIds,
                        onTap: { line in
                            router.push(.lineDetail(lineId: line.id))
                        },
                        onTogglePointed: { line in
                            Task {
                                let succeeded = await viewModel.toggleBudgetLine(line)
                                if succeeded {
                                    viewModel.showCheckToastIfNeeded(
                                        for: line, toastManager: appState.toastManager,
                                        presentationCurrency: userSettingsStore.currency,
                                        amountsHidden: amountsHidden
                                    )
                                }
                            }
                        },
                        tip: section.kind == firstSectionKind ? ProductTips.gestures : nil
                    )
                }

                // Free transactions — inlined (TransactionSection is List-bound;
                // tap opens the edit sheet, mirroring the budget-line detail flow).
                if !filteredFree.isEmpty {
                    BudgetDetailsFreeTransactionsList(
                        transactions: filteredFree,
                        syncingIds: viewModel.syncingTransactionIds,
                        onTap: { transaction in
                            router.push(.editTx(transactionId: transaction.id))
                        }
                    )
                }

                // Bottom breathing room above the floating tab bar.
                // Bakes the env-published clearance directly so the last row
                // clears the bar even when the parent NavigationStack's
                // `safeAreaInset` doesn't fully cascade through `.searchable`.
                Color.clear.frame(height: tabBarClearance + DesignTokens.Spacing.lg)
            }
        }
        .scrollContentBackground(.hidden)
        .refreshable {
            await viewModel.loadDetails(force: true)
        }
        .overlay(alignment: .top) {
            BudgetDetailsStickyPagerLayer(
                months: viewModel.pagerMonths,
                currentBudgetId: viewModel.budgetId,
                onSelect: { id in
                    guard id != viewModel.budgetId else { return }
                    viewModel.prepareNavigation(to: id)
                },
                tracker: scrollTracker
            )
        }
        .overlay(alignment: .bottomTrailing) {
            BudgetDetailsAddFAB { router.present(.addBudgetLine) }
        }
        .animation(
            reduceMotion ? nil : DesignTokens.Animation.gentleSpring,
            value: searchFilteredSections.flatMap { $0.items.map(\.isChecked) }
                + filteredFree.map(\.isChecked)
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

    /// Routes each `BudgetLinePushRoute` to its push destination view. Sibling of
    /// `sheetContent(for:)`. The viewModel is injected on the destination view via
    /// `.environment(viewModel)` at the call site so pushed pages observe the same
    /// reactive Observation context as the parent.
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

    /// Routes each `BudgetDetailDestination` to its sheet view. Extracted from the
    /// `.sheet(item:)` closure to keep the parent view's `body` type-checking fast
    /// — a 7-case switch inside a SwiftUI ViewBuilder can blow up the compiler's
    /// type inference time and cascade into unrelated files.
    @ViewBuilder
    private func sheetContent(for destination: BudgetDetailDestination) -> some View {
        switch destination {
        case .addBudgetLine:
            AddBudgetLineSheet(budgetId: viewModel.budgetId) { budgetLine in
                viewModel.addBudgetLine(budgetLine)
            }
        case .editBudgetLine(let line):
            EditBudgetLineSheet(budgetLine: line, userCurrency: userSettingsStore.currency) { updatedLine in
                Task { await viewModel.updateBudgetLine(updatedLine) }
            }
        case .previousBudget(let item):
            PreviousBudgetSheet(budgetId: item.id)
        case .realizedBalance:
            RealizedBalanceSheet(
                metrics: viewModel.metrics,
                realizedMetrics: viewModel.realizedMetrics
            )
        }
    }

    #if DEBUG
    /// Reads `PUL209VerifyState` priming vars and forces filter / sheet state for
    /// the visual verification harness. No-op outside that flow because the gate
    /// vars are nil/false in normal app launches.
    private func applyPUL209VerifyPriming() {
        if let raw = PUL209VerifyState.pendingTypeFilter,
           let filter = BudgetLineKindFilter(rawValue: raw) {
            viewModel.setTypeFilter(filter)
        }
        if let raw = PUL209VerifyState.pendingCheckedFilter,
           let filter = CheckedFilterOption(rawValue: raw) {
            viewModel.setCheckedFilter(filter)
        }
        if let lineId = PUL209VerifyState.pendingOpenLineId,
           viewModel.budgetLines.contains(where: { $0.id == lineId }) {
            router.push(.lineDetail(lineId: lineId))
        }
    }
    #endif
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
