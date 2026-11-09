import SwiftUI

struct BudgetListView: View {
    /// Set when a month opens beside the list (the open iPhone Duo) rather than on top of it.
    var selectsInPlace = false
    var selectedBudgetId: String?

    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var createBudgetTarget: (month: Int, year: Int)?

    @State private var showsBudgetPlanner = false
    @State private var hasAppeared = false
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var showsClosedMonths = true

    var body: some View {
        Group {
            if showsSkeleton {
                BudgetListSkeletonView()
                    .transition(.opacity)
            } else if let error = store.error, store.budgets.isEmpty {
                ErrorView(error: error) {
                    await store.forceRefresh()
                }
                .transition(.opacity)
            } else if store.budgets.isEmpty {
                PulpeEmptyState(
                    systemImage: "chart.bar.doc.horizontal",
                    title: AppLocale.string("Pas encore de budget"),
                    message: AppLocale.string("Crée-en un pour commencer à suivre tes dépenses"),
                    actionTitle: AppLocale.string("Créer un budget")
                ) {
                    createBudgetTarget = store.nextAvailableMonth
                }
                .transition(.opacity)
            } else {
                budgetList
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetList")
        .animation(DesignTokens.Animation.smoothEaseOut, value: store.isLoading)
        // The page carries its own large title; the bar keeps it for the back label.
        .localizedNavigationTitle("Budgets")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .sheet(isPresented: Binding(
            get: { createBudgetTarget != nil },
            set: { if !$0 { createBudgetTarget = nil } }
        )) {
            if let target = createBudgetTarget {
                CreateBudgetView(
                    month: target.month,
                    year: target.year,
                    existingPeriods: store.existingPeriods
                ) { budget in
                    store.addBudget(budget)
                    open(budget.id)
                }
            }
        }
        .sheet(isPresented: $showsBudgetPlanner) {
            PlanBudgetsView(
                payDayOfMonth: userSettingsStore.payDayOfMonth,
                existingPeriods: store.existingPeriods
            ) { response in
                Task {
                    await store.forceRefresh()
                    AccessibilityNotification.Announcement(
                        BudgetGenerationResultAnnouncement.message(for: response)
                    ).post()
                }
            }
        }
        .refreshable {
            await store.forceRefresh()
        }
        .task {
            await store.loadIfNeeded()

            let currentPeriod = BudgetPeriodCalculator.periodForDate(
                Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
            )
            let available = store.availableYears
            if available.contains(currentPeriod.year) {
                selectedYear = currentPeriod.year
            } else if let latest = available.last {
                selectedYear = latest
            }
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(.easeOut(duration: DesignTokens.Animation.quickSnap)) {
                    hasAppeared = true
                }
            }
        }
        .onChange(of: store.availableYears) { _, years in
            if !years.contains(selectedYear), let latest = years.last {
                selectedYear = latest
            }
        }
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard BudgetListRefreshPolicy.shouldLoadAfterTabChange(
                from: oldTab, to: newTab, pathCount: appState.budgetPath.count
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
        .onChange(of: appState.budgetPath.count) { oldCount, newCount in
            guard BudgetListRefreshPolicy.shouldLoadAfterPathChange(
                from: oldCount, to: newCount, selectedTab: appState.selectedTab
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
        .onChange(of: store.invalidationGeneration) {
            guard BudgetListRefreshPolicy.shouldLoadAfterInvalidation(
                selectedTab: appState.selectedTab, pathCount: appState.budgetPath.count
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
    }

    private func rowSelection(for budget: BudgetSparse) -> BudgetMonthRow.Selection? {
        selectsInPlace ? .init(isSelected: budget.id == selectedBudgetId) : nil
    }

    private func open(_ budgetId: String) {
        if selectsInPlace {
            // A page pushed beside the list belongs to the month being left.
            appState.budgetPath = NavigationPath()
            appState.budgetSelection = budgetId
        } else {
            // Unfolding the Duo keeps this month beside the list.
            appState.budgetSelection = budgetId
            appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
        }
    }

    /// A month picked from the page beside the list (title menu) may sit in another year or
    /// off screen: the list follows it, scrolling no further than needed.
    private func revealSelectedMonth(_ budgetId: String?, proxy: ScrollViewProxy) {
        guard selectsInPlace, let budgetId,
              let year = store.budgets.first(where: { $0.id == budgetId })?.year else { return }
        // Another year's rows do not exist yet: the scroll waits for the year to show.
        guard year == selectedYear else { selectedYear = year; return }
        scrollToSelectedMonth(proxy: proxy)
    }

    /// Never changes the year, so picking another year's chip is not undone.
    private func scrollToSelectedMonth(proxy: ScrollViewProxy) {
        guard selectsInPlace, let selectedBudgetId,
              store.budgets.first(where: { $0.id == selectedBudgetId })?.year == selectedYear else { return }
        withAnimation(DesignTokens.Animation.smoothEaseInOut) { proxy.scrollTo(selectedBudgetId) }
    }

    private var showsSkeleton: Bool {
        !store.hasLoadedOnce && store.budgets.isEmpty && store.error == nil
    }

    // MARK: - Budget List

    private var budgetList: some View {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(
            Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
        )
        let yearBudgets = store.budgets(forYear: selectedYear)

        return ScrollViewReader { proxy in
            Group {
                if selectsInPlace {
                    // Beside a month only the title and the years stay put: the year's balance
                    // scrolls with the months, so the list keeps its height for the rows.
                    ScrollView {
                        VStack(spacing: DesignTokens.Spacing.none) {
                            yearRecap(budgets: yearBudgets, currentPeriod: currentPeriod)
                            monthsSection(budgets: yearBudgets, currentPeriod: currentPeriod)
                        }
                    }
                    .modifier(FixedTopBlock { yearHeader })
                } else {
                    ScrollView {
                        VStack(spacing: DesignTokens.Spacing.none) {
                            yearHeader
                            yearRecap(budgets: yearBudgets, currentPeriod: currentPeriod)
                                .padding(.top, DesignTokens.Spacing.lg)
                            monthsSection(budgets: yearBudgets, currentPeriod: currentPeriod)
                        }
                    }
                    .pulpeRootBottomInset()
                }
            }
            .opacity(hasAppeared ? 1 : 0)
            .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
            .scrollIndicators(.automatic)
            .background { Color.appBackground.ignoresSafeArea() }
            .onChange(of: selectedBudgetId, initial: true) { _, id in
                revealSelectedMonth(id, proxy: proxy)
            }
            .onChange(of: selectedYear) { scrollToSelectedMonth(proxy: proxy) }
        }
    }

    private var yearHeader: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            PageHeader(
                title: AppLocale.string("Budgets"),
                subtitle: BudgetListPresentation.payDaySubtitle(payDayOfMonth: userSettingsStore.payDayOfMonth)
            )
            .padding(.horizontal, -DesignTokens.Spacing.lg)

            if store.availableYears.count > 1 {
                SegmentedPicker(
                    selection: $selectedYear,
                    title: nil,
                    options: store.availableYears
                ) { Text(verbatim: String($0)) }
                .accessibilityLabel(AppLocale.string("Année"))
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.sm)
    }

    private func yearRecap(budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> some View {
        YearRecapCard(
            year: selectedYear,
            budgets: budgets,
            isPastYear: selectedYear < currentPeriod.year
        )
        .padding(.horizontal, DesignTokens.Spacing.lg)
    }
}

// MARK: - Month Blocks

extension BudgetListView {
    /// The months as they are lived: the one in progress, the ones still ahead with the
    /// next free month, then the closed ones, folded on the year being lived since a
    /// closed month is history. Beside a month (the open Duo) they stay unfolded: the list
    /// has to show whichever month is picked on the other side.
    private func monthsSection(budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> some View {
        let sections = BudgetListPresentation.sections(of: budgets, currentPeriod: currentPeriod)
        let foldsClosed = selectedYear == currentPeriod.year && !selectsInPlace

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.xl) {
            if !sections.current.isEmpty {
                monthsBlock(title: AppLocale.string("En cours"), budgets: sections.current, role: .current)
            }
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                if !sections.upcoming.isEmpty {
                    SectionHeader(title: AppLocale.string("À venir"))
                    monthsCard(budgets: sections.upcoming, role: .upcoming)
                }
                NextFreeMonthCard(
                    month: store.nextAvailableMonth,
                    onCreate: { createBudgetTarget = store.nextAvailableMonth },
                    onPlan: { showsBudgetPlanner = true }
                )
            }
            if !sections.closed.isEmpty {
                let isOpen = !foldsClosed || showsClosedMonths
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SectionHeader(
                        title: AppLocale.string("Mois clos"),
                        subtitle: AppLocale.string("Ce qu'il restait à la fin de chaque mois"),
                        link: foldsClosed
                            ? (showsClosedMonths ? AppLocale.string("Masquer") : AppLocale.string("Afficher"), {
                                withAnimation(reduceMotion ? nil : DesignTokens.Animation.smoothEaseInOut) {
                                    showsClosedMonths.toggle()
                                }
                            })
                            : nil,
                        linkAccessibilityIdentifier: "closedMonthsToggle",
                        linkSystemImage: showsClosedMonths ? "chevron.up" : "chevron.down"
                    )
                    if isOpen {
                        monthsCard(budgets: sections.closed, role: .closed)
                    }
                }
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xxl)
        .padding(.bottom, DesignTokens.Spacing.lg)
    }

    private func monthsBlock(title: String, budgets: [BudgetSparse], role: BudgetMonthRow.Role) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(title: title)
            monthsCard(budgets: budgets, role: role)
        }
    }

    private func monthsCard(budgets: [BudgetSparse], role: BudgetMonthRow.Role) -> some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            ForEach(budgets) { budget in
                if budget.id != budgets.first?.id {
                    FormRowDivider()
                }
                BudgetMonthRow(
                    budget: budget,
                    // A closed month needs no dates under it: the block names its state.
                    periodLabel: role == .closed ? nil : periodLabel(for: budget),
                    role: role,
                    selection: rowSelection(for: budget)
                ) {
                    open(budget.id)
                }
                .id(budget.id)
            }
        }
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .pulpeSurfaceCard()
    }

    /// « 25 oct. au 24 nov. · jour 10 sur 31 », the month page's own subtitle.
    private func periodLabel(for budget: BudgetSparse) -> String? {
        guard let month = budget.month, let year = budget.year else { return nil }
        return BudgetDetailsView.periodSubtitle(
            month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }
}

/// The year block held above the months that scroll under it. The block paints the page colour
/// behind itself and a margin below the card where that colour fades out: the months vanish in
/// that strip instead of being sliced by the card's edge. The system's soft scroll edge did not
/// draw under this bar, so the fade is the block's own.
private struct FixedTopBlock<Block: View>: ViewModifier {
    @ViewBuilder let block: () -> Block

    func body(content: Content) -> some View {
        content.safeAreaInset(edge: .top, spacing: DesignTokens.Spacing.none) {
            block()
                .padding(.bottom, DesignTokens.Spacing.lg)
                .background {
                    VStack(spacing: DesignTokens.Spacing.none) {
                        Color.appBackground
                        Color.appBackground
                            .frame(height: DesignTokens.Spacing.lg)
                            .mask(LinearGradient(colors: [.black, .clear], startPoint: .top, endPoint: .bottom))
                    }
                    // Up to the screen's top too, or the months show above the block once
                    // they have scrolled past it.
                    .ignoresSafeArea(edges: .top)
                    .allowsHitTesting(false)
                }
        }
    }
}
