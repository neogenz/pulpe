import SwiftUI

struct BudgetListView: View {
    var makeCreateBudgetModel: ((Int, Int) -> CreateBudgetViewModel)?
    var makePlanBudgetsModel: (() -> PlanBudgetsViewModel)?
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.horizontalSizeClass) private var horizontalSizeClass
    @State private var createBudgetTarget: (month: Int, year: Int)?
    @State private var showsBudgetPlanner = false
    @State private var hasAppeared = false
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
        .animation(DesignTokens.Animation.smoothEaseOut, value: store.isLoading)
        .localizedNavigationTitle("Budgets")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar {
            ToolbarItemGroup(placement: .topBarTrailing) {
                planButton
                createButton
            }
        }
        .sheet(isPresented: Binding(
            get: { createBudgetTarget != nil },
            set: { if !$0 { createBudgetTarget = nil } }
        )) {
            if let target = createBudgetTarget {
                CreateBudgetView(
                    month: target.month,
                    year: target.year,
                    viewModel: makeCreateBudgetModel?(target.month, target.year)
                ) { budget in
                    store.addBudget(budget)
                    appState.openBudget(budget.id, year: budget.year)
                }
            }
        }
        .sheet(isPresented: $showsBudgetPlanner) {
            PlanBudgetsView(viewModel: makePlanBudgetsModel?()
                ?? PlanBudgetsViewModel(payDayOfMonth: userSettingsStore.payDayOfMonth)) { response in
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
            if appState.budgetYear == nil {
                let defaultYear = available.contains(currentPeriod.year) ? currentPeriod.year : available.last
                selectedYear = store.budgets.first { $0.id == appState.selectedBudgetId }?.year
                    ?? defaultYear ?? currentPeriod.year
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
        .onChange(of: appState.selectedBudgetId) { _, id in
            if let year = store.budgets.first(where: { $0.id == id })?.year { selectedYear = year }
        }
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard BudgetListRefreshPolicy.shouldLoadAfterTabChange(
                from: oldTab, to: newTab
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
                selectedTab: appState.selectedTab
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
    }

    private var selectedYear: Int {
        get { appState.budgetYear ?? Calendar.current.component(.year, from: Date()) }
        nonmutating set { appState.budgetYear = newValue }
    }

    private var canChangeMonth: Bool { appState.canChangeBudgetRoot }

    private var monthSelection: Binding<String?> {
        Binding(get: { appState.selectedBudgetId }, set: { id in
            guard canChangeMonth else { return }
            // Expanding a split view can clear its selection. Only compact Back clears the month.
            guard id != nil || horizontalSizeClass != .regular else { return }
            appState.selectedBudgetId = id
        })
    }

    private var showsSkeleton: Bool {
        !store.hasLoadedOnce && store.budgets.isEmpty && store.error == nil
    }

    private var createButton: some View {
        Button { createBudgetTarget = store.nextAvailableMonth } label: {
            Label("Créer un nouveau budget", systemImage: "plus")
        }
        .disabled(store.nextAvailableMonth == nil || !canChangeMonth)
        .accessibilityLabel(BudgetListAccessibility.createOneLabel)
    }

    private var planButton: some View {
        Button { showsBudgetPlanner = true } label: {
            Label("Planifier plusieurs budgets", systemImage: "calendar.badge.plus")
        }
        .disabled(!canChangeMonth)
        .accessibilityLabel(BudgetListAccessibility.planSeveralLabel)
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
        let isPastYear = selectedYear < currentPeriod.year
        let yearBudgets = store.budgets(forYear: selectedYear)
        let slots = monthSlots(from: yearBudgets, currentPeriod: currentPeriod)

        return List(selection: monthSelection) {
            Section {
                YearPicker(years: store.availableYears, selectedYear: Binding(
                    get: { selectedYear }, set: { selectedYear = $0 }
                ))
                .disabled(!canChangeMonth)
                DisclosureGroup("Bilan de l'année") {
                    YearRecapCard(year: selectedYear, budgets: yearBudgets, isPastYear: isPastYear)
                        .padding(DesignTokens.Spacing.lg)
                        .heroZone()
                }
            }
            Section("Mois") {
                ForEach(slots, id: \.month) { slot in
                    if let budget = slot.budget {
                        NavigationLink(value: budget.id) {
                            BudgetMonthRow(
                                budget: budget,
                                periodLabel: periodLabel(for: budget),
                                isCurrent: budget.isCurrentPeriod(payDayOfMonth: userSettingsStore.payDayOfMonth),
                                isPast: isPastYear
                                    || (selectedYear == currentPeriod.year && slot.month < currentPeriod.month)
                            )
                        }
                        .disabled(!canChangeMonth)
                        .accessibilityIdentifier(BudgetMonthRow.accessibilityIdentifier(for: budget))
                    } else {
                        NextMonthRow(month: slot.month, adjustment: slot.adjustment) {
                            createBudgetTarget = (slot.month, selectedYear)
                        }
                        .disabled(!canChangeMonth)
                    }
                }
            }
        }
        .listStyle(.sidebar)
        .opacity(hasAppeared ? 1 : 0)
        .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
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
