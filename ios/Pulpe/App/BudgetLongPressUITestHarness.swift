import SwiftUI

enum UITestLaunchScenario {
    case budgetLongPressWithTransactions
    case budgetLongPressEmpty
    case pul209VerifyMixed
    case pul209VerifyFilterExpense
    case pul209VerifyFilterChecked
    case pul209VerifySheetOpen
    case pul209VerifySheetPointed
    case pul209VerifySheetMenu

    private static let longPressWithTransactionsKey = "UITEST_BUDGET_LONG_PRESS_WITH_TRANSACTIONS"
    private static let longPressEmptyKey = "UITEST_BUDGET_LONG_PRESS_EMPTY"
    private static let pul209MixedKey = "PUL209_VERIFY_MIXED"
    private static let pul209FilterExpenseKey = "PUL209_VERIFY_FILTER_EXPENSE"
    private static let pul209FilterCheckedKey = "PUL209_VERIFY_FILTER_CHECKED"
    private static let pul209SheetOpenKey = "PUL209_VERIFY_SHEET_OPEN"
    private static let pul209SheetPointedKey = "PUL209_VERIFY_SHEET_POINTED"
    private static let pul209SheetMenuKey = "PUL209_VERIFY_SHEET_MENU"
    private static let scenarioEnvironmentKey = "UITEST_SCENARIO"

    static var current: Self? {
        let processInfo = ProcessInfo.processInfo

        if let scenario = processInfo.environment[scenarioEnvironmentKey],
           let resolved = match(scenario) {
            return resolved
        }

        // Argv may carry the key as-is (UI test runner) or dash-prefixed (simctl
        // launch passes `-FOO` directly, which keeps the dash in argv). Try both.
        for argument in processInfo.arguments {
            let normalized = argument.hasPrefix("-") ? String(argument.dropFirst()) : argument
            if let resolved = match(normalized) {
                return resolved
            }
        }

        return nil
    }

    private static func match(_ key: String) -> Self? {
        switch key {
        case longPressWithTransactionsKey: .budgetLongPressWithTransactions
        case longPressEmptyKey: .budgetLongPressEmpty
        case pul209MixedKey: .pul209VerifyMixed
        case pul209FilterExpenseKey: .pul209VerifyFilterExpense
        case pul209FilterCheckedKey: .pul209VerifyFilterChecked
        case pul209SheetOpenKey: .pul209VerifySheetOpen
        case pul209SheetPointedKey: .pul209VerifySheetPointed
        case pul209SheetMenuKey: .pul209VerifySheetMenu
        default: nil
        }
    }

    /// Stable filename written into the app sandbox by `PUL209VerifyHarness`.
    /// The verify script pulls the matching PNG via `simctl get_app_container`.
    var captureName: String {
        switch self {
        case .budgetLongPressWithTransactions: "long-press-with-transactions"
        case .budgetLongPressEmpty: "long-press-empty"
        case .pul209VerifyMixed: "01-mixed"
        case .pul209VerifyFilterExpense: "02-filter-expense"
        case .pul209VerifyFilterChecked: "03-filter-checked"
        case .pul209VerifySheetOpen: "04-sheet-open"
        case .pul209VerifySheetPointed: "05-sheet-pointed"
        case .pul209VerifySheetMenu: "06-sheet-menu"
        }
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
                name: "Prévision avec transactions",
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
                name: "Prévision simple",
                amount: 200,
                kind: .expense,
                recurrence: .fixed,
                isManuallyAdjusted: false,
                checkedAt: nil,
                createdAt: now,
                updatedAt: now
            )
        case .pul209VerifyMixed,
             .pul209VerifyFilterExpense,
             .pul209VerifyFilterChecked,
             .pul209VerifySheetOpen,
             .pul209VerifySheetPointed,
             .pul209VerifySheetMenu:
            BudgetLine(
                id: "pul209-unused",
                budgetId: budgetId,
                templateLineId: nil,
                savingsGoalId: nil,
                name: "",
                amount: 0,
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
        case .budgetLongPressEmpty,
             .pul209VerifyMixed,
             .pul209VerifyFilterExpense,
             .pul209VerifyFilterChecked,
             .pul209VerifySheetOpen,
             .pul209VerifySheetPointed,
             .pul209VerifySheetMenu:
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
