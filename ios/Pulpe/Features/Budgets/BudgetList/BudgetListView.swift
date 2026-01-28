import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @Environment(BudgetListStore.self) private var store
    @State private var showCreateBudget = false
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
                    Task {
                        await store.addBudget(budget)
                        appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                    }
                }
            }
        }
        .refreshable {
            await store.forceRefresh()
        }
        .task {
            await store.loadIfNeeded()
            // Expand only the current year by default
            let currentYear = Date().year
            expandedYears = [currentYear]
            withAnimation(.easeOut(duration: 0.4).delay(0.1)) {
                hasAppeared = true
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
        .scrollIndicators(.hidden)
    }
}

// MARK: - Year Section

struct YearSection: View {
    let year: Int
    let budgets: [Budget]
    let isExpanded: Bool
    var appearDelay: Double = 0
    let onToggle: () -> Void
    let onSelect: (Budget) -> Void

    @State private var cardsAppeared = false

    private var isCurrentYear: Bool {
        year == Date().year
    }

    private var isPastYear: Bool {
        year < Date().year
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            yearHeader

            if isExpanded {
                monthGrid
                    .transition(.opacity)
            }
        }
        .onAppear {
            if isExpanded {
                withAnimation(.easeOut(duration: 0.3).delay(appearDelay + 0.15)) {
                    cardsAppeared = true
                }
            }
        }
        .onChange(of: isExpanded) { _, newValue in
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
                // Chevron indicator
                Image(systemName: "chevron.right")
                    .font(.system(size: 12, weight: .semibold))
                    .foregroundStyle(.secondary)
                    .rotationEffect(.degrees(isExpanded ? 90 : 0))

                Text(String(year))
                    .font(.system(.title3, design: .rounded, weight: .bold))
                    .foregroundStyle(isPastYear ? .secondary : .primary)

                if isCurrentYear {
                    Text("En cours")
                        .font(.caption2)
                        .fontWeight(.semibold)
                        .foregroundStyle(Color.pulpePrimary)
                        .padding(.horizontal, 8)
                        .padding(.vertical, 4)
                        .background(Color.pulpePrimary.opacity(0.12), in: Capsule())
                }

                Spacer()

                // Budget count badge
                let budgetCount = budgets.count
                Text("\(budgetCount) budget\(budgetCount > 1 ? "s" : "")")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
            .padding(.vertical, 8)
            .padding(.horizontal, 4)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityLabel("Année \(year), \(budgets.count) budget\(budgets.count > 1 ? "s" : "")")
        .accessibilityHint(isExpanded ? "Appuie pour réduire" : "Appuie pour développer")
    }

    // MARK: - Month Grid

    private var monthGrid: some View {
        LazyVGrid(columns: [
            GridItem(.flexible(), spacing: 10),
            GridItem(.flexible(), spacing: 10),
            GridItem(.flexible(), spacing: 10)
        ], spacing: 10) {
            ForEach(1...12, id: \.self) { month in
                let cardIndex = month - 1

                if let budget = budgets.first(where: { $0.month == month }) {
                    BudgetMonthCard(budget: budget) {
                        onSelect(budget)
                    }
                    .opacity(cardsAppeared ? 1 : 0)
                    .scaleEffect(cardsAppeared ? 1 : 0.9)
                    .animation(
                        .spring(response: 0.4, dampingFraction: 0.75).delay(Double(cardIndex) * 0.025),
                        value: cardsAppeared
                    )
                } else {
                    EmptyMonthCard(month: month, year: year)
                        .opacity(cardsAppeared ? 1 : 0)
                        .scaleEffect(cardsAppeared ? 1 : 0.95)
                        .animation(
                            .spring(response: 0.4, dampingFraction: 0.8).delay(Double(cardIndex) * 0.025),
                            value: cardsAppeared
                        )
                }
            }
        }
    }
}

// MARK: - Budget Month Card

struct BudgetMonthCard: View {
    let budget: Budget
    let onTap: () -> Void

    @State private var isPressed = false

    private var monthName: String {
        Formatters.shortMonth.shortMonthSymbols[budget.month - 1].capitalized
    }

    /// Check if this budget month is in the past
    private var isPastMonth: Bool {
        Date.isPast(month: budget.month, year: budget.year)
    }

    private var remainingStatus: RemainingStatus {
        guard let remaining = budget.remaining else { return .neutral }
        if remaining < 0 { return .negative }
        if remaining > 0 { return .positive }
        return .neutral
    }

    /// For past months, show neutral gray instead of colored status
    private var displayColor: Color {
        if isPastMonth {
            return .secondary
        }
        return remainingStatus.color
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 6) {
                // Month name
                Text(monthName)
                    .font(.system(.subheadline, design: .rounded, weight: .semibold))
                    .foregroundStyle(budget.isCurrentMonth ? Color.pulpePrimary : Color.primary)

                // Remaining amount
                if let remaining = budget.remaining {
                    Text(remaining.asCompactCHF)
                        .font(.system(.caption, design: .rounded, weight: .medium))
                        .foregroundStyle(displayColor)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 14)
            .padding(.horizontal, 8)
            .background(cardBackground)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
            .overlay(cardOverlay)
            .shadow(budget.isCurrentMonth ? DesignTokens.Shadow.card : DesignTokens.Shadow.subtle)
            .scaleEffect(isPressed ? 0.96 : 1)
            .animation(.spring(response: 0.25, dampingFraction: 0.7), value: isPressed)
        }
        .buttonStyle(.plain)
        .opacity(isPastMonth ? 0.7 : 1)
        .onLongPressGesture(minimumDuration: .infinity, pressing: { pressing in
            isPressed = pressing
        }, perform: {})
        .accessibilityLabel("\(monthName), solde \(budget.remaining?.asCompactCHF ?? "non défini")")
        .accessibilityHint("Appuie pour voir les détails")
        .accessibilityAddTraits(.isButton)
    }

    // MARK: - Card Background

    @ViewBuilder
    private var cardBackground: some View {
        if budget.isCurrentMonth {
            LinearGradient(
                colors: [
                    Color.pulpePrimary.opacity(0.08),
                    Color.pulpePrimary.opacity(0.04)
                ],
                startPoint: .topLeading,
                endPoint: .bottomTrailing
            )
        } else {
            Color.surfaceCard
        }
    }

    // MARK: - Card Overlay

    @ViewBuilder
    private var cardOverlay: some View {
        RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
            .stroke(
                budget.isCurrentMonth
                    ? Color.pulpePrimary.opacity(0.4)
                    : Color(.separator).opacity(0.3),
                lineWidth: budget.isCurrentMonth ? 1.5 : 0.5
            )
    }

    // MARK: - Remaining Status

    private enum RemainingStatus {
        case positive
        case negative
        case neutral

        var color: Color {
            switch self {
            case .positive: return .financialSavings
            case .negative: return .financialOverBudget
            case .neutral: return .secondary
            }
        }
    }
}

// MARK: - Empty Month Card

struct EmptyMonthCard: View {
    let month: Int
    let year: Int

    private var monthName: String {
        Formatters.shortMonth.shortMonthSymbols[month - 1].capitalized
    }

    private var isPast: Bool {
        Date.isPast(month: month, year: year)
    }

    private var isCurrent: Bool {
        Date.isCurrent(month: month, year: year)
    }

    var body: some View {
        VStack(spacing: 6) {
            Text(monthName)
                .font(.system(.subheadline, design: .rounded, weight: .medium))
                .foregroundStyle(isPast ? .quaternary : .tertiary)

            Text("—")
                .font(.caption)
                .foregroundStyle(.quaternary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 14)
        .padding(.horizontal, 8)
        .background(Color.surfaceCard.opacity(isPast ? 0.5 : 0.8))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .strokeBorder(
                    isCurrent ? Color.pulpePrimary.opacity(0.3) : Color.clear,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                )
        )
        .opacity(isPast ? 0.5 : 1)
        .accessibilityLabel("\(monthName), aucun budget")
        .accessibilityAddTraits(.isStaticText)
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
