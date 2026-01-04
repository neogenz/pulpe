import SwiftUI

struct BudgetDetailsView: View {
    let budgetId: String
    @State private var viewModel: BudgetDetailsViewModel
    @State private var selectedLineForTransaction: BudgetLine?

    init(budgetId: String) {
        self.budgetId = budgetId
        self._viewModel = State(initialValue: BudgetDetailsViewModel(budgetId: budgetId))
    }

    var body: some View {
        Group {
            if viewModel.isLoading && viewModel.budget == nil {
                LoadingView(message: "Chargement...")
            } else if let error = viewModel.error, viewModel.budget == nil {
                ErrorView(error: error) {
                    await viewModel.loadDetails()
                }
            } else if let budget = viewModel.budget {
                content(budget: budget)
            }
        }
        .navigationTitle(viewModel.budget?.monthYear ?? "Budget")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await viewModel.loadDetails()
        }
        .sheet(item: $selectedLineForTransaction) { line in
            AddAllocatedTransactionSheet(budgetLine: line) { transaction in
                viewModel.addTransaction(transaction)
            }
        }
    }

    private func content(budget: Budget) -> some View {
        ScrollView {
            VStack(spacing: 20) {
                // Financial summary
                FinancialSummaryRow(metrics: viewModel.metrics)

                // Progress
                BudgetProgressBar(metrics: viewModel.metrics)
                    .padding()
                    .cardStyle()

                // Budget lines by kind
                if !viewModel.incomeLines.isEmpty {
                    BudgetLineSection(
                        title: "Revenus",
                        lines: viewModel.incomeLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        }
                    )
                }

                if !viewModel.expenseLines.isEmpty {
                    BudgetLineSection(
                        title: "Dépenses",
                        lines: viewModel.expenseLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        }
                    )
                }

                if !viewModel.savingLines.isEmpty {
                    BudgetLineSection(
                        title: "Épargne",
                        lines: viewModel.savingLines,
                        transactions: viewModel.transactions,
                        onToggle: { line in
                            Task { await viewModel.toggleBudgetLine(line) }
                        },
                        onAddTransaction: { line in
                            selectedLineForTransaction = line
                        }
                    )
                }

                // Free transactions
                if !viewModel.freeTransactions.isEmpty {
                    TransactionSection(
                        title: "Transactions libres",
                        transactions: viewModel.freeTransactions,
                        onToggle: { transaction in
                            Task { await viewModel.toggleTransaction(transaction) }
                        }
                    )
                }

                Spacer(minLength: 40)
            }
            .padding(.vertical)
        }
        .refreshable {
            await viewModel.loadDetails()
        }
    }
}

// MARK: - Budget Line Section

struct BudgetLineSection: View {
    let title: String
    let lines: [BudgetLine]
    let transactions: [Transaction]
    let onToggle: (BudgetLine) -> Void
    let onAddTransaction: (BudgetLine) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .sectionHeader()

                Spacer()

                Text(total.asCHF)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)

            VStack(spacing: 8) {
                ForEach(lines) { line in
                    BudgetLineDetailRow(
                        line: line,
                        consumption: BudgetFormulas.calculateConsumption(for: line, transactions: transactions),
                        onToggle: { onToggle(line) },
                        onAddTransaction: { onAddTransaction(line) }
                    )
                }
            }
            .padding(.horizontal)
        }
    }

    private var total: Decimal {
        lines.reduce(Decimal.zero) { $0 + $1.amount }
    }
}

struct BudgetLineDetailRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let onToggle: () -> Void
    let onAddTransaction: () -> Void

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Check button
                Button(action: onToggle) {
                    Image(systemName: line.isChecked ? "checkmark.circle.fill" : "circle")
                        .font(.title2)
                        .foregroundStyle(line.isChecked ? .green : .secondary)
                }
                .disabled(line.isVirtualRollover)

                VStack(alignment: .leading, spacing: 4) {
                    Text(line.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .strikethrough(line.isChecked)

                    HStack {
                        RecurrenceBadge(line.recurrence, style: .compact)

                        if line.isFromTemplate {
                            Image(systemName: "doc.text")
                                .font(.caption2)
                                .foregroundStyle(.secondary)
                        }
                    }
                }

                Spacer()

                VStack(alignment: .trailing, spacing: 4) {
                    CurrencyText(line.amount)
                        .foregroundStyle(line.kind.color)

                    if consumption.allocated > 0 {
                        Text("\(consumption.allocated.asCompactCHF) / \(line.amount.asCompactCHF)")
                            .font(.caption)
                            .foregroundStyle(consumption.isOverBudget ? .red : .secondary)
                    }
                }

                // Add transaction button
                Button(action: onAddTransaction) {
                    Image(systemName: "plus.circle")
                        .font(.title2)
                        .foregroundStyle(Color.accentColor)
                }
                .disabled(line.isVirtualRollover)
            }
            .padding()

            // Consumption progress bar
            if consumption.allocated > 0 {
                GeometryReader { geometry in
                    Rectangle()
                        .fill(consumption.isOverBudget ? .red : (consumption.isNearLimit ? .orange : .green))
                        .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                }
                .frame(height: 3)
            }
        }
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

// MARK: - Transaction Section

struct TransactionSection: View {
    let title: String
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            HStack {
                Text(title)
                    .sectionHeader()

                Spacer()

                Text(total.asCHF)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
            .padding(.horizontal)

            VStack(spacing: 8) {
                ForEach(transactions) { transaction in
                    TransactionDetailRow(transaction: transaction) {
                        onToggle(transaction)
                    }
                }
            }
            .padding(.horizontal)
        }
    }

    private var total: Decimal {
        transactions.reduce(Decimal.zero) { $0 + $1.amount }
    }
}

struct TransactionDetailRow: View {
    let transaction: Transaction
    let onToggle: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            Button(action: onToggle) {
                Image(systemName: transaction.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(transaction.isChecked ? .green : .secondary)
            }

            VStack(alignment: .leading, spacing: 4) {
                Text(transaction.name)
                    .font(.subheadline)
                    .strikethrough(transaction.isChecked)

                Text(transaction.transactionDate.dayMonthFormatted)
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer()

            CurrencyText(transaction.amount)
                .foregroundStyle(transaction.kind.color)
        }
        .padding()
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

// MARK: - ViewModel

@Observable
final class BudgetDetailsViewModel {
    let budgetId: String

    private(set) var budget: Budget?
    private(set) var budgetLines: [BudgetLine] = []
    private(set) var transactions: [Transaction] = []
    private(set) var isLoading = false
    private(set) var error: Error?

    private let budgetService = BudgetService.shared
    private let budgetLineService = BudgetLineService.shared
    private let transactionService = TransactionService.shared

    init(budgetId: String) {
        self.budgetId = budgetId
    }

    var metrics: BudgetFormulas.Metrics {
        BudgetFormulas.calculateAllMetrics(
            budgetLines: budgetLines,
            transactions: transactions,
            rollover: budget?.rollover.orZero ?? 0
        )
    }

    var incomeLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .income }
    }

    var expenseLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .expense }
    }

    var savingLines: [BudgetLine] {
        budgetLines.filter { $0.kind == .saving }
    }

    var freeTransactions: [Transaction] {
        transactions.filter { $0.budgetLineId == nil }
    }

    @MainActor
    func loadDetails() async {
        isLoading = true
        error = nil

        do {
            let details = try await budgetService.getBudgetWithDetails(id: budgetId)
            budget = details.budget
            budgetLines = details.budgetLines
            transactions = details.transactions
        } catch {
            self.error = error
        }

        isLoading = false
    }

    @MainActor
    func toggleBudgetLine(_ line: BudgetLine) async {
        guard !(line.isRollover ?? false) else { return }

        do {
            _ = try await budgetLineService.toggleCheck(id: line.id)
            await loadDetails()
        } catch {
            self.error = error
        }
    }

    @MainActor
    func toggleTransaction(_ transaction: Transaction) async {
        do {
            _ = try await transactionService.toggleCheck(id: transaction.id)
            await loadDetails()
        } catch {
            self.error = error
        }
    }

    @MainActor
    func addTransaction(_ transaction: Transaction) {
        transactions.append(transaction)
    }
}

#Preview {
    NavigationStack {
        BudgetDetailsView(budgetId: "test")
    }
}
