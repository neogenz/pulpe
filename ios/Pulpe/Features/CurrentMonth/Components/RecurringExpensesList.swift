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

            VStack(spacing: 6) {
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

/// Single budget line row - Clean, minimal design
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let onToggle: () -> Void
    let onAddTransaction: () -> Void

    private var hasConsumption: Bool {
        consumption.allocated > 0
    }

    private var consumptionColor: Color {
        if consumption.isOverBudget { return .red }
        if consumption.isNearLimit { return .orange }
        return .green
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 14) {
                // Check button - larger tap target
                Button(action: onToggle) {
                    ZStack {
                        Circle()
                            .stroke(line.isChecked ? Color.green : Color(.systemGray4), lineWidth: 2)
                            .frame(width: 24, height: 24)

                        if line.isChecked {
                            Circle()
                                .fill(Color.green)
                                .frame(width: 24, height: 24)

                            Image(systemName: "checkmark")
                                .font(.system(size: 12, weight: .bold))
                                .foregroundStyle(.white)
                        }
                    }
                }
                .buttonStyle(.plain)
                .disabled(line.isVirtualRollover)
                .opacity(line.isVirtualRollover ? 0.4 : 1)

                // Main content
                VStack(alignment: .leading, spacing: 2) {
                    Text(line.name)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(line.isChecked ? .secondary : .primary)
                        .strikethrough(line.isChecked, color: .secondary)
                        .lineLimit(1)

                    // Subtitle: recurrence indicator
                    HStack(spacing: 4) {
                        Image(systemName: line.recurrence.icon)
                            .font(.caption2)
                        Text(line.recurrence.label)
                            .font(.caption)
                    }
                    .foregroundStyle(.tertiary)
                }

                Spacer(minLength: 8)

                // Amount with optional consumption
                VStack(alignment: .trailing, spacing: 2) {
                    Text(line.amount.asCHF)
                        .font(.system(.body, design: .rounded, weight: .semibold))
                        .foregroundStyle(line.isChecked ? .secondary : line.kind.color)

                    if hasConsumption {
                        Text("\(consumption.allocated.asCompactCHF) utilisé")
                            .font(.caption2)
                            .foregroundStyle(consumptionColor)
                    }
                }

                // Add button - subtle but accessible
                Button(action: onAddTransaction) {
                    Image(systemName: "plus")
                        .font(.system(size: 14, weight: .semibold))
                        .foregroundStyle(Color.accentColor)
                        .frame(width: 28, height: 28)
                        .background(Color.accentColor.opacity(0.12))
                        .clipShape(Circle())
                }
                .buttonStyle(.plain)
                .disabled(line.isVirtualRollover)
                .opacity(line.isVirtualRollover ? 0 : 1)
            }
            .padding(.horizontal, 14)
            .padding(.vertical, 12)

            // Consumption progress bar - only if has consumption
            if hasConsumption {
                GeometryReader { geometry in
                    ZStack(alignment: .leading) {
                        Rectangle()
                            .fill(Color(.systemGray5))

                        Rectangle()
                            .fill(consumptionColor.opacity(0.8))
                            .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                    }
                }
                .frame(height: 3)
            }
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 14))
        .shadow(color: .black.opacity(0.04), radius: 3, y: 1)
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
