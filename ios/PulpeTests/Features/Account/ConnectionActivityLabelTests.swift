import Foundation
@testable import Pulpe
import Testing

/// Every write tool of the agent connector reads as a label in Compte > Connexions,
/// never as its technical name. Locale-independent: the assertion is "not the slug".
struct ConnectionActivityLabelTests {
    private static let writeTools = [
        "add_movement",
        "update_movement",
        "delete_movement",
        "add_forecast",
        "update_forecast",
        "spread_expense",
        "create_month_from_template",
        "toggle_check",
        "create_tag",
        "rename_tag",
        "delete_tag",
        "tag_items",
        "create_template",
        "update_template",
        "delete_template",
        "duplicate_template",
        "edit_template_lines",
        "adjust_over_months"
    ]

    private func entry(_ tool: String, outcome: MCPActivity.Outcome = .ok) -> MCPActivity {
        MCPActivity(tool: tool, outcome: outcome, createdAt: .now)
    }

    @Test("a write tool never shows its technical name", arguments: writeTools)
    @MainActor
    func writeToolHasALabel(tool: String) {
        #expect(ConnectionDetailView.label(for: entry(tool)) != tool)
    }

    @Test("a failed call keeps its label and adds the failure suffix")
    @MainActor
    func failedCallAppendsTheFailureSuffix() {
        let ok = ConnectionDetailView.label(for: entry("delete_movement"))
        let failed = ConnectionDetailView.label(for: entry("delete_movement", outcome: .error))

        #expect(failed != ok)
        #expect(failed.contains(ok))
    }

    @Test("a tool newer than the build falls back to its raw name")
    @MainActor
    func unknownToolFallsBackToItsName() {
        #expect(ConnectionDetailView.label(for: entry("future_tool")) == "future_tool")
    }
}
