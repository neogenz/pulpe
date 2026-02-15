import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var showCreateBudget = false
    @State private var createBudgetTarget: (month: Int, year: Int)?
    @State private var hasAppeared = false
    @State private var expandedYears: Set<Int> = []

    var body: some View {
        Group {
            if store.isLoading && store.budgets.isEmpty {
                LoadingView(message: "Récupération de tes budgets...")
            } else if let error = store.error, store.budgets.isEmpty {
                ErrorView(error: error) {
                    await store.forceRefresh()
                }
            } else if store.budgets.isEmpty {
                EmptyStateView(
                    title: "Pas encore de budget",
                    description: "Crée ton premier budget et reprends le contrôle",
                    systemImage: "calendar.badge.plus",
                    actionTitle: "Créer un budget"
                ) {
                    showCreateBudget = true
                }
            } else {
                budgetList
            }
        }
        .navigationTitle("Budgets")
        .toolbar {
            ToolbarItem(placement: .primaryAction) {
                createButton
            }
        }
        .sheet(isPresented: $showCreateBudget) {
            if let nextMonth = store.nextAvailableMonth {
                CreateBudgetView(
                    month: nextMonth.month,
                    year: nextMonth.year
                ) { budget in
                    store.addBudget(budget)
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                }
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
            await store.loadIfNeeded()
            expandedYears = [Date().year]
            if reduceMotion {
                hasAppeared = true
            } else {
                withAnimation(.easeOut(duration: 0.4).delay(0.1)) {
                    hasAppeared = true
                }
            }
        }
    }

    // MARK: - Create Button

    private var createButton: some View {
        Button {
            showCreateBudget = true
        } label: {
            Image(systemName: "plus")
        }
        .disabled(store.nextAvailableMonth == nil)
        .accessibilityLabel("Créer un nouveau budget")
    }

    // MARK: - Budget List

    private var budgetList: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(Array(store.groupedByYear.enumerated()), id: \.element.year) { index, group in
                    YearSection(
                        year: group.year,
                        budgets: group.budgets,
                        isExpanded: expandedYears.contains(group.year),
                        appearDelay: Double(index) * 0.08,
                        onToggle: {
                            withAnimation(.spring(response: 0.35, dampingFraction: 0.8)) {
                                if expandedYears.contains(group.year) {
                                    expandedYears.remove(group.year)
                                } else {
                                    expandedYears.insert(group.year)
                                }
                            }
                        },
                        onSelect: { budget in
                            appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                        },
                        onCreateBudget: { month, year in
                            createBudgetTarget = (month, year)
                        }
                    )
                    .opacity(hasAppeared ? 1 : 0)
                    .offset(y: hasAppeared ? 0 : 20)
                    .animation(
                        .spring(response: 0.5, dampingFraction: 0.8).delay(Double(index) * 0.08),
                        value: hasAppeared
                    )
                }
            }
            .padding(.horizontal, 20)
            .padding(.top, 8)
            .padding(.bottom, 32)
        }
        .scrollIndicators(.automatic)
        .pulpeBackground()
    }
}

// MARK: - Year Section

struct YearSection: View {
    let year: Int
    let budgets: [BudgetSparse]
    let isExpanded: Bool
    var appearDelay: Double = 0
    let onToggle: () -> Void
    let onSelect: (BudgetSparse) -> Void
    let onCreateBudget: (Int, Int) -> Void

    @State private var cardsAppeared = false
    @State private var expandTrigger = false

    private var isCurrentYear: Bool {
        year == Date().year
    }

    private var isPastYear: Bool {
        year < Date().year
    }

    /// Budgets that exist + next empty month to invite creation
    private var visibleMonths: [MonthSlot] {
        let now = Date()
        let currentMonth = Calendar.current.component(.month, from: now)
        let currentYear = now.year

        var slots: [MonthSlot] = budgets.compactMap { budget in
            guard let month = budget.month else { return nil }
            return MonthSlot(month: month, budget: budget)
        }

        // For current/future years, add the next empty month as a stub
        if year >= currentYear {
            let startMonth = (year == currentYear) ? currentMonth : 1
            for m in startMonth ... 12 {
                let hasBudget = budgets.contains { $0.month == m }
                if !hasBudget {
                    slots.append(MonthSlot(month: m, budget: nil))
                    break // Only one empty slot
                }
            }
        }

        return slots.sorted { $0.month < $1.month }
    }

    /// Current month budget if it exists in this year section
    private var currentMonthBudget: BudgetSparse? {
        budgets.first { $0.isCurrentMonth }
    }

    /// Current month number (for splitting the timeline)
    private var currentMonthNumber: Int {
        Calendar.current.component(.month, from: Date())
    }

    /// Months before the current month
    private var monthsBefore: [MonthSlot] {
        visibleMonths.filter { slot in
            if slot.budget?.isCurrentMonth == true { return false }
            return slot.month < currentMonthNumber
        }
    }

    /// Months after the current month
    private var monthsAfter: [MonthSlot] {
        visibleMonths.filter { slot in
            if slot.budget?.isCurrentMonth == true { return false }
            return slot.month > currentMonthNumber
        }
    }

    /// All non-current months (used when no current month exists in this year)
    private var allMonths: [MonthSlot] {
        visibleMonths.filter { !($0.budget?.isCurrentMonth == true) }
    }

    /// Last month's remaining (year-end position)
    private var yearEndRemaining: Decimal? {
        budgets
            .sorted { ($0.month ?? 0) < ($1.month ?? 0) }
            .last?.remaining
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 14) {
            yearHeader

            if isExpanded {
                VStack(spacing: 0) {
                    if currentMonthBudget != nil {
                        // Timeline layout: before → hero → after
                        if !monthsBefore.isEmpty {
                            monthListCard(months: monthsBefore, baseIndex: 0)
                            timelineConnector
                        }

                        if let current = currentMonthBudget {
                            CurrentMonthHeroCard(budget: current) {
                                onSelect(current)
                            }
                            .opacity(cardsAppeared ? 1 : 0)
                            .scaleEffect(cardsAppeared ? 1 : 0.95)
                            .animation(
                                .spring(response: 0.45, dampingFraction: 0.8)
                                    .delay(Double(monthsBefore.count) * 0.04),
                                value: cardsAppeared
                            )
                        }

                        if !monthsAfter.isEmpty {
                            timelineConnector
                            monthListCard(
                                months: monthsAfter,
                                baseIndex: monthsBefore.count + 1
                            )
                        }
                    } else if !allMonths.isEmpty {
                        // No current month in this year — show all months as a single list
                        monthListCard(months: allMonths, baseIndex: 0)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
        .sensoryFeedback(.impact(flexibility: .soft), trigger: expandTrigger)
        .onAppear {
            if isExpanded {
                withAnimation(.easeOut(duration: 0.3).delay(appearDelay + 0.15)) {
                    cardsAppeared = true
                }
            }
        }
        .onChange(of: isExpanded) { _, newValue in
            expandTrigger.toggle()
            if newValue {
                withAnimation(.easeOut(duration: 0.3)) {
                    cardsAppeared = true
                }
            } else {
                withAnimation(.easeIn(duration: 0.15)) {
                    cardsAppeared = false
                }
            }
        }
    }

    // MARK: - Year Header

    private var yearHeader: some View {
        Button(action: onToggle) {
            HStack(alignment: .center, spacing: 10) {
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(.tertiary)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))

                Text(String(year))
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(isPastYear ? .secondary : .primary)

                if isCurrentYear {
                    Text("En cours")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.pulpePrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 3)
                        .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 2) {
                    Text("\(budgets.count) budget\(budgets.count > 1 ? "s" : "")")
                        .font(.subheadline)
                        .foregroundStyle(.secondary)

                    if let endBalance = yearEndRemaining {
                        Text(endBalance.asCompactCHF)
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(endBalance >= 0 ? Color.financialSavings : .financialOverBudget)
                            .sensitiveAmount()
                    }
                }
            }
            .padding(.vertical, 8)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Année \(year), \(budgets.count) budget\(budgets.count > 1 ? "s" : "")")
        .accessibilityHint(isExpanded ? "Appuie pour réduire" : "Appuie pour développer")
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - Timeline Connector

    private var timelineConnector: some View {
        Capsule()
            .fill(Color.pulpePrimary.opacity(0.15))
            .frame(width: 2.5, height: 20)
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.leading, 18)
            .padding(.vertical, 4)
    }

    // MARK: - Month List Card

    private func monthListCard(months: [MonthSlot], baseIndex: Int) -> some View {
        VStack(spacing: 0) {
            ForEach(Array(months.enumerated()), id: \.element.month) { index, slot in
                if let budget = slot.budget {
                    BudgetMonthRow(budget: budget) {
                        onSelect(budget)
                    }
                    .opacity(cardsAppeared ? 1 : 0)
                    .offset(y: cardsAppeared ? 0 : 8)
                    .animation(
                        .spring(response: 0.4, dampingFraction: 0.8)
                            .delay(Double(baseIndex + index) * 0.04),
                        value: cardsAppeared
                    )
                } else {
                    NextMonthPlaceholder(month: slot.month, year: year) {
                        onCreateBudget(slot.month, year)
                    }
                    .opacity(cardsAppeared ? 1 : 0)
                    .offset(y: cardsAppeared ? 0 : 8)
                    .animation(
                        .spring(response: 0.4, dampingFraction: 0.8)
                            .delay(Double(baseIndex + index) * 0.04),
                        value: cardsAppeared
                    )
                }

                if index < months.count - 1 {
                    Divider()
                        .padding(.leading, 34)
                }
            }
        }
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.lg)
    }
}

// MARK: - Month Slot

private struct MonthSlot {
    let month: Int
    let budget: BudgetSparse?
}

// MARK: - Current Month Hero Card

struct CurrentMonthHeroCard: View {
    let budget: BudgetSparse
    let onTap: () -> Void

    @State private var isPressed = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var monthName: String {
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var isNegative: Bool {
        (budget.remaining ?? 0) < 0
    }

    var body: some View {
        Button(action: onTap) {
            let layout = dynamicTypeSize.isAccessibilitySize
                ? AnyLayout(VStackLayout(alignment: .leading, spacing: 12))
                : AnyLayout(HStackLayout(spacing: 16))

            layout {
                VStack(alignment: .leading, spacing: 6) {
                    HStack(spacing: 8) {
                        Text("Ce mois-ci")
                            .font(.system(.caption, design: .rounded, weight: .semibold))
                            .foregroundStyle(.secondary)

                        // Pulse dot
                        Circle()
                            .fill(Color.pulpePrimary)
                            .frame(width: 6, height: 6)
                    }

                    Text(monthName)
                        .font(.system(.title3, design: .rounded, weight: .bold))
                        .foregroundStyle(.primary)
                }

                if !dynamicTypeSize.isAccessibilitySize {
                    Spacer()
                }

                if let remaining = budget.remaining {
                    VStack(alignment: dynamicTypeSize.isAccessibilitySize ? .leading : .trailing, spacing: 2) {
                        Text(remaining.asCompactCHF)
                            .font(.system(.title2, design: .rounded, weight: .bold))
                            .monospacedDigit()
                            .foregroundStyle(isNegative ? Color.financialOverBudget : .financialSavings)
                            .sensitiveAmount()

                        Text("Disponible")
                            .font(.system(.caption2, design: .rounded))
                            .foregroundStyle(.secondary)
                    }
                }
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 18)
            .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.xl)
            .scaleEffect(isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isPressed)
        }
        .buttonStyle(.plain)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .accessibilityLabel("\(monthName), ce mois-ci, \(budget.remaining?.asCompactCHF ?? "non défini") disponible")
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Budget Month Row

struct BudgetMonthRow: View {
    let budget: BudgetSparse
    let onTap: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var monthName: String {
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var isPastMonth: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        return Date.isPast(month: month, year: year)
    }

    private var amountColor: Color {
        if isPastMonth { return .secondary }
        guard let remaining = budget.remaining else { return .secondary }
        if remaining < 0 { return .financialOverBudget }
        if remaining > 0 { return .financialSavings }
        return .secondary
    }

    private var dotColor: Color {
        isPastMonth ? .secondary.opacity(0.25) : .pulpePrimary.opacity(0.25)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Circle()
                    .fill(dotColor)
                    .frame(width: 7, height: 7)

                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(monthName)
                            .font(.system(.body, design: .rounded, weight: .medium))
                            .foregroundStyle(isPastMonth ? .secondary : .primary)

                        if let remaining = budget.remaining {
                            Text(remaining.asCompactCHF)
                                .font(.system(.callout, design: .rounded, weight: .semibold))
                                .monospacedDigit()
                                .foregroundStyle(amountColor)
                                .sensitiveAmount()
                        }
                    }

                    Spacer()
                } else {
                    Text(monthName)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(isPastMonth ? .secondary : .primary)

                    Spacer()

                    if let remaining = budget.remaining {
                        Text(remaining.asCompactCHF)
                            .font(.system(.callout, design: .rounded, weight: .semibold))
                            .monospacedDigit()
                            .foregroundStyle(amountColor)
                            .sensitiveAmount()
                    }
                }

                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.quaternary)
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("\(monthName), solde \(budget.remaining?.asCompactCHF ?? "non défini")")
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Next Month Placeholder

struct NextMonthPlaceholder: View {
    let month: Int
    let year: Int
    let onTap: () -> Void

    private var monthName: String {
        Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: 12) {
                Circle()
                    .strokeBorder(Color.secondary.opacity(0.2), lineWidth: 1)
                    .frame(width: 7, height: 7)

                Text(monthName)
                    .font(.system(.body, design: .rounded, weight: .medium))
                    .foregroundStyle(.tertiary)

                Spacer()

                Text("Créer")
                    .font(.system(.subheadline, design: .rounded, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary.opacity(0.6))

                Image(systemName: "plus.circle")
                    .font(.system(size: 16, weight: .medium))
                    .foregroundStyle(Color.pulpePrimary.opacity(0.5))
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Créer un budget pour \(monthName)")
        .accessibilityHint("Appuie pour créer un budget")
        .accessibilityAddTraits(.isButton)
    }
}

#Preview("Budget List") {
    NavigationStack {
        BudgetListView()
    }
    .environment(AppState())
    .environment(CurrentMonthStore())
    .environment(BudgetListStore())
}
