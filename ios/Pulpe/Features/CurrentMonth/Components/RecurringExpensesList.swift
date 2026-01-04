import SwiftUI

/// List of recurring budget lines with consumption tracking
struct RecurringExpensesList: View {
    let title: String
    let items: [BudgetLine]
    let transactions: [Transaction]
    let onToggle: (BudgetLine) -> Void
    let onAddTransaction: (BudgetLine) -> Void

    var body: some View {
        VStack(alignment: .leading, spacing: 12) {
            Text(title)
                .sectionHeader()
                .padding(.horizontal)

            VStack(spacing: 8) {
                ForEach(items) { item in
                    BudgetLineRow(
                        line: item,
                        consumption: BudgetFormulas.calculateConsumption(for: item, transactions: transactions),
                        onToggle: { onToggle(item) },
                        onAddTransaction: { onAddTransaction(item) }
                    )
                }
            }
            .padding(.horizontal)
        }
    }
}

/// Single budget line row
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let onToggle: () -> Void
    let onAddTransaction: () -> Void

    var body: some View {
        HStack(spacing: 12) {
            // Check button
            Button {
                onToggle()
            } label: {
                Image(systemName: line.isChecked ? "checkmark.circle.fill" : "circle")
                    .font(.title2)
                    .foregroundStyle(line.isChecked ? .green : .secondary)
            }
            .disabled(line.isVirtualRollover)

            // Content
            VStack(alignment: .leading, spacing: 4) {
                HStack {
                    Text(line.name)
                        .font(.subheadline)
                        .fontWeight(.medium)
                        .strikethrough(line.isChecked)
                        .foregroundStyle(line.isChecked ? .secondary : .primary)

                    Spacer()

                    CurrencyText(line.amount, style: .body)
                        .foregroundStyle(line.kind.color)
                }

                // Badges and consumption
                HStack {
                    BudgetLineBadges(kind: line.kind, recurrence: line.recurrence)

                    if consumption.allocated > 0 {
                        Spacer()
                        ConsumptionIndicator(consumption: consumption)
                    }
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
        .background(.background)
        .clipShape(RoundedRectangle(cornerRadius: 12))
        .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }
}

/// Consumption indicator for allocated transactions
struct ConsumptionIndicator: View {
    let consumption: BudgetFormulas.Consumption

    private var color: Color {
        if consumption.isOverBudget { return .red }
        if consumption.isNearLimit { return .orange }
        return .green
    }

    var body: some View {
        HStack(spacing: 4) {
            CircularProgressView(progress: consumption.percentage / 100, lineWidth: 3)
                .frame(width: 16, height: 16)

            Text(consumption.allocated.asCompactCHF)
                .font(.caption)
                .foregroundStyle(color)
        }
    }
}

#Preview {
    RecurringExpensesList(
        title: "Dépenses récurrentes",
        items: [
            BudgetLine(
                id: "1",
                budgetId: "b1",
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Loyer",
                amount: 1500,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: Date(),
                updatedAt: Date()
            ),
            BudgetLine(
                id: "2",
                budgetId: "b1",
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Salaire",
                amount: 5000,
                kind: .income,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: Date(),
                createdAt: Date(),
                updatedAt: Date()
            )
        ],
        transactions: [],
        onToggle: { _ in },
        onAddTransaction: { _ in }
    )
    .padding()
    .background(Color(.systemGroupedBackground))
}
