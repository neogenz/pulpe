import SwiftUI

enum UITestLaunchScenario {
    case budgetLongPressWithTransactions
    case budgetLongPressEmpty

    private static let longPressWithTransactionsKey = "UITEST_BUDGET_LONG_PRESS_WITH_TRANSACTIONS"
    private static let longPressEmptyKey = "UITEST_BUDGET_LONG_PRESS_EMPTY"
    private static let scenarioEnvironmentKey = "UITEST_SCENARIO"

    static var current: Self? {
        let processInfo = ProcessInfo.processInfo

        if let scenario = processInfo.environment[scenarioEnvironmentKey] {
            switch scenario {
            case longPressWithTransactionsKey:
                return .budgetLongPressWithTransactions
            case longPressEmptyKey:
                return .budgetLongPressEmpty
            default:
                break
            }
        }

        let arguments = processInfo.arguments

        if arguments.contains(longPressWithTransactionsKey) {
            return .budgetLongPressWithTransactions
        }

        if arguments.contains(longPressEmptyKey) {
            return .budgetLongPressEmpty
        }

        return nil
    }
}

struct BudgetLongPressUITestHarness: View {
    let scenario: UITestLaunchScenario
    @State private var linkedTransactionsContext: LinkedTransactionsContext?

    private let budgetId = "budget-ui-test"
    private var now: Date { Date() }

    private var budgetLine: BudgetLine {
        switch scenario {
        case .budgetLongPressWithTransactions:
            BudgetLine(
                id: "with-transactions",
                budgetId: budgetId,
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Enveloppe avec transactions",
                amount: 250,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: now,
                updatedAt: now
            )
        case .budgetLongPressEmpty:
            BudgetLine(
                id: "empty",
                budgetId: budgetId,
                templateLineId: nil,
                savingsGoalId: nil,
                name: "Enveloppe vide",
                amount: 200,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: now,
                updatedAt: now
            )
        }
    }

    private var transactions: [Transaction] {
        switch scenario {
        case .budgetLongPressWithTransactions:
            [
                Transaction(
                    id: "tx-with-linked",
                    budgetId: budgetId,
                    budgetLineId: "with-transactions",
                    name: "Dépense liée",
                    amount: 42,
                    kind: .expense,
                    transactionDate: now,
                    category: nil,
                    checkedAt: nil,
                    createdAt: now,
                    updatedAt: now
                ),
            ]
        case .budgetLongPressEmpty:
            []
        }
    }

    var body: some View {
        NavigationStack {
            List {
                BudgetSection(
                    title: "UI Test",
                    items: [budgetLine],
                    transactions: transactions,
                    syncingIds: [],
                    onToggle: { _ in },
                    onDelete: { _ in },
                    onAddTransaction: { _ in },
                    onLongPress: { line, linkedTransactions in
                        linkedTransactionsContext = LinkedTransactionsContext(
                            budgetLine: line,
                            transactions: linkedTransactions
                        )
                    },
                    onEdit: { _ in }
                )
            }
            .listStyle(.insetGrouped)
            .navigationTitle("Long Press")
        }
        .sheet(item: $linkedTransactionsContext) { context in
            LinkedTransactionsSheet(
                budgetLine: context.budgetLine,
                transactions: context.transactions,
                onToggle: { _ in },
                onEdit: { _ in },
                onDelete: { _ in },
                onAddTransaction: {}
            )
        }
    }
}
