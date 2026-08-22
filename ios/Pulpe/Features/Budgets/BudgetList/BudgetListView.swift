import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var createBudgetTarget: (month: Int, year: Int)?
    @State private var hasAppeared = false
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var templateBalance: Decimal?

    var body: some View {
        Group {
            if !store.hasLoadedOnce && store.budgets.isEmpty {
                if let error = store.error {
                    ErrorView(error: error) {
                        await store.forceRefresh()
                    }
                    .transition(.opacity)
                } else {
                    BudgetListSkeletonView()
                        .transition(.opacity)
                }
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
        .toolbarColorScheme(isOnHeroSurface ? .dark : nil, for: .navigationBar)
        .heroNavigationBar()
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
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
    }

    /// Only the loaded list paints the forest; skeleton, error and empty keep a flat canvas.
    private var isOnHeroSurface: Bool { !store.budgets.isEmpty }

    private var createButton: some View {
        Button {
            createBudgetTarget = store.nextAvailableMonth
        } label: {
            Image(systemName: "plus")
        }
        .disabled(store.nextAvailableMonth == nil)
        .heroToolbarButtonStyle(isOnHeroSurface)
        .accessibilityLabel("Créer un nouveau budget")
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
        let upcomingFromMonth = isPastYear ? 13 : (selectedYear == currentPeriod.year ? currentPeriod.month : 1)
        let upcomingPotential = yearBudgets
            .filter { ($0.month ?? 0) >= upcomingFromMonth }
            .reduce(Decimal.zero) { $0 + max(0, $1.remaining ?? 0) }

        return ScrollView {
            VStack(spacing: 0) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                    YearPicker(years: store.availableYears, selectedYear: $selectedYear)
                    YearRecapCard(
                        year: selectedYear,
                        budgets: yearBudgets,
                        isPastYear: isPastYear,
                        upcomingPotential: upcomingPotential
                    )
                    .padding(.horizontal, DesignTokens.Spacing.lg)
                }
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xl)
                .heroZone()

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                    SectionHeader(title: AppLocale.string("Mois"), count: yearBudgets.count)

                    VStack(spacing: 0) {
                        ForEach(slots, id: \.month) { slot in
                            if slot.month != slots.first?.month {
                                Divider()
                            }
                            if let budget = slot.budget {
                                BudgetMonthRow(
                                    budget: budget,
                                    periodLabel: periodLabel(for: budget),
                                    isCurrent: budget.isCurrentPeriod(payDayOfMonth: userSettingsStore.payDayOfMonth),
                                    isPast: selectedYear < currentPeriod.year
                                        || (selectedYear == currentPeriod.year && slot.month < currentPeriod.month)
                                ) {
                                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                                }
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
                .contentZone()
            }
            .opacity(hasAppeared ? 1 : 0)
            .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
        }
        .scrollIndicators(.automatic)
        .background { Color.appBackground.ignoresSafeArea() }
    }
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

// MARK: - Skeleton

private struct BudgetListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxxl) {
                VStack(spacing: DesignTokens.Spacing.none) {
                    HStack {
                        SkeletonShape(
                            width: DesignTokens.Skeleton.mediumTextWidth,
                            height: DesignTokens.Spacing.sectionGap
                        )
                        Spacer()
                        SkeletonShape(
                            width: DesignTokens.Skeleton.shortTextWidth,
                            height: DesignTokens.IconSize.compact,
                            cornerRadius: .infinity
                        )
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                    HStack(spacing: DesignTokens.Spacing.sm) {
                        ForEach(0..<3, id: \.self) { _ in
                            SkeletonShape(
                                width: DesignTokens.Skeleton.compactTextWidth,
                                height: DesignTokens.Skeleton.controlHeight,
                                cornerRadius: .infinity
                            )
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                }

                yearRecapSkeleton
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                VStack(spacing: DesignTokens.Spacing.none) {
                    SkeletonShape(
                        width: DesignTokens.Skeleton.longTextWidth,
                        height: DesignTokens.Skeleton.sectionHeight
                    )
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                        .padding(.bottom, DesignTokens.Spacing.md)

                    VStack(spacing: 0) {
                        ForEach(0..<3, id: \.self) { index in
                            if index > 0 { Divider() }
                            skeletonMonthRow
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                }
            }
            .padding(.bottom, DesignTokens.Spacing.lg)
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement des budgets")
    }

    private var yearRecapSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SkeletonShape(
                width: DesignTokens.Skeleton.longTextWidth,
                height: DesignTokens.Skeleton.sectionHeight
            )
            SkeletonShape(
                width: DesignTokens.Skeleton.longTextWidth,
                height: DesignTokens.Skeleton.amountHeight
            )
            SkeletonShape(
                height: DesignTokens.ProgressBar.heroHeight,
                cornerRadius: DesignTokens.CornerRadius.progressBar
            )
            SkeletonShape(
                width: DesignTokens.Skeleton.extraLongTextWidth,
                height: DesignTokens.Skeleton.captionHeight
            )
            SkeletonShape(
                width: DesignTokens.Skeleton.longTextWidth,
                height: DesignTokens.Skeleton.captionHeight
            )
        }
    }

    private var skeletonMonthRow: some View {
        skeletonMonthContent
            .padding(.vertical, DesignTokens.Spacing.md)
    }

    private var skeletonMonthContent: some View {
        HStack(alignment: .top) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.lineHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.mediumTextWidth,
                    height: DesignTokens.Skeleton.captionHeight
                )
            }
            Spacer()
            VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                SkeletonShape(
                    width: DesignTokens.Skeleton.shortTextWidth,
                    height: DesignTokens.Skeleton.bodyHeight
                )
                SkeletonShape(
                    width: DesignTokens.Skeleton.compactTextWidth,
                    height: DesignTokens.Spacing.sm
                )
            }
        }
    }
}
