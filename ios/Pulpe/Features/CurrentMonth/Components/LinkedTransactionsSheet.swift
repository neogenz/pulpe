import SwiftUI

struct LinkedTransactionsSheet: View {
    let budgetLine: BudgetLine
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void
    let onDelete: (Transaction) -> Void
    let onAddTransaction: () -> Void

    @Environment(\.dismiss) private var dismiss

    private var consumption: BudgetFormulas.Consumption {
        BudgetFormulas.calculateConsumption(for: budgetLine, transactions: transactions)
    }

    private var remaining: Decimal {
        budgetLine.amount - consumption.allocated
    }

    private var spentColor: Color {
        switch budgetLine.kind {
        case .income: return .financialIncome
        case .expense: return .financialExpense
        case .saving: return .financialSavings
        }
    }

    private var remainingColor: Color {
        remaining < 0 ? .red : .financialIncome
    }

    private var progressColor: Color {
        consumption.percentage > 100 ? .red : .pulpePrimary
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 20) {
                    metricsSection
                    progressSection

                    if transactions.isEmpty {
                        emptyStateView
                    } else {
                        transactionsSection
                    }
                }
                .padding(.top, 8)
                .padding(.bottom, 100)
            }
            .background(Color(.systemGroupedBackground))
            .safeAreaInset(edge: .bottom) {
                addTransactionButton
            }
            .navigationTitle(budgetLine.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .confirmationAction) {
                    Button("Fermer") {
                        dismiss()
                    }
                }
            }
        }
        .presentationDetents([.medium, .large])
        .presentationDragIndicator(.visible)
    }

    // MARK: - Metrics Cards

    private var metricsSection: some View {
        HStack(spacing: 12) {
            MetricCard(
                icon: "arrow.up.circle.fill",
                label: "Dépensé",
                value: consumption.allocated,
                color: spentColor
            )

            MetricCard(
                icon: "target",
                label: "Prévu",
                value: budgetLine.amount,
                color: .secondary
            )

            MetricCard(
                icon: remaining >= 0 ? "checkmark.circle.fill" : "exclamationmark.circle.fill",
                label: "Reste",
                value: remaining,
                color: remainingColor
            )
        }
        .padding(.horizontal)
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(spacing: 8) {
            HStack {
                Text("Utilisation du budget")
                    .font(.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                Text("\(Int(consumption.percentage))%")
                    .font(.subheadline)
                    .fontWeight(.semibold)
                    .foregroundStyle(progressColor)
            }

            GeometryReader { geometry in
                ZStack(alignment: .leading) {
                    Capsule()
                        .fill(Color(.systemGray5))

                    Capsule()
                        .fill(progressColor)
                        .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                }
            }
            .frame(height: 8)
        }
        .padding()
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .padding(.horizontal)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: 16) {
            Image(systemName: "tray")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.quaternary)

            VStack(spacing: 4) {
                Text("Aucune transaction")
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Text("Ajoutez une transaction pour suivre vos dépenses")
                    .font(.subheadline)
                    .foregroundStyle(.tertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .padding(.horizontal)
    }

    // MARK: - Transactions Section

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text("Transactions")
                .font(.subheadline)
                .fontWeight(.medium)
                .foregroundStyle(.secondary)
                .padding(.horizontal)

            VStack(spacing: 2) {
                ForEach(transactions) { transaction in
                    LinkedTransactionRow(
                        transaction: transaction,
                        isFirst: transaction.id == transactions.first?.id,
                        isLast: transaction.id == transactions.last?.id,
                        onDelete: { onDelete(transaction) }
                    )
                }
            }
            .background(Color(.secondarySystemGroupedBackground))
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .padding(.horizontal)
        }
    }

    // MARK: - Add Transaction Button

    private var addTransactionButton: some View {
        Button {
            onAddTransaction()
        } label: {
            Label("Nouvelle transaction", systemImage: "plus")
                .font(.headline)
                .frame(maxWidth: .infinity)
                .padding(.vertical, 16)
        }
        .buttonStyle(.borderedProminent)
        .tint(.pulpePrimary)
        .padding(.horizontal)
        .padding(.vertical, 12)
        .background(.ultraThinMaterial)
    }
}

// MARK: - Metric Card

private struct MetricCard: View {
    let icon: String
    let label: String
    let value: Decimal
    let color: Color

    var body: some View {
        VStack(spacing: 8) {
            Image(systemName: icon)
                .font(.system(size: 20))
                .foregroundStyle(color)

            VStack(spacing: 2) {
                Text(label)
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Text(value.asCompactCHF)
                    .font(.system(.callout, design: .rounded, weight: .bold))
                    .foregroundStyle(color == .secondary ? .primary : color)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 12)
        .background(Color(.secondarySystemGroupedBackground))
        .clipShape(RoundedRectangle(cornerRadius: 12))
    }
}

// MARK: - Transaction Row

private struct LinkedTransactionRow: View {
    let transaction: Transaction
    let isFirst: Bool
    let isLast: Bool
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        HStack(spacing: 12) {
            VStack(alignment: .leading, spacing: 3) {
                Text(transaction.name)
                    .font(.body)
                    .fontWeight(.medium)
                    .lineLimit(1)

                Text(transaction.transactionDate.formatted(date: .abbreviated, time: .omitted))
                    .font(.caption)
                    .foregroundStyle(.secondary)
            }

            Spacer(minLength: 8)

            Text(transaction.amount.asCHF)
                .font(.system(.body, design: .rounded, weight: .semibold))
                .foregroundStyle(transaction.kind.color)

            Button {
                showDeleteConfirmation = true
            } label: {
                Image(systemName: "trash")
                    .font(.system(size: 15))
                    .foregroundStyle(.red.opacity(0.8))
            }
            .buttonStyle(.plain)
        }
        .padding(.horizontal, 16)
        .padding(.vertical, 14)
        .background(Color(.secondarySystemGroupedBackground))
        .overlay(alignment: .bottom) {
            if !isLast {
                Divider()
                    .padding(.leading, 16)
            }
        }
        .confirmationDialog(
            "Supprimer cette transaction ?",
            isPresented: $showDeleteConfirmation,
            titleVisibility: .visible
        ) {
            Button("Supprimer", role: .destructive) {
                onDelete()
            }
            Button("Annuler", role: .cancel) {}
        }
    }
}

// MARK: - Previews

#Preview("With Transactions") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            LinkedTransactionsSheet(
                budgetLine: BudgetLine(
                    id: "1",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Salle de sport",
                    amount: 99,
                    kind: .expense,
                    recurrence: .oneOff,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                transactions: [
                    Transaction(
                        id: "t1",
                        budgetId: "b1",
                        budgetLineId: "1",
                        name: "Abonnement mensuel",
                        amount: 344,
                        kind: .expense,
                        transactionDate: Date(),
                        category: nil,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    )
                ],
                onToggle: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
}

#Preview("Over Budget") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            LinkedTransactionsSheet(
                budgetLine: BudgetLine(
                    id: "1",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Courses",
                    amount: 500,
                    kind: .expense,
                    recurrence: .oneOff,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                transactions: [
                    Transaction(
                        id: "t1",
                        budgetId: "b1",
                        budgetLineId: "1",
                        name: "Migros",
                        amount: 350,
                        kind: .expense,
                        transactionDate: Date(),
                        category: nil,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    ),
                    Transaction(
                        id: "t2",
                        budgetId: "b1",
                        budgetLineId: "1",
                        name: "Coop",
                        amount: 280,
                        kind: .expense,
                        transactionDate: Date().addingTimeInterval(-86400),
                        category: nil,
                        checkedAt: nil,
                        createdAt: Date(),
                        updatedAt: Date()
                    )
                ],
                onToggle: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
}

#Preview("Empty") {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            LinkedTransactionsSheet(
                budgetLine: BudgetLine(
                    id: "1",
                    budgetId: "b1",
                    templateLineId: nil,
                    savingsGoalId: nil,
                    name: "Loisirs",
                    amount: 200,
                    kind: .expense,
                    recurrence: .oneOff,
                    isManuallyAdjusted: false,
                    checkedAt: nil,
                    createdAt: Date(),
                    updatedAt: Date()
                ),
                transactions: [],
                onToggle: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
}
