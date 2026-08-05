import Foundation
import Testing

@Suite("Budget detail menu styling")
struct DestructiveMenuStyleTests {
    /// Menus that list actions, as opposed to selection menus (month picker,
    /// savings-goal pickers) where a tinted `checkmark` is the system convention.
    private static let actionMenuFiles = [
        "EditTransactionPage.swift",
        "BudgetLineDetailPage.swift",
        "BudgetTypeFilter.swift",
    ]

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

    @Test("Destructive menu entry uses the role-aware initializer and reds its icon")
    func destructiveMenuButtonIsRoleAwareAndTinted() throws {
        let source = try Self.source(named: "DeleteMenuButton.swift")

        // The role reds the title; without the tint the SF Symbol keeps the
        // ambient colour and the trash sits black beside a red label.
        #expect(source.contains(
            #"Button("Supprimer", systemImage: "trash", role: .destructive) {"#
        ))
        #expect(source.contains(".tint(Color.destructivePrimary)"))
    }

    @Test(
        "Header menus delegate deletion to the shared entry",
        arguments: ["EditTransactionPage.swift", "BudgetLineDetailPage.swift"]
    )
    func headerMenusUseSharedDeleteEntry(fileName: String) throws {
        let source = try Self.source(named: fileName)

        #expect(source.contains("DeleteMenuButton {"))
        // An inlined copy would drift away from the shared tint.
        #expect(!source.contains(#"Button("Supprimer", systemImage: "trash""#))
    }

    @Test(
        "Action menus neutralize the app tint so icons match their titles",
        arguments: actionMenuFiles
    )
    func actionMenusApplyMenuContentStyling(fileName: String) throws {
        let source = try Self.source(named: fileName)

        // `MainTabView` tints the app green; SwiftUI paints menu icons with it
        // while leaving titles at the label colour.
        #expect(source.contains(".pulpeMenuContent()"))
    }
}
