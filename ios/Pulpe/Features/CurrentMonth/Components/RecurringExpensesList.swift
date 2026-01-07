import SwiftUI

/// List of recurring budget lines with consumption tracking
struct RecurringExpensesList: View {
    let title: String
    let items: [BudgetLine]
    let transactions: [Transaction]
    let onToggle: (BudgetLine) -> Void
    let onAddTransaction: (BudgetLine) -> Void
    let onLongPress: (BudgetLine, [Transaction]) -> Void

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
                        allTransactions: transactions,
                        onToggle: { onToggle(item) },
                        onAddTransaction: { onAddTransaction(item) },
                        onLongPress: { linkedTransactions in
                            onLongPress(item, linkedTransactions)
                        }
                    )
                }
            }
            .padding(.horizontal)
        }
    }
}

/// Single budget line row - Clean, Revolut-inspired design
struct BudgetLineRow: View {
    let line: BudgetLine
    let consumption: BudgetFormulas.Consumption
    let allTransactions: [Transaction]
    let onToggle: () -> Void
    let onAddTransaction: () -> Void
    let onLongPress: ([Transaction]) -> Void

    @State private var isPressed = false
    @State private var triggerSuccessFeedback = false
    @State private var triggerWarningFeedback = false

    private var hasConsumption: Bool {
        consumption.allocated > 0
    }

    private var consumptionColor: Color {
        if consumption.isOverBudget { return .red }
        if consumption.isNearLimit { return .orange }
        return .pulpePrimary
    }

    private var linkedTransactions: [Transaction] {
        allTransactions.filter { $0.budgetLineId == line.id }
    }

    private var consumptionPercentage: Int {
        Int(min(consumption.percentage, 999))
    }

    var body: some View {
        VStack(spacing: 0) {
            HStack(spacing: 12) {
                // Check button with animated state
                checkButton

                // Main content
                VStack(alignment: .leading, spacing: 4) {
                    Text(line.name)
                        .font(.system(.body, design: .rounded, weight: .medium))
                        .foregroundStyle(line.isChecked ? .secondary : .primary)
                        .strikethrough(line.isChecked, color: .secondary)
                        .lineLimit(1)

                    // Consumption info (replaces recurrence label when has consumption)
                    if hasConsumption {
                        HStack(spacing: 6) {
                            Text("\(consumptionPercentage)%")
                                .font(.system(.caption, design: .rounded, weight: .semibold))
                                .foregroundStyle(consumptionColor)

                            Text("·")
                                .foregroundStyle(.tertiary)

                            Text("\(consumption.allocated.asCompactCHF) / \(line.amount.asCompactCHF)")
                                .font(.caption)
                                .foregroundStyle(.secondary)
                        }
                    } else {
                        HStack(spacing: 4) {
                            Image(systemName: line.recurrence.icon)
                                .font(.caption2)
                            Text(line.recurrence.label)
                                .font(.caption)
                        }
                        .foregroundStyle(.tertiary)
                    }
                }

                Spacer(minLength: 8)

                // Amount
                Text(line.amount.asCHF)
                    .font(.system(.callout, design: .rounded, weight: .semibold))
                    .foregroundStyle(line.isChecked ? .secondary : line.kind.color)

                // Add button
                if !line.isVirtualRollover {
                    Button(action: onAddTransaction) {
                        Image(systemName: "plus")
                            .font(.system(size: 12, weight: .bold))
                            .foregroundStyle(Color.accentColor)
                            .frame(width: 28, height: 28)
                            .background(Color.accentColor.opacity(0.1))
                            .clipShape(Circle())
                    }
                    .buttonStyle(.plain)
                }
            }
            .padding(.horizontal, 16)
            .padding(.vertical, 14)

            // Consumption progress bar
            if hasConsumption {
                progressBar
            }
        }
        .background(Color(.systemBackground))
        .clipShape(RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.04), radius: 4, y: 2)
        .scaleEffect(isPressed ? 0.97 : 1.0)
        .animation(.spring(duration: 0.25), value: isPressed)
        .onLongPressGesture(
            minimumDuration: 0.4,
            maximumDistance: 10,
            pressing: { pressing in
                withAnimation(.spring(duration: 0.2)) {
                    isPressed = pressing
                }
            },
            perform: handleLongPress
        )
        .sensoryFeedback(.success, trigger: triggerSuccessFeedback)
        .sensoryFeedback(.warning, trigger: triggerWarningFeedback)
    }

    // MARK: - Subviews

    private var checkButton: some View {
        Button(action: onToggle) {
            ZStack {
                Circle()
                    .stroke(line.isChecked ? Color.pulpePrimary : Color(.systemGray4), lineWidth: 2)
                    .frame(width: 26, height: 26)

                if line.isChecked {
                    Circle()
                        .fill(Color.pulpePrimary)
                        .frame(width: 26, height: 26)

                    Image(systemName: "checkmark")
                        .font(.system(size: 12, weight: .bold))
                        .foregroundStyle(.white)
                }
            }
            .animation(.spring(duration: 0.2), value: line.isChecked)
        }
        .buttonStyle(.plain)
        .disabled(line.isVirtualRollover)
        .opacity(line.isVirtualRollover ? 0.4 : 1)
    }

    private var progressBar: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Rectangle()
                    .fill(Color(.systemGray5))

                Rectangle()
                    .fill(consumptionColor)
                    .frame(width: geometry.size.width * CGFloat(min(consumption.percentage / 100, 1)))
                    .animation(.spring(duration: 0.4), value: consumption.percentage)
            }
        }
        .frame(height: 3)
        .clipShape(RoundedRectangle(cornerRadius: 1.5))
    }

    private func handleLongPress() {
        guard !line.isVirtualRollover else { return }

        if linkedTransactions.isEmpty {
            triggerWarningFeedback.toggle()
            withAnimation(.spring(duration: 0.2)) {
                isPressed = false
            }
        } else {
            triggerSuccessFeedback.toggle()
            onLongPress(linkedTransactions)
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
        transactions: [
            Transaction(
                id: "t1",
                budgetId: "b1",
                budgetLineId: "1",
                name: "Loyer janvier",
                amount: 1500,
                kind: .expense,
                transactionDate: Date(),
                category: nil,
                checkedAt: nil,
                createdAt: Date(),
                updatedAt: Date()
            )
        ],
        onToggle: { _ in },
        onAddTransaction: { _ in },
        onLongPress: { _, _ in }
    )
    .padding()
    .background(Color(.systemGroupedBackground))
}
