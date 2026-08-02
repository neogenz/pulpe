import Foundation
import Testing

@Suite("Budget detail destructive menus")
struct DestructiveMenuStyleTests {
    private static func source(named fileName: String) throws -> String {
        var iosDirectory = URL(fileURLWithPath: #filePath)
        for _ in 0..<5 {
            iosDirectory.deleteLastPathComponent()
        }
        let sourceFile = iosDirectory
            .appendingPathComponent("Pulpe")
            .appendingPathComponent("Features")
            .appendingPathComponent("Budgets")
            .appendingPathComponent("BudgetDetails")
            .appendingPathComponent(fileName)
        return try String(contentsOf: sourceFile, encoding: .utf8)
    }

    @Test(
        "Destructive menu labels use the role-aware system image initializer",
        arguments: ["EditTransactionPage.swift", "BudgetLineDetailPage.swift"]
    )
    func destructiveMenuLabelUsesNativeInitializer(fileName: String) throws {
        let source = try Self.source(named: fileName)

        #expect(source.contains(
            #"Button("Supprimer", systemImage: "trash", role: .destructive) {"#
        ))
    }
}
