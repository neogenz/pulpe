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
    @State private var isHeroUnderBar = true
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var templateBalance: Decimal?

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
        .trackingHeroUnderBar($isHeroUnderBar)
        .animation(DesignTokens.Animation.smoothEaseOut, value: store.isLoading)
        .localizedNavigationTitle("Budgets")
        .navigationBarTitleDisplayMode(.inline)
        .heroNavigationBar(isOnHeroSurface: isOnHeroSurface)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                planButton
                createButton
            }
            .heroToolbarGroup(isOnHeroSurface)
        }
        .sheet(isPresented: Binding(
            get: { createBudgetTarget != nil },
            set: { if !$0 { createBudgetTarget = nil } }
        )) {
            if let target = createBudgetTarget {
                CreateBudgetView(
                    month: target.month,
                    year: target.year
                ) { budget in
                    store.addBudget(budget)
                    open(budget.id)
                }
            }
        }
        .sheet(isPresented: $showsBudgetPlanner) {
            PlanBudgetsView(payDayOfMonth: userSettingsStore.payDayOfMonth) { response in
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
            templateBalance = nil
            await loadDefaultTemplateBalance()
        }
        .task {
            async let loadBudgets: Void = store.loadIfNeeded()
            async let loadTemplate: Void = loadDefaultTemplateBalance()
            _ = await (loadBudgets, loadTemplate)

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

    /// The list and its skeleton both paint the forest, the bar follows it while it is under
    /// the bar; error and empty keep a flat canvas.
    private var isOnHeroSurface: Bool { (!store.budgets.isEmpty || showsSkeleton) && isHeroUnderBar }

    private func rowSelection(for budget: BudgetSparse) -> BudgetMonthRow.Selection? {
        selectsInPlace ? .init(isSelected: budget.id == selectedBudgetId) : nil
    }

    private func open(_ budgetId: String) {
        if selectsInPlace {
            appState.budgetSelection = budgetId
        } else {
            appState.budgetPath.append(BudgetDestination.details(budgetId: budgetId))
        }
    }

    /// A month picked from the page beside the list (title menu) may sit in another year or
    /// off screen: the list follows it, scrolling no further than needed.
    private func revealSelectedMonth(_ budgetId: String?, proxy: ScrollViewProxy) {
        guard selectsInPlace, let budgetId,
              let year = store.budgets.first(where: { $0.id == budgetId })?.year else { return }
        selectedYear = year
        withAnimation(DesignTokens.Animation.smoothEaseInOut) { proxy.scrollTo(budgetId) }
    }

    private var showsSkeleton: Bool {
        !store.hasLoadedOnce && store.budgets.isEmpty && store.error == nil
    }

    private var createButton: some View {
        Button(BudgetListAccessibility.createOneLabel, systemImage: "plus") {
            createBudgetTarget = store.nextAvailableMonth
        }
        .disabled(store.nextAvailableMonth == nil)
        .heroToolbarButtonStyle(isOnHeroSurface)
    }

    private var planButton: some View {
        Button(BudgetListAccessibility.planSeveralLabel, systemImage: "calendar.badge.plus") {
            showsBudgetPlanner = true
        }
        .heroToolbarButtonStyle(isOnHeroSurface)
    }

    // MARK: - Month Slots

    private struct MonthSlot {
        let month: Int
        let budget: BudgetSparse?
        var adjustment: Decimal?
    }

    private func monthSlots(from budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> [MonthSlot] {
        var slots: [MonthSlot] = budgets.compactMap { budget in
            budget.month.map { MonthSlot(month: $0, budget: budget) }
        }

        // Add one placeholder for the next missing month if selectedYear >= current year
        if selectedYear >= currentPeriod.year {
            let startMonth = (selectedYear == currentPeriod.year) ? currentPeriod.month : 1
            let lastRemaining = slots.max(by: { $0.month < $1.month })?.budget?.remaining
            let projectedAmount = (templateBalance ?? 0) + (lastRemaining ?? 0)
            for month in startMonth...12 where !budgets.contains(where: { $0.month == month }) {
                slots.append(MonthSlot(
                    month: month,
                    budget: nil,
                    adjustment: projectedAmount != 0 ? projectedAmount : nil
                ))
                break
            }
        }

        return slots.sorted { $0.month < $1.month }
    }

    private func loadDefaultTemplateBalance() async {
        guard templateBalance == nil else { return }
        do {
            guard let template = try await TemplateService.shared.getDefaultTemplate() else { return }
            try Task.checkCancellation()
            let lines = try await TemplateService.shared.getTemplateLines(templateId: template.id)
            try Task.checkCancellation()
            let income = lines.filter { $0.kind == .income }.reduce(Decimal.zero) { $0 + $1.amount }
            let outflow = lines.filter { $0.kind != .income }.reduce(Decimal.zero) { $0 + $1.amount }
            templateBalance = income - outflow
        } catch is CancellationError {
            return
        } catch {
            // Silently fail — placeholder will show without projected amount
        }
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
                    // Beside a month the year header stays put and only the months scroll:
                    // nothing ever passes under the bar, and the year's balance stays in view
                    // while the list follows the month picked on the other side.
                    VStack(spacing: 0) {
                        yearHeader(budgets: yearBudgets, currentPeriod: currentPeriod)
                        ScrollView {
                            monthsSection(budgets: yearBudgets, currentPeriod: currentPeriod)
                        }
                        .clipShape(UnevenRoundedRectangle(
                            topLeadingRadius: DesignTokens.CornerRadius.zone,
                            topTrailingRadius: DesignTokens.CornerRadius.zone,
                            style: .continuous
                        ))
                        .contentZone()
                        // Rows run to the screen edge; the scroll view still insets the last one.
                        .ignoresSafeArea(.container, edges: .bottom)
                    }
                } else {
                    ScrollView {
                        VStack(spacing: 0) {
                            yearHeader(budgets: yearBudgets, currentPeriod: currentPeriod)
                            monthsSection(budgets: yearBudgets, currentPeriod: currentPeriod)
                                .contentZone()
                        }
                    }
                }
            }
            .opacity(hasAppeared ? 1 : 0)
            .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
            .scrollIndicators(.automatic)
            .background { Color.appBackground.ignoresSafeArea() }
            .onChange(of: selectedBudgetId, initial: true) { _, id in
                revealSelectedMonth(id, proxy: proxy)
            }
        }
    }

    private func yearHeader(budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            YearPicker(years: store.availableYears, selectedYear: $selectedYear)
            YearRecapCard(
                year: selectedYear,
                budgets: budgets,
                isPastYear: selectedYear < currentPeriod.year,
                // Beside a month, the list's job is the months: the balance stays,
                // the tiles give their height back to the rows.
                showsDetails: !selectsInPlace
            )
            .padding(.horizontal, DesignTokens.Spacing.lg)
        }
        .padding(.top, DesignTokens.Spacing.lg)
        .padding(.bottom, DesignTokens.Spacing.xl)
        .heroZone()
    }

    private func monthsSection(budgets: [BudgetSparse], currentPeriod: BudgetPeriod) -> some View {
        let slots = monthSlots(from: budgets, currentPeriod: currentPeriod)
        let payDay = userSettingsStore.payDayOfMonth

        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SectionHeader(title: AppLocale.string("Mois"), count: budgets.count)

            VStack(spacing: 0) {
                ForEach(slots, id: \.month) { slot in
                    if slot.month != slots.first?.month {
                        Divider()
                    }
                    if let budget = slot.budget {
                        BudgetMonthRow(
                            budget: budget,
                            periodLabel: periodLabel(for: budget),
                            isCurrent: budget.isCurrentPeriod(payDayOfMonth: payDay),
                            isPast: selectedYear < currentPeriod.year
                                || (selectedYear == currentPeriod.year && slot.month < currentPeriod.month),
                            selection: rowSelection(for: budget)
                        ) {
                            open(budget.id)
                        }
                        .id(budget.id)
                    } else {
                        NextMonthRow(month: slot.month, adjustment: slot.adjustment) {
                            createBudgetTarget = (slot.month, selectedYear)
                        }
                    }
                }
            }
        }
        // The content zone is the card: rows sit bare on it, a second surface
        // under the zone's own curve would read as a card inside a card.
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.top, DesignTokens.Spacing.xxl)
        .padding(.bottom, DesignTokens.Spacing.lg)
    }
}

enum BudgetListAccessibility {
    static let createOneLabel = AppLocale.string("Créer un nouveau budget")
    static let planSeveralLabel = AppLocale.string("Planifier plusieurs budgets")
}

// MARK: - Period Label

private extension BudgetListView {
    func periodLabel(for budget: BudgetSparse) -> String? {
        guard let month = budget.month, let year = budget.year else { return nil }
        return BudgetPeriodCalculator.formatPeriod(
            month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth
        )
    }
}
