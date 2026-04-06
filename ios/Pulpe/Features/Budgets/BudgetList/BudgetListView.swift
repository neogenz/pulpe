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

    private func isCurrentPeriod(_ budget: BudgetSparse) -> Bool {
        budget.isCurrentPeriod(payDayOfMonth: userSettingsStore.payDayOfMonth)
    }

    private func monthCard(for budget: BudgetSparse) -> some View {
        BudgetMonthCard(
            budget: budget,
            periodLabel: periodLabel(for: budget),
            payDayOfMonth: userSettingsStore.payDayOfMonth
        ) {
            appState.budgetPath.append(
                BudgetDestination.details(budgetId: budget.id)
            )
        }
    }

    private func isPast(month: Int) -> Bool {
        let current = BudgetPeriodCalculator.periodForDate(
            Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
        )
        return selectedYear < current.year || (selectedYear == current.year && month < current.month)
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
        ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    // Large year header
                    Text(String(selectedYear))
                        .font(PulpeTypography.displayYear)
                        .foregroundStyle(Color.pulpePrimary)
                        .tracking(DesignTokens.Tracking.display)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                        .contentTransition(.numericText())
                        .animation(DesignTokens.Animation.defaultSpring, value: selectedYear)

                    YearPicker(years: store.availableYears, selectedYear: $selectedYear)

                    // Year recap card — budgets fetched once for the selected year
                    let yearBudgets = store.budgets(forYear: selectedYear)

                    YearRecapCard(year: selectedYear, budgets: yearBudgets)
                        .padding(.horizontal, DesignTokens.Spacing.xl)

                    // Section header
                    Text("Progression mensuelle")
                        .font(PulpeTypography.stepTitle)
                        .foregroundStyle(Color.textPrimary)
                        .tracking(DesignTokens.Tracking.title)
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                        .padding(.top, DesignTokens.Spacing.sm)

                    let allSlots = monthSlots(from: yearBudgets)
                    let currentPeriod = BudgetPeriodCalculator.periodForDate(
                        Date(), payDayOfMonth: userSettingsStore.payDayOfMonth
                    )
                    let isCurrentYear = selectedYear == currentPeriod.year
                    let pastSlots = isCurrentYear
                        ? allSlots.filter { isPast(month: $0.month) && $0.budget != nil }
                        : []
                    let visibleSlots = isCurrentYear
                        ? allSlots.filter { !isPast(month: $0.month) || $0.budget == nil }
                        : allSlots

                    // Past months toggle (only for current year)
                    if !pastSlots.isEmpty {
                        Button {
                            withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                                showPastMonths.toggle()
                            }
                        } label: {
                            HStack(spacing: DesignTokens.Spacing.xs) {
                                Image(systemName: "chevron.right")
                                    .font(PulpeTypography.detailLabel)
                                    .rotationEffect(.degrees(showPastMonths ? 90 : 0))
                                Text(
                                    showPastMonths
                                        ? "Masquer les mois passés"
                                        : "Voir les \(pastSlots.count) mois passés"
                                )
                                .font(PulpeTypography.labelMedium)
                            }
                            .foregroundStyle(Color.secondary)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .frame(minHeight: DesignTokens.TapTarget.minimum)
                            .contentShape(Rectangle())
                        }
                        .buttonStyle(.plain)
                        .padding(.horizontal, DesignTokens.Spacing.xl)

                        if showPastMonths {
                            ForEach(pastSlots, id: \.month) { slot in
                                if let budget = slot.budget {
                                    monthCard(for: budget)
                                }
                            }
                            .padding(.horizontal, DesignTokens.Spacing.xl)
                            .transition(.opacity.combined(with: .move(edge: .top)))
                        }
                    }

                    ForEach(visibleSlots, id: \.month) { slot in
                        if let budget = slot.budget {
                            if isCurrentPeriod(budget) {
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
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                }
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
                .opacity(hasAppeared ? 1 : 0)
                .animation(.easeOut(duration: DesignTokens.Animation.fast), value: hasAppeared)
            }
            .scrollIndicators(.automatic)
            .pulpeBackground()
    }
}

// MARK: - Skeleton

private struct BudgetListSkeletonView: View {
    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xl) {
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

                VStack(spacing: DesignTokens.Spacing.xl) {
                    // Hero card placeholder
                    SkeletonShape(height: 170, cornerRadius: DesignTokens.CornerRadius.xl)

                    // Month card placeholders
                    ForEach(0..<2, id: \.self) { _ in
                        skeletonMonthCard
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
            }
            .padding(.top, DesignTokens.Spacing.sm)
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
