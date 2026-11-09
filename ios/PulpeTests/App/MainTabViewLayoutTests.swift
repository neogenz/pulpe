import Foundation
@testable import Pulpe
import Testing

@Suite("MainTabView navigation ownership")
struct MainTabViewNavigationOwnershipTests {
    private static func iosSource(_ components: [String]) -> URL {
        var url = URL(fileURLWithPath: #filePath)
        url = url.deletingLastPathComponent() // App/
        url = url.deletingLastPathComponent() // PulpeTests/
        url = url.deletingLastPathComponent() // ios/
        return components.reduce(url) { $0.appendingPathComponent($1) }
    }

    private static func read(_ components: String...) throws -> String {
        try String(contentsOf: iosSource(components), encoding: .utf8)
    }

    @Test("Global navigation uses the native tab bar, Patrimoine behind its flag")
    func globalNavigationUsesNativeTabBar() throws {
        let source = try Self.read("Pulpe", "App", "MainTabView.swift")

        #expect(Tab.allCases.count == 5)
        #expect(source.components(separatedBy: "SwiftUI.Tab(").count == 6)
        #expect(source.contains("if featureFlags.isNetWorthEnabled {"))
        #expect(source.contains(".tint(Color.pulpePrimary)"))
        #expect(!source.contains("toolbarVisibility(.hidden, for: .tabBar)"))
        #expect(!source.contains("floatingTabBar"))
        #expect(!source.contains("tabBarClearance"))
        // V2: one global add button on the root screens, solid green, hosted by the shell.
        #expect(source.contains(".floatingAddFlow("))
        #expect(source.contains("isVisible: showsFloatingAddButton"))
        let addFlow = try Self.read("Pulpe", "App", "FloatingAddFlow.swift")
        #expect(addFlow.contains("FloatingAddButton {"))
    }

    @Test("Current Month owns transaction creation")
    func currentMonthOwnsTransactionCreation() throws {
        let source = try ["CurrentMonthView.swift", "CurrentMonthView+SavingsWithdrawal.swift"]
            .map { try Self.read("Pulpe", "Features", "CurrentMonth", $0) }
            .joined()

        #expect(source.contains("case addTransaction"))
        #expect(source.contains("MovementSheet("))
        #expect(source.contains("onAdd: store.addTransaction"))
    }
}
