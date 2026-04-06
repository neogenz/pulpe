import SwiftUI

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
                VStack(spacing: DesignTokens.Spacing.lg) {
                    Image(systemName: "chart.bar.doc.horizontal")
                        .font(PulpeTypography.emojiDisplay)
                        .foregroundStyle(Color.textTertiary)
                        .symbolEffect(.pulse, options: .nonRepeating)
                    Text("Pas encore de budget")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                    Text("Crée-en un pour commencer à suivre tes dépenses")
                        .font(PulpeTypography.bodyLarge)
                        .foregroundStyle(Color.textTertiary)
                        .multilineTextAlignment(.center)
                    Button("Créer un budget") {
                        createBudgetTarget = store.nextAvailableMonth
                    }
                    .primaryButtonStyle()
                }
                .padding(DesignTokens.Spacing.xxxl)
                .transition(.opacity)
            } else {
                budgetList
                    .transition(.opacity)
            }
        }
        .trackScreen("BudgetList")
        .animation(DesignTokens.Animation.smoothEaseOut, value: store.isLoading)
        .navigationTitle("Budgets")
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

    private func monthSlots(from budgets: [BudgetSparse]) -> [MonthSlot] {
        let currentPeriod = BudgetPeriodCalculator.periodForDate(
            Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
        )

        var slots: [MonthSlot] = budgets.compactMap { budget in
            guard let month = budget.month else { return nil }
            return MonthSlot(month: month, budget: budget)
        }

        // Add one placeholder for the next missing month if selectedYear >= current year
        if selectedYear >= currentPeriod.year {
            let startMonth = (selectedYear == currentPeriod.year) ? currentPeriod.month : 1
            let lastRemaining = slots.last?.budget?.remaining
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

    private var currentYear: Int {
        BudgetPeriodCalculator.periodForDate(
            Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
        ).year
    }
    private var isPastYear: Bool { selectedYear < currentYear }

    private var yearStatusBadge: some View {
        let label = selectedYear < currentYear ? "Terminé"
            : selectedYear == currentYear ? "En cours"
            : "À venir"
        return Text(label)
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
        do {
            guard let template = try await TemplateService.shared.getDefaultTemplate() else { return }
            let lines = try await TemplateService.shared.getTemplateLines(templateId: template.id)
            let income = lines.filter { $0.kind == .income }.reduce(Decimal.zero) { $0 + $1.amount }
            let outflow = lines.filter { $0.kind != .income }.reduce(Decimal.zero) { $0 + $1.amount }
            templateBalance = income - outflow
        } catch {
            // Silently fail — placeholder will show without projected amount
        }
    }

    private func periodLabel(for budget: BudgetSparse) -> String? {
        budget.month.flatMap { month in
            budget.year.flatMap { year in
                BudgetPeriodCalculator.formatPeriod(
                    month: month, year: year, payDayOfMonth: userSettingsStore.payDayOfMonth
                )
            }
        }
    }

    // MARK: - Budget List

    private var budgetList: some View {
        let yearBudgets = store.budgets(forYear: selectedYear)
        let allSlots = monthSlots(from: yearBudgets)
        let currentPeriod = BudgetPeriodCalculator.periodForDate(
            Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
        )
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
                        yearStatusBadge
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .animation(DesignTokens.Animation.defaultSpring, value: selectedYear)

                    YearPicker(years: store.availableYears, selectedYear: $selectedYear)
                }

                // Section 2: Year recap
                YearRecapCard(year: selectedYear, budgets: yearBudgets, isPastYear: isPastYear)
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                // Section 3: Monthly progression
                VStack(spacing: DesignTokens.Spacing.sm) {
                    Text("Progression mensuelle")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                        .tracking(DesignTokens.Tracking.title)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DesignTokens.Spacing.xl)

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
            .padding(.bottom, DesignTokens.Spacing.xxxl)
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
                Text(
                    showPastMonths
                        ? "Masquer les mois passés"
                        : "Voir les \(count) mois passés"
                )
                .font(PulpeTypography.labelMedium)
                Spacer()
            }
            .foregroundStyle(Color.secondary)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.horizontal, DesignTokens.Spacing.xl)
    }
}

// MARK: - Skeleton

private struct BudgetListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                // Year header placeholder
                SkeletonShape(width: 120, height: 40)
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, DesignTokens.Spacing.xl)

                // Year picker placeholder
                HStack(spacing: DesignTokens.Spacing.sm) {
                    ForEach(0..<3, id: \.self) { _ in
                        SkeletonShape(width: 64, height: 32, cornerRadius: .infinity)
                    }
                }

                VStack(spacing: DesignTokens.Spacing.md) {
                    // Hero card placeholder
                    SkeletonShape(height: 170, cornerRadius: DesignTokens.CornerRadius.xl)

                    // Month card placeholders
                    ForEach(0..<2, id: \.self) { _ in
                        skeletonMonthCard
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
            }
            .padding(.top, DesignTokens.Spacing.lg)
            .padding(.bottom, DesignTokens.Spacing.xxxl)
        }
        .shimmering()
        .pulpeBackground()
        .accessibilityLabel("Chargement des budgets")
    }

    private var skeletonMonthCard: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
            HStack(alignment: .top) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    SkeletonShape(width: 90, height: 18)
                    SkeletonShape(width: 120, height: 11)
                }
                Spacer()
                VStack(alignment: .trailing, spacing: DesignTokens.Spacing.xxs) {
                    SkeletonShape(width: 80, height: 14)
                    SkeletonShape(width: 60, height: 8)
                }
            }
            SkeletonShape(height: 36, cornerRadius: DesignTokens.CornerRadius.sm)
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.md)
    }
}
