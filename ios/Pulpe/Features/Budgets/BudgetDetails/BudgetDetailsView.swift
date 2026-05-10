// swiftlint:disable file_length type_body_length
import SwiftUI
import TipKit

private struct PreviousBudgetItem: Identifiable {
    let id: String
}

struct BudgetDetailsView: View {
    let budgetId: String
    @Environment(AppState.self) private var appState
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.amountsHidden) private var amountsHidden
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.tabBarClearance) private var tabBarClearance
    @State private var viewModel: BudgetDetailsViewModel
    @State private var destination: BudgetDetailDestination?

    @State private var searchText = ""
    @State private var pagerStickyOpacity: Double = 0

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
        Group {
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
        .sheet(item: $destination) { dest in
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
                    onTapChart: { destination = .realizedBalance },
                    rolloverAmount: viewModel.rolloverInfo?.amount,
                    previousBudgetMonth: viewModel.previousBudgetMonth,
                    onRolloverTap: viewModel.rolloverInfo?.previousBudgetId.map { id in
                        { destination = .previousBudget(PreviousBudgetItem(id: id)) }
                    }
                )
                // Drives the sticky pager by measuring the hero's frame relative to the
                // ScrollView. `minY` is 0 when the hero's top is flush with the scroll-view
                // top and becomes negative as the user scrolls down. We take `-minY` as the
                // raw scroll-past distance, ignoring nav-drawer / searchable inset noise
                // that affects `contentOffset.y`.
                .onGeometryChange(
                    for: CGFloat.self,
                    of: { $0.frame(in: .scrollView).minY },
                    action: { newMinY in
                        let scrolled = max(0, -newMinY)
                        let deadZone: CGFloat = DesignTokens.Spacing.xxxl         // 32pt
                        let fadeRange: CGFloat = DesignTokens.Spacing.sectionGap  // 40pt
                        let progress = (scrolled - deadZone) / fadeRange
                        pagerStickyOpacity = Double(min(max(progress, 0), 1))
                    }
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
                            appState.budgetPath.append(BudgetLinePushRoute.lineDetail(lineId: line.id))
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
                            appState.budgetPath.append(
                                BudgetLinePushRoute.editTx(transactionId: transaction.id)
                            )
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
            stickyPagerLayer
                .opacity(pagerStickyOpacity)
                .allowsHitTesting(pagerStickyOpacity > 0.5)
        }
        .overlay(alignment: .bottomTrailing) {
            addBudgetLineFAB
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

    // MARK: - Sticky Pager Layer

    /// Sticky month pager rendered as an `overlay(alignment: .top)` on the ScrollView so
    /// content scrolls UNDER it (no safe-area-inset reflow on visibility toggle). Pure
    /// opacity fade in/out driven by `pagerStickyVisible` — set by the visibility marker
    /// after the hero. Hysteresis-free: `onScrollVisibilityChange` only fires once per
    /// crossing, so the pager never oscillates between two heights.
    ///
    /// Composition (Revolut-style):
    /// 1. `ProgressiveBlurEdge` (top fade): blurs the gap between the nav bar and the chip
    ///    row so content scrolling behind isn't crisp.
    /// 2. Pager bar with **opaque** `appBackground` so the bar itself reads as a solid row.
    /// 3. `ProgressiveBlurEdge` (bottom fade): blurs the band of content right below the
    ///    bar — same trailing-edge variable blur Apple Music/Photos use.
    @ViewBuilder
    private var stickyPagerLayer: some View {
        if !viewModel.pagerMonths.isEmpty {
            let barHeight = DesignTokens.TapTarget.minimum + DesignTokens.Spacing.sm * 2
            let trailingFade = DesignTokens.Spacing.xxxl   // ~32pt — tight blur tail
            let bridgeHeight = DesignTokens.Spacing.xl    // ~20pt opaque→clear bridge

            // Three-layer composition that gives a continuous opaque→blur→clear gradient
            // matching Revolut's sticky pager:
            //   1. Variable-blur backdrop (chips + trailing fade)
            //   2. Top "bridge" gradient — opaque appBackground at the very top fading to
            //      clear over `bridgeHeight`. Hides the hard line between the opaque nav-bar
            //      and the variable blur below.
            //   3. Chips floated on top.
            ZStack(alignment: .top) {
                ProgressiveBlurEdge(
                    edge: .top,
                    height: barHeight + trailingFade,
                    maxBlurRadius: 20
                )

                LinearGradient(
                    colors: [Color.appBackground, Color.appBackground.opacity(0)],
                    startPoint: .top,
                    endPoint: .bottom
                )
                .frame(height: bridgeHeight)
                .allowsHitTesting(false)

                BudgetMonthPagerBar(
                    months: viewModel.pagerMonths,
                    currentBudgetId: viewModel.budgetId,
                    onSelect: { id in
                        guard id != viewModel.budgetId else { return }
                        viewModel.prepareNavigation(to: id)
                    }
                )
                .frame(height: barHeight)
            }
        }
    }

    // MARK: - Floating Action Button

    /// Page-local FAB that replaces the toolbar `+` button. Sits bottom-right above the
    /// floating tab bar, never moves with content scroll. iOS 26+ uses Liquid Glass with the
    /// brand tint for visual parity with the Home tab's action button.
    private var addBudgetLineFAB: some View {
        Button {
            destination = .addBudgetLine
        } label: {
            Image(systemName: "plus")
                .font(PulpeTypography.sectionIcon)
                .foregroundStyle(Color.white)
                .frame(width: DesignTokens.FrameHeight.tabBar, height: DesignTokens.FrameHeight.tabBar)
        }
        .contentShape(Circle())
        .modifier(BudgetDetailsFABBackground())
        .accessibilityLabel("Ajouter une prévision")
        .padding(.trailing, DesignTokens.Spacing.lg)
        .padding(.bottom, tabBarClearance + DesignTokens.Spacing.md)
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
                onEditLine: { line in destination = .editBudgetLine(line) }
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
            appState.budgetPath.append(BudgetLinePushRoute.lineDetail(lineId: lineId))
        }
    }
    #endif
}

/// Single source of truth for sheet presentation.
///
/// Apple's guidance is to drive sheet presentation from a single `.sheet(item:)`
/// modifier rather than stacking multiple `.sheet(...)` siblings. Stacked sheets
/// have undefined ordering when more than one tries to present, and chained
/// presentations (dismiss-then-present) only animate cleanly when the system
/// owns the transition.
private enum BudgetDetailDestination: Identifiable {
    case addBudgetLine
    case editBudgetLine(BudgetLine)
    case previousBudget(PreviousBudgetItem)
    case realizedBalance

    var id: String {
        switch self {
        case .addBudgetLine: "addBudgetLine"
        case .editBudgetLine(let line): "editBudgetLine-\(line.id)"
        case .previousBudget(let item): "previousBudget-\(item.id)"
        case .realizedBalance: "realizedBalance"
        }
    }
}

private struct BudgetDetailsSkeletonView: View {
    var body: some View {
        // Mirror the loaded state's ScrollView/LazyVStack layout so the
        // loading→loaded transition stays visually stable: hero (eyebrow +
        // amount + progress + pills) → filter chips → section header → cards.
        ScrollView {
            LazyVStack(spacing: 0) {
                heroSkeleton
                filterBarSkeleton
                sectionSkeleton
            }
        }
        .scrollContentBackground(.hidden)
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement du budget")
    }

    // MARK: - Hero

    private var heroSkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Eyebrow ("DISPONIBLE · €")
            SkeletonShape(width: 120, height: 12, cornerRadius: DesignTokens.CornerRadius.xs)

            // Hero amount — mirrors `PulpeTypography.displayYear` block height
            SkeletonShape(width: 240, height: 56, cornerRadius: DesignTokens.CornerRadius.sm)
                .padding(.top, DesignTokens.Spacing.tightGap)

            // Progress bar + percent
            HStack(spacing: DesignTokens.Spacing.sm) {
                SkeletonShape(
                    height: DesignTokens.ProgressBar.heroHeight,
                    cornerRadius: DesignTokens.CornerRadius.progressBar
                )
                SkeletonShape(width: 36, height: 14, cornerRadius: DesignTokens.CornerRadius.xs)
            }
            .padding(.top, DesignTokens.Spacing.md)

            // Pills row (Revenus · Épargne · Dépenses)
            HStack(spacing: DesignTokens.Spacing.tightGap) {
                ForEach(0..<3, id: \.self) { _ in
                    SkeletonShape(width: 120, height: 30, cornerRadius: 15)
                }
            }
            .padding(.top, DesignTokens.Spacing.md)
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.sm)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Filter bar

    private var filterBarSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.tightGap) {
            ForEach(0..<4, id: \.self) { _ in
                SkeletonShape(width: 96, height: 36, cornerRadius: 18)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.xs)
        .frame(maxWidth: .infinity, alignment: .leading)
    }

    // MARK: - Section + rows

    private var sectionSkeleton: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Section header ("Dépenses · 8")
            SkeletonShape(width: 110, height: 18, cornerRadius: DesignTokens.CornerRadius.xs)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.sm)

            ForEach(0..<5, id: \.self) { _ in
                rowSkeleton
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.md)
            }
        }
    }

    /// Mirrors `BudgetLineMixedRow`: PointCircle · (kind tag + name) · amount + suffix · chevron.
    private var rowSkeleton: some View {
        HStack(spacing: DesignTokens.Spacing.xxs) {
            SkeletonCircle(size: DesignTokens.Checkbox.size)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(width: 60, height: 10)
                SkeletonShape(width: 130, height: 16)
            }

            Spacer(minLength: DesignTokens.Spacing.sm)

            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(width: 80, height: 18)
                SkeletonShape(width: 50, height: 10)
            }

            SkeletonShape(width: 6, height: 12, cornerRadius: DesignTokens.CornerRadius.xs)
                .padding(.leading, DesignTokens.Spacing.xs)
        }
        .padding(.vertical, DesignTokens.Spacing.md)
        .padding(.leading, DesignTokens.Spacing.xs)
        .padding(.trailing, DesignTokens.Spacing.md)
        .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.minHeight, alignment: .leading)
        .background(Color.surfaceContainerLowest)
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
    }
}

// MARK: - FAB Background Modifier

/// Wraps the FAB body with iOS 26 Liquid Glass when available, falling back to
/// `.ultraThinMaterial` on iOS 18-25. Mirrors the visual treatment of the Home tab's
/// action button (`MainTabView.tabBarActionButton`) without sharing code — the two FABs
/// are siblings, not the same component (the Home FAB lives inside the tab bar capsule;
/// this one is page-local).
private struct BudgetDetailsFABBackground: ViewModifier {
    func body(content: Content) -> some View {
        if #available(iOS 26.0, *) {
            content.glassEffect(
                .regular.tint(Color.pulpePrimary).interactive(),
                in: .capsule
            )
        } else {
            content
                .background(Color.pulpePrimary, in: Circle())
                .shadow(DesignTokens.Shadow.elevated)
        }
    }
}

// MARK: - Push Routing

/// Push destinations within `BudgetDetailsView`'s NavigationStack branch. ID-based
/// so pages re-resolve their model reactively from the shared
/// `BudgetDetailsViewModel` (injected via `.environment(viewModel)` on the
/// destination view) — matches the Observation framework idiom: pages re-render
/// only when the read properties change, and `nil` lookups (model deleted while
/// pushed) trigger an automatic pop.
enum BudgetLinePushRoute: Hashable {
    case lineDetail(lineId: String)
    case addAllocatedTx(lineId: String)
    case editTx(transactionId: String)
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
    .environment(AppState())
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
