import SwiftUI

struct LinkedTransactionsSheet: View {
    let budgetLine: BudgetLine
    let transactions: [Transaction]
    let onToggle: (Transaction) -> Void
    let onEdit: (Transaction) -> Void
    let onDelete: (Transaction) -> Void
    let onAddTransaction: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var progressBarWidth: CGFloat = 0

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
            List {
                Section {
                    metricsSection
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                }

                Section {
                    progressSection
                        .listRowBackground(Color.clear)
                        .listRowInsets(EdgeInsets())
                        .listRowSeparator(.hidden)
                }

                if transactions.isEmpty {
                    Section {
                        emptyStateView
                            .listRowBackground(Color.clear)
                            .listRowSeparator(.hidden)
                    }
                } else {
                    Section {
                        ForEach(transactions) { transaction in
                            TransactionRow(
                                transaction: transaction,
                                isSyncing: false,
                                onEdit: { onEdit(transaction) }
                            )
                            .swipeActions(edge: .trailing, allowsFullSwipe: false) {
                                swipeActions(for: transaction)
                            }
                            .listRowSeparator(.hidden)
                        }
                    } header: {
                        Text("Transactions")
                            .font(PulpeTypography.headline)
                            .foregroundStyle(.primary)
                            .textCase(nil)
                    }
                }
            }
            .listStyle(.insetGrouped)
            .listSectionSpacing(DesignTokens.Spacing.lg)
            .scrollContentBackground(.hidden)
            .background(Color.sheetBackground.ignoresSafeArea())
            .safeAreaInset(edge: .bottom) {
                addTransactionButton
            }
            .navigationTitle(budgetLine.name)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
        }
        .accessibilityIdentifier("linkedTransactionsSheetRoot")
        .standardSheetPresentation(detents: [.medium, .large])
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
    }

    // MARK: - Progress Section

    private var progressSection: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            HStack {
                Text("Utilisation du budget")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(.secondary)

                Spacer()

                Text("\(Int(consumption.percentage))%")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(progressColor)
            }

            ZStack(alignment: .leading) {
                Capsule()
                    .fill(Color.progressTrack)

                Capsule()
                    .fill(progressColor)
                    .frame(width: progressBarWidth * CGFloat(min(consumption.percentage / 100, 1)))
            }
            .frame(height: DesignTokens.ProgressBar.thickHeight)
            .onGeometryChange(for: CGFloat.self) { $0.size.width } action: { progressBarWidth = $0 }
        }
        .padding(DesignTokens.Spacing.lg)
        .pulpeCardBackground()
    }

    // MARK: - Empty State

    private var emptyStateView: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "tray")
                .font(.system(size: 44, weight: .light))
                .foregroundStyle(.quaternary)

            VStack(spacing: DesignTokens.Spacing.xs) {
                Text("Pas encore de transaction")
                    .font(PulpeTypography.headline)
                    .foregroundStyle(.secondary)

                Text("Ajoute une transaction pour suivre tes dépenses")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.pulpeTextTertiary)
                    .multilineTextAlignment(.center)
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, 48)
        .padding(.horizontal)
    }

    // MARK: - Swipe Actions

    @ViewBuilder
    private func swipeActions(for transaction: Transaction) -> some View {
        Button {
            onDelete(transaction)
        } label: {
            Label("Supprimer", systemImage: "trash")
        }
        .tint(Color.destructivePrimary)

        Button {
            onToggle(transaction)
        } label: {
            Label(
                transaction.isChecked ? "Dépointer" : "Comptabiliser",
                systemImage: transaction.isChecked ? "arrow.uturn.backward" : "checkmark.circle"
            )
        }
        .tint(transaction.isChecked ? Color.financialOverBudget : .pulpePrimary)

        Button {
            onEdit(transaction)
        } label: {
            Label("Modifier", systemImage: "pencil")
        }
        .tint(.editAction)
    }

    // MARK: - Add Transaction Button

    private var addTransactionButton: some View {
        Button {
            onAddTransaction()
        } label: {
            Label("Nouvelle transaction", systemImage: "plus")
        }
        .primaryButtonStyle()
        .padding(.horizontal)
        .padding(.vertical, DesignTokens.Spacing.md)
        .pulpeFloatingGlass(cornerRadius: 0)
        .background {
            Color.sheetBackground
                .ignoresSafeArea(edges: .bottom)
        }
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
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.secondary)

                Text(value.asCompactCHF)
                    .font(PulpeTypography.progressValue)
                    .foregroundStyle(color == .secondary ? .primary : color)
                    .sensitiveAmount()
            }
        }
        .frame(maxWidth: .infinity)
        .padding(.vertical, DesignTokens.Spacing.md)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.md)
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
