import SwiftUI

struct LinkedTransactionsSheet: View {
    let budgetLine: BudgetLine
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void
    let onEdit: (Transaction) -> Void
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
        remaining < 0 ? .financialOverBudget : .financialIncome
    }

    private var progressColor: Color {
        consumption.percentage > 100 ? .financialOverBudget : .pulpePrimary
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    metricsSection
                    progressSection

                    if transactions.isEmpty {
                        emptyStateView
                    } else {
                        transactionsSection
                    }
                }
                .padding(.top, DesignTokens.Spacing.sm)
                .padding(.bottom, 100)
            }
            .background(Color.surfacePrimary)
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
        HStack(spacing: DesignTokens.Spacing.md) {
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
        VStack(spacing: DesignTokens.Spacing.sm) {
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
                        .fill(Color.progressTrack)

                    Capsule()
                        .fill(progressColor)
                        .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                }
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.surfaceCard)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
        .padding(.horizontal)
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.quaternary)

            VStack(spacing: 4) {
                Text("Pas encore de transaction")
                    .font(.headline)
                    .foregroundStyle(.secondary)

                Text("Ajoute une transaction pour suivre tes dépenses")
                    .font(.subheadline)
                    .foregroundStyle(Color.textTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .padding(.horizontal)
    }

    // MARK: - Transactions Section

    private var transactionsSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
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
                        onEdit: { onEdit(transaction) },
                        onDelete: { onDelete(transaction) }
                    )
                }
            }
            .background(Color.surfaceCard)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
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
                .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .buttonStyle(.borderedProminent)
        .tint(.pulpePrimary)
        .padding(.horizontal)
        .padding(.vertical, DesignTokens.Spacing.md)
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
        VStack(spacing: DesignTokens.Spacing.sm) {
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
        .padding(.vertical, DesignTokens.Spacing.md)
        .background(Color.surfaceCard)
        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
    }
}

// MARK: - Transaction Row

private struct LinkedTransactionRow: View {
    let transaction: Transaction
    let isFirst: Bool
    let isLast: Bool
    let onEdit: () -> Void
    let onDelete: () -> Void

    @State private var showDeleteConfirmation = false

    var body: some View {
        Button {
            onEdit()
        } label: {
            HStack(spacing: DesignTokens.Spacing.md) {
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
                        .foregroundStyle(Color.errorPrimary)
                }
                .buttonStyle(.plain)
            }
        }
        .buttonStyle(.plain)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, 14)
        .background(Color.surfaceCard)
        .overlay(alignment: .bottom) {
            if !isLast {
                Divider()
                    .padding(.leading, DesignTokens.Spacing.lg)
            }
        }
        .alert(
            "Supprimer cette transaction ?",
            isPresented: $showDeleteConfirmation
        ) {
            Button("Annuler", role: .cancel) {}
            Button("Supprimer", role: .destructive) {
                onDelete()
            }
        } message: {
            Text("Cette action est irréversible.")
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
                onEdit: { _ in },
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
                onEdit: { _ in },
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
                onEdit: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
}
