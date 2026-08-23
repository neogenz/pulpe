import Foundation
import Testing

/// The Form Rule (ios/DESIGN.md): the six add/edit forms stack the same blocks, and the
/// atoms inside a `FormCard` wear the row style rather than their own surface.
@Suite struct FormRowStyleTests {
    private static let forms = [
        "Features/CurrentMonth/Components/AddTransactionSheet.swift",
        "Features/Budgets/BudgetDetails/AddBudgetLineSheet.swift",
        "Features/Budgets/BudgetDetails/AddAllocatedTransactionPage.swift",
        "Features/Budgets/BudgetDetails/EditTransactionPage.swift",
        "Features/Templates/TemplateDetails/EditTemplateLineSheet.swift",
        "Shared/Components/EditBudgetLineSheet.swift"
    ]

    /// A form's source plus its `+Form` companion when the LOC budget forced a split.
    private static func source(_ relativePath: String) throws -> String {
        let root = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
            .deletingLastPathComponent()
        let url = root.appendingPathComponent("Pulpe/\(relativePath)")
        let companion = url.deletingPathExtension().appendingPathExtension("swift")
            .path.replacingOccurrences(of: ".swift", with: "+Form.swift")
        let main = try String(contentsOf: url, encoding: .utf8)
        let extra = (try? String(contentsOfFile: companion, encoding: .utf8)) ?? ""
        return main + extra
    }

    @Test(arguments: forms)
    func form_groupsItsFieldsInCards(_ path: String) throws {
        let source = try Self.source(path)
        #expect(source.contains("FormCard {"), "\(path) should group its fields in a FormCard")
        #expect(!source.contains("TagPickerField(selection: $selectedTagIds)"), "\(path): tags are a row")
        #expect(source.contains("field: .description,\n            style: .row"), "\(path): description is a row")
    }

    @Test(arguments: forms)
    func form_hasNoStandaloneDetailAtom(_ path: String) throws {
        let source = try Self.source(path)
        let standalone = ["CheckedToggle(", "TransactionDateSelector(", "SavingsGoalPickerField("]
            .flatMap { atom in source.components(separatedBy: atom).dropFirst().map { atom + $0.prefix(400) } }
            .filter { !$0.contains("style: .row") && !$0.contains("style: style") }
        #expect(standalone.isEmpty, "\(path): \(standalone.map { String($0.prefix(60)) })")
    }

    @Test func savingsGoalPicker_rowStyleDropsTheEyebrowAndReadsAsOneRow() throws {
        let source = try Self.source("Shared/Components/SavingsGoalPickerField.swift")
        #expect(source.contains("var style: FormRowStyle = .standalone"))
        #expect(source.contains("if style == .standalone {"))
        let chrome = try Self.source("Shared/Components/SavingsGoalFieldChrome.swift")
        #expect(chrome.contains("minHeight: DesignTokens.ListRow.minHeight"))
        #expect(chrome.contains("chevron.right"))
    }
}
