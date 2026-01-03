import SwiftUI

struct BudgetListView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = BudgetListViewModel()
    @State private var showCreateBudget = false

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
                Button {
                    showCreateBudget = true
                } label: {
                    Image(systemName: "plus")
                }
                .disabled(viewModel.nextAvailableMonth == nil)
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
        }
    }

    private var budgetList: some View {
        ScrollView {
            LazyVStack(spacing: 16) {
                ForEach(viewModel.groupedByYear, id: \.year) { group in
                    YearSection(
                        year: group.year,
                        budgets: group.budgets
                    ) { budget in
                        appState.budgetPath.append(BudgetDestination.details(budgetId: budget.id))
                    }
                }
            }
            .padding()
        }
    }
}

// MARK: - Year Section

struct YearSection: View {
    let year: Int
    let budgets: [Budget]
    let onSelect: (Budget) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(String(year))
                .font(.title2)
                .fontWeight(.bold)

            LazyVGrid(columns: [
                GridItem(.flexible()),
                GridItem(.flexible()),
                GridItem(.flexible())
            ], spacing: 12) {
                ForEach(1...12, id: \.self) { month in
                    if let budget = budgets.first(where: { $0.month == month }) {
                        BudgetMonthCard(budget: budget) {
                            onSelect(budget)
                        }
                    } else {
                        EmptyMonthCard(month: month, year: year)
                    }
                }
            }
        }
    }
}

// MARK: - Month Cards

struct BudgetMonthCard: View {
    let budget: Budget
    let onTap: () -> Void

    private var monthName: String {
        Formatters.shortMonth.shortMonthSymbols[budget.month - 1].capitalized
    }

    var body: some View {
        Button(action: onTap) {
            VStack(spacing: 8) {
                Text(monthName)
                    .font(.headline)

                if let remaining = budget.remaining {
                    Text(remaining.asCompactCHF)
                        .font(.caption)
                        .foregroundStyle(remaining < 0 ? .red : .green)
                }
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, 16)
            .background(budget.isCurrentMonth ? Color.accentColor.opacity(0.15) : Color(.secondarySystemBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .overlay(
                RoundedRectangle(cornerRadius: 12)
                    .stroke(budget.isCurrentMonth ? Color.accentColor : .clear, lineWidth: 2)
            )
        }
        .buttonStyle(.plain)
    }
}

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

    var body: some View {
        VStack(spacing: 8) {
            Text(monthName)
                .font(.headline)
                .foregroundStyle(isPast ? .secondary : .primary)

            Text("-")
                .font(.caption)
                .foregroundStyle(.secondary)
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 16)
        .background(Color(.tertiarySystemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
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
        return grouped.keys.sorted(by: >).map { year in
            YearGroup(year: year, budgets: grouped[year]!.sorted { $0.month < $1.month })
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

#Preview {
    NavigationStack {
        BudgetListView()
    }
    .environment(AppState())
}
