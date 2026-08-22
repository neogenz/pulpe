import SwiftUI

enum BudgetListRefreshPolicy {
    static func shouldLoadAfterTabChange(from oldTab: Tab, to newTab: Tab, pathCount: Int) -> Bool {
        oldTab != .budgets && newTab == .budgets && pathCount == 0
    }

    static func shouldLoadAfterPathChange(from oldCount: Int, to newCount: Int) -> Bool {
        oldCount > 0 && newCount == 0
    }
}

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(UserSettingsStore.self) private var userSettingsStore
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var createBudgetTarget: (month: Int, year: Int)?
    @State private var hasAppeared = false
    @State private var selectedYear: Int = Calendar.current.component(.year, from: Date())
    @State private var showPastMonths = false
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
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
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
        .onChange(of: appState.selectedTab) { oldTab, newTab in
            guard BudgetListRefreshPolicy.shouldLoadAfterTabChange(
                from: oldTab,
                to: newTab,
                pathCount: appState.budgetPath.count
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
        .onChange(of: appState.budgetPath.count) { oldCount, newCount in
            guard BudgetListRefreshPolicy.shouldLoadAfterPathChange(
                from: oldCount,
                to: newCount
            ) else { return }
            Task { await store.loadIfNeeded() }
        }
        .onChange(of: selectedYear) {
            showPastMonths = false
        }
    }

    private var createButton: some View {
        Button {
            createBudgetTarget = store.nextAvailableMonth
        } label: {
            Image(systemName: "plus")
        }
        .disabled(store.nextAvailableMonth == nil)
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

    private func yearStatusBadge(currentYear: Int) -> some View {
        let label = selectedYear < currentYear ? Text("Terminé")
            : selectedYear == currentYear ? Text("En cours")
            : Text("À venir")
        return label
            .font(PulpeTypography.detailLabelBold)
            .textCase(.uppercase)
            .tracking(DesignTokens.Tracking.uppercaseWide)
            .foregroundStyle(Color.textPrimary)
            .padding(.horizontal, DesignTokens.Spacing.lg)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .background(Color.surfaceContainerLowest, in: Capsule())
    }

    private func monthCard(for budget: BudgetSparse, isPast: Bool = false) -> some View {
        BudgetMonthCard(budget: budget, periodLabel: periodLabel(for: budget), isPast: isPast) {
            appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
        }
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
        let allSlots = monthSlots(from: yearBudgets, currentPeriod: currentPeriod)
        let isCurrentYear = selectedYear == currentPeriod.year
        let pastSlots = isCurrentYear
            ? allSlots.filter { $0.month < currentPeriod.month && $0.budget != nil }
            : []
        let visibleSlots = isCurrentYear
            ? allSlots.filter { $0.month >= currentPeriod.month || $0.budget == nil }
            : allSlots

        return ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxxl) {
                // Section 1: Year header + picker
                VStack(spacing: 0) {
                    HStack(alignment: .lastTextBaseline) {
                        Text(String(selectedYear))
                            .font(PulpeTypography.displayYear)
                            .foregroundStyle(Color.textPrimary)
                            .tracking(DesignTokens.Tracking.display)
                            .contentTransition(.numericText())
                        Spacer()
                        yearStatusBadge(currentYear: currentPeriod.year)
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .animation(DesignTokens.Animation.defaultSpring, value: selectedYear)

                    YearPicker(years: store.availableYears, selectedYear: $selectedYear)
                }

                // Section 2: Year recap
                YearRecapCard(year: selectedYear, budgets: yearBudgets, isPastYear: isPastYear)
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                // Section 3: Monthly progression
                VStack(spacing: 0) {
                    Text("Progression mensuelle")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                        .tracking(DesignTokens.Tracking.title)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                        .padding(.bottom, pastSlots.isEmpty ? DesignTokens.Spacing.md : 0)

                    if !pastSlots.isEmpty {
                        pastMonthsToggle(count: pastSlots.count)

                        if showPastMonths {
                            VStack(spacing: DesignTokens.Spacing.md) {
                                ForEach(pastSlots, id: \.month) { slot in
                                    if let budget = slot.budget {
                                        monthCard(for: budget, isPast: true)
                                            .transition(.opacity.combined(with: .move(edge: .top)))
                                    }
                                }
                            }
                            .padding(.horizontal, DesignTokens.Spacing.xl)
                            .padding(.bottom, DesignTokens.Spacing.md)
                        }
                    }

                    VStack(spacing: DesignTokens.Spacing.md) {
                        ForEach(visibleSlots, id: \.month) { slot in
                            if let budget = slot.budget {
                                if budget.isCurrentPeriod(payDayOfMonth: userSettingsStore.payDayOfMonth) {
                                    CurrentMonthHeroCard(
                                        budget: budget,
                                        periodLabel: periodLabel(for: budget)
                                    ) {
                                        appState.budgetPath.append(
                                            BudgetDestination.details(budgetId: budget.id)
                                        )
                                    }
                                } else {
                                    monthCard(for: budget)
                                }
                            } else {
                                NextMonthPlaceholder(
                                    month: slot.month,
                                    year: selectedYear,
                                    adjustment: slot.adjustment
                                ) {
                                    createBudgetTarget = (slot.month, selectedYear)
                                }
                            }
                        }
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                }
            }
            .padding(.bottom, DesignTokens.Spacing.lg)
            .opacity(hasAppeared ? 1 : 0)
            .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
        }
        .scrollIndicators(.automatic)
        .pulpeBackground()
    }

    private func pastMonthsToggle(count: Int) -> some View {
        Button {
            withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                showPastMonths.toggle()
            }
        } label: {
            HStack(alignment: .center, spacing: DesignTokens.Spacing.xs) {
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.detailLabel)
                    .rotationEffect(.degrees(showPastMonths ? 90 : 0))
                    .accessibilityHidden(true)
                (
                    showPastMonths
                        ? Text("Masquer les mois passés")
                        : Text("Voir les \(count) mois passés")
                )
                .font(PulpeTypography.labelMedium)
                Spacer()
            }
            .foregroundStyle(Color.secondary)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityValue(
            showPastMonths ? AppLocale.string("ouvert") : AppLocale.string("fermé")
        )
        .padding(.horizontal, DesignTokens.Spacing.xl)
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

                    VStack(spacing: DesignTokens.Spacing.md) {
                        currentMonthCardSkeleton

                        ForEach(0..<2, id: \.self) { _ in
                            skeletonMonthCard
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

    private var currentMonthCardSkeleton: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SkeletonShape(
                width: DesignTokens.Skeleton.shortTextWidth,
                height: DesignTokens.Skeleton.lineHeight,
                cornerRadius: .infinity
            )
            skeletonMonthContent
        }
        .padding(DesignTokens.Spacing.xxl)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
    }

    private var skeletonMonthCard: some View {
        skeletonMonthContent
            .padding(DesignTokens.Spacing.xxl)
            .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
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
