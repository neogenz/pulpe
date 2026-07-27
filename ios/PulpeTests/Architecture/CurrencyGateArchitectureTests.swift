import Foundation
import Testing

@Suite("Currency gate architecture invariants")
struct CurrencyGateArchitectureTests {
    private static let creationFormPaths = [
        "Features/Budgets/BudgetDetails/AddAllocatedTransactionPage.swift",
        "Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift",
        "Features/Budgets/BudgetDetails/SavingsWithdrawal/SavingsWithdrawalSheet.swift",
        "Features/CurrentMonth/Components/AddTransactionSheet.swift",
    ]

    private static func sourceDirectory() -> URL {
        URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Architecture/
            .deletingLastPathComponent() // PulpeTests/
            .deletingLastPathComponent() // ios/
            .appendingPathComponent("Pulpe")
    }

    @Test("Creation forms use the user preference without a feature gate")
    func creationFormsUseSelectorPreferenceDirectly() throws {
        for path in Self.creationFormPaths {
            let url = Self.sourceDirectory().appendingPathComponent(path)
            let source = try String(contentsOf: url, encoding: .utf8)

            #expect(
                source.contains("if userSettingsStore.showCurrencySelector {"),
                "\(path) must use showCurrencySelector directly"
            )
        }
    }
}
