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
                withAnimation(.easeOut(duration: 0.25)) {
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
        ScrollViewReader { proxy in
            ScrollView {
                LazyVStack(spacing: DesignTokens.Spacing.xl) {
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
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, DesignTokens.Spacing.xxxl)
            }
            .scrollIndicators(.automatic)
            .onChange(of: hasAppeared) { _, appeared in
                if appeared {
                    scrollToCurrentMonth(proxy: proxy)
                }
            }
        }
        .pulpeBackground()
    }

    /// Scrolls to the current month hero card after a brief delay
    private func scrollToCurrentMonth(proxy: ScrollViewProxy) {
        Task {
            try? await Task.sleep(for: .milliseconds(400))
            withAnimation(.easeOut(duration: 0.5)) {
                proxy.scrollTo("currentMonthHero", anchor: .center)
            }
        }
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
                VStack(spacing: DesignTokens.Spacing.md) {
                    if currentMonthBudget != nil {
                        // Past months card (if any)
                        if !monthsBefore.isEmpty {
                            monthListCard(months: monthsBefore, baseIndex: 0)
                        }

                        // Current month hero card
                        if let current = currentMonthBudget {
                            CurrentMonthHeroCard(budget: current) {
                                onSelect(current)
                            }
                            .id("currentMonthHero")
                            .opacity(cardsAppeared ? 1 : 0)
                            .scaleEffect(cardsAppeared ? 1 : 0.95)
                            .animation(
                                .spring(response: 0.45, dampingFraction: 0.8)
                                    .delay(Double(monthsBefore.count) * 0.04),
                                value: cardsAppeared
                            )
                        }

                        // Future months card (if any)
                        if !monthsAfter.isEmpty {
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
            HStack(alignment: .center, spacing: 12) {
                // Chevron indicator
                Image(systemName: "chevron.right")
                    .font(.system(size: 13, weight: .bold))
                    .foregroundStyle(isPastYear ? .quaternary : .tertiary)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))

                // Year label
                Text(String(year))
                    .font(.system(.title2, design: .rounded, weight: .bold))
                    .foregroundStyle(isPastYear ? .secondary : .primary)

                // Current year badge (neutral style)
                if isCurrentYear {
                    enCoursBadge
                }

                Spacer()

                // Year-end balance
                if let endBalance = yearEndRemaining {
                    HStack(spacing: 4) {
                        Image(systemName: endBalance >= 0 ? "arrow.up.right" : "arrow.down.right")
                            .font(.system(size: 11, weight: .bold))
                        Text(endBalance.asCompactCHF)
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                            .monospacedDigit()
                    }
                    .foregroundStyle(endBalance >= 0 ? Color.financialSavings : .financialOverBudget)
                    .sensitiveAmount()
                }
            }
            .padding(.vertical, 10)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Année \(year)")
        .accessibilityHint(isExpanded ? "Appuie pour réduire" : "Appuie pour développer")
        .accessibilityAddTraits(.isHeader)
    }

    // MARK: - En Cours Badge

    private var enCoursBadge: some View {
        Text("En cours")
            .font(.caption2)
            .fontWeight(.semibold)
            .foregroundStyle(Color.pulpePrimary)
            .padding(.horizontal, 8)
            .padding(.vertical, 4)
            .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
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
    @State private var isPulsing = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @Environment(\.colorScheme) private var colorScheme

    private var monthName: String {
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var isNegative: Bool {
        (budget.remaining ?? 0) < 0
    }

    private var amountColor: Color {
        isNegative ? .financialOverBudget : .financialSavings
    }

    var body: some View {
        Button(action: onTap) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
                // Top row: label + pulse indicator
                HStack(alignment: .center) {
                    HStack(spacing: 6) {
                        Image(systemName: "calendar")
                            .font(.system(size: 13, weight: .semibold))
                        Text("Ce mois-ci")
                            .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    }
                    .foregroundStyle(.secondary)

                    Spacer()

                    pulseDot
                }

                // Month name - LARGE
                Text(monthName)
                    .font(.system(dynamicTypeSize.isAccessibilitySize ? .title2 : .largeTitle, design: .rounded, weight: .bold))
                    .foregroundStyle(.primary)

                Spacer().frame(height: DesignTokens.Spacing.sm)

                // Amount section
                HStack(alignment: .bottom) {
                    VStack(alignment: .leading, spacing: 6) {
                        Text("Disponible")
                            .font(.system(.caption, design: .rounded, weight: .medium))
                            .foregroundStyle(.tertiary)
                            .textCase(.uppercase)
                            .tracking(0.5)

                        if let remaining = budget.remaining {
                            Text(remaining.asCHF)
                                .font(.system(dynamicTypeSize.isAccessibilitySize ? .title3 : .title, design: .rounded, weight: .bold))
                                .monospacedDigit()
                                .foregroundStyle(amountColor)
                                .contentTransition(.numericText())
                                .sensitiveAmount()
                        }
                    }

                    Spacer()

                    // Voir details button
                    HStack(spacing: 4) {
                        Text("Détails")
                            .font(.system(.subheadline, design: .rounded, weight: .medium))
                        Image(systemName: "chevron.right")
                            .font(.system(size: 12, weight: .semibold))
                    }
                    .foregroundStyle(Color.pulpePrimary)
                }
            }
            .padding(DesignTokens.Spacing.xxl)
            .frame(minHeight: 170)
            .background(heroGradientBackground)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl)
                    .strokeBorder(Color(.separator).opacity(0.15), lineWidth: 1)
            )
            .shadow(DesignTokens.Shadow.elevated)
            .scaleEffect(isPressed ? 0.97 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isPressed)
        }
        .buttonStyle(.plain)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .accessibilityLabel("\(monthName), ce mois-ci, \(budget.remaining?.asCHF ?? "non défini") disponible")
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Hero Gradient Background

    @ViewBuilder
    private var heroGradientBackground: some View {
        ZStack {
            // Base card surface
            Color.surfaceCard

            // Gradient glow overlay (adapts to color scheme)
            LinearGradient(
                colors: [
                    Color.pulpePrimary.opacity(colorScheme == .dark ? 0.12 : 0.10),
                    Color.pulpePrimary.opacity(colorScheme == .dark ? 0.04 : 0.03)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        }
    }

    // MARK: - Pulse Dot

    private var pulseDot: some View {
        ZStack {
            if reduceMotion {
                Circle()
                    .fill(Color.pulpePrimary.opacity(0.3))
                    .frame(width: 14, height: 14)
            } else {
                Circle()
                    .fill(Color.pulpePrimary.opacity(isPulsing ? 0 : 0.35))
                    .frame(width: 10, height: 10)
                    .scaleEffect(isPulsing ? 2.0 : 1)
                    .animation(.easeOut(duration: 1.5).repeatForever(autoreverses: false), value: isPulsing)
            }

            Circle()
                .fill(Color.pulpePrimary)
                .frame(width: 10, height: 10)
        }
        .onAppear {
            if !reduceMotion {
                isPulsing = true
            }
        }
    }
}

// MARK: - Budget Month Row

struct BudgetMonthRow: View {
    let budget: BudgetSparse
    let onTap: () -> Void

    @State private var tapTrigger = false
    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    private var monthName: String {
        guard let month = budget.month, month >= 1, month <= 12 else { return "—" }
        return Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var monthNumber: String {
        guard let month = budget.month else { return "—" }
        return String(format: "%02d", month)
    }

    private var isPastMonth: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        return Date.isPast(month: month, year: year)
    }

    private var isFutureMonth: Bool {
        guard let month = budget.month, let year = budget.year else { return false }
        let now = Date()
        let currentMonth = Calendar.current.component(.month, from: now)
        let currentYear = now.year
        return year > currentYear || (year == currentYear && month > currentMonth)
    }

    private var amountColor: Color {
        if isPastMonth { return .secondary }
        guard let remaining = budget.remaining else { return .secondary }
        if remaining < 0 { return .financialOverBudget }
        if remaining > 0 { return .financialSavings }
        return .secondary
    }

    var body: some View {
        Button {
            tapTrigger.toggle()
            onTap()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
                // Month number badge - visual anchor
                Text(monthNumber)
                    .font(.system(.caption, design: .monospaced, weight: .semibold))
                    .foregroundStyle(isPastMonth ? .quaternary : .tertiary)
                    .frame(width: 24)

                if dynamicTypeSize.isAccessibilitySize {
                    VStack(alignment: .leading, spacing: 4) {
                        Text(monthName)
                            .font(.system(.body, design: .rounded, weight: isPastMonth ? .regular : .medium))
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
                        .font(.system(.body, design: .rounded, weight: isPastMonth ? .regular : .medium))
                        .foregroundStyle(isPastMonth ? .secondary : .primary)

                    // Future month indicator
                    if isFutureMonth {
                        Text("À venir")
                            .font(.system(.caption2, design: .rounded, weight: .medium))
                            .foregroundStyle(.tertiary)
                            .padding(.horizontal, 6)
                            .padding(.vertical, 2)
                            .background(Color(.tertiarySystemFill), in: Capsule())
                    }

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
            .padding(.vertical, 16)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .sensoryFeedback(.selection, trigger: tapTrigger)
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

    @Environment(\.colorScheme) private var colorScheme

    private var monthName: String {
        Formatters.monthYear.monthSymbols[month - 1].capitalized
    }

    private var monthNumber: String {
        String(format: "%02d", month)
    }

    var body: some View {
        Button(action: onTap) {
            HStack(spacing: DesignTokens.Spacing.md) {
                // Month number badge - matches BudgetMonthRow
                Text(monthNumber)
                    .font(.system(.caption, design: .monospaced, weight: .semibold))
                    .foregroundStyle(.quaternary)
                    .frame(width: 24)

                VStack(alignment: .leading, spacing: 4) {
                    Text(monthName)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(.tertiary)

                    Text("Pas encore de budget")
                        .font(.system(.caption, design: .rounded))
                        .foregroundStyle(.quaternary)
                }

                Spacer()

                // CTA button style
                HStack(spacing: 4) {
                    Image(systemName: "plus")
                        .font(.system(size: 12, weight: .bold))
                    Text("Créer")
                        .font(.system(.subheadline, design: .rounded, weight: .semibold))
                }
                .foregroundStyle(.white)
                .padding(.horizontal, 12)
                .padding(.vertical, 8)
                .background(Color.pulpePrimary, in: Capsule())
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)
            .background(
                Color(.tertiarySystemFill).opacity(colorScheme == .dark ? 0.5 : 0.4)
            )
            .overlay(
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg)
                    .strokeBorder(
                        Color(.separator).opacity(0.3),
                        style: StrokeStyle(lineWidth: 1, dash: [8, 4])
                    )
            )
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

#Preview("Current Month Hero Card") {
    CurrentMonthHeroCard(
        budget: BudgetSparse(
            id: "preview-1",
            month: 2,
            year: 2026,
            remaining: 2350.50
        )
    ) {}
    .padding()
    .pulpeBackground()
}

#Preview("Current Month Hero Card - Negative") {
    CurrentMonthHeroCard(
        budget: BudgetSparse(
            id: "preview-2",
            month: 2,
            year: 2026,
            remaining: -450.25
        )
    ) {}
    .padding()
    .pulpeBackground()
}

#Preview("Next Month Empty State") {
    NextMonthPlaceholder(month: 3, year: 2026) {}
        .padding()
        .pulpeBackground()
}

#Preview("Hero Card - Dark Mode") {
    CurrentMonthHeroCard(
        budget: BudgetSparse(
            id: "preview-dark",
            month: 2,
            year: 2026,
            remaining: 2350.50
        )
    ) {}
    .padding()
    .pulpeBackground()
    .preferredColorScheme(.dark)
}

#Preview("Empty State - Dark Mode") {
    NextMonthPlaceholder(month: 3, year: 2026) {}
        .padding()
        .pulpeBackground()
        .preferredColorScheme(.dark)
}

#Preview("Year Section - Current Year") {
    YearSection(
        year: 2026,
        budgets: [
            BudgetSparse(id: "1", month: 1, year: 2026, remaining: 3068.52),
            BudgetSparse(id: "2", month: 2, year: 2026, remaining: 1309.02)
        ],
        isExpanded: true,
        onToggle: {},
        onSelect: { _ in },
        onCreateBudget: { _, _ in }
    )
    .padding()
    .pulpeBackground()
}

#Preview("Budget Month Row - Past") {
    BudgetMonthRow(
        budget: BudgetSparse(id: "1", month: 1, year: 2026, remaining: 3068.52)
    ) {}
    .padding()
    .pulpeCardBackground()
}

#Preview("Budget Month Row - Future") {
    BudgetMonthRow(
        budget: BudgetSparse(id: "1", month: 4, year: 2026, remaining: 1500.00)
    ) {}
    .padding()
    .pulpeCardBackground()
}
