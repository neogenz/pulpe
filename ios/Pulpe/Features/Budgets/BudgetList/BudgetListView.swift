import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = BudgetListViewModel()
    @State private var showCreateBudget = false
    @State private var hasAppeared = false
    @State private var expandedYears: Set<Int> = []

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.budgets.isEmpty {
                LoadingView(message: "Chargement des budgets...")
            } else if let error = viewModel.error, viewModel.budgets.isEmpty {
                ErrorView(error: error) {
                    await viewModel.loadBudgets()
                }
            } else if viewModel.budgets.isEmpty {
                EmptyStateView(
                    title: "Aucun budget",
                    description: "Créez votre premier budget pour commencer",
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
            if let nextMonth = viewModel.nextAvailableMonth {
                CreateBudgetView(
                    month: nextMonth.month,
                    year: nextMonth.year
                ) { budget in
                    viewModel.addBudget(budget)
                    appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                }
            }
        }
        .refreshable {
            await viewModel.loadBudgets()
        }
        .task {
            await viewModel.loadBudgets()
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
        .disabled(viewModel.nextAvailableMonth == nil)
    }

    // MARK: - Budget List

    private var budgetList: some View {
        ScrollView {
            LazyVStack(spacing: 20) {
                ForEach(Array(viewModel.groupedByYear.enumerated()), id: \.element.year) { index, group in
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
                    .transition(.opacity.combined(with: .move(edge: .top)))
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
                cardsAppeared = false
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
        let now = Date()
        let currentYear = now.year
        let currentMonth = now.month
        if budget.year < currentYear { return true }
        if budget.year == currentYear && budget.month < currentMonth { return true }
        return false
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
                    .foregroundColor(budget.isCurrentMonth ? .pulpePrimary : .primary)

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
            Color(.secondarySystemGroupedBackground)
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
            case .negative: return .red
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
        let now = Date()
        if year < now.year { return true }
        if year == now.year && month < now.month { return true }
        return false
    }

    private var isCurrent: Bool {
        let now = Date()
        return year == now.year && month == now.month
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
        .background(Color(.tertiarySystemGroupedBackground).opacity(isPast ? 0.5 : 0.8))
        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
        .overlay(
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                .strokeBorder(
                    isCurrent ? Color.pulpePrimary.opacity(0.3) : Color.clear,
                    style: StrokeStyle(lineWidth: 1, dash: [4, 3])
                )
        )
        .opacity(isPast ? 0.5 : 1)
    }
}

// MARK: - ViewModel

@Observable
final class BudgetListViewModel {
    private(set) var budgets: [Budget] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    private let budgetService = BudgetService.shared

    struct YearGroup {
        let year: Int
        let budgets: [Budget]
    }

    var groupedByYear: [YearGroup] {
        let grouped = Dictionary(grouping: budgets) { $0.year }
        return grouped
            .sorted { $0.key < $1.key } // Oldest first, newest last
            .map { year, budgets in
                YearGroup(year: year, budgets: budgets.sorted { $0.month < $1.month })
            }
    }

    var nextAvailableMonth: (month: Int, year: Int)? {
        budgetService.getNextAvailableMonth(existingBudgets: budgets)
    }

    @MainActor
    func loadBudgets() async {
        isLoading = true
        error = nil

        do {
            budgets = try await budgetService.getAllBudgets()
        } catch {
            self.error = error
        }

        isLoading = false
    }

    func addBudget(_ budget: Budget) {
        budgets.append(budget)
    }
}

// MARK: - Preview

#Preview("Budget List") {
    NavigationStack {
        BudgetListView()
    }
    .environment(AppState())
}
