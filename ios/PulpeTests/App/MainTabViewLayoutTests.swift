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

    @Test("Global navigation uses the native four-item tab bar")
    func globalNavigationUsesNativeTabBar() throws {
        let source = try Self.read("Pulpe", "App", "MainTabView.swift")

        #expect(Tab.allCases.count == 4)
        #expect(source.components(separatedBy: "SwiftUI.Tab(").count == 5)
        #expect(source.contains(".tint(Color.pulpePrimary)"))
        #expect(!source.contains("toolbarVisibility(.hidden, for: .tabBar)"))
        #expect(!source.contains("floatingTabBar"))
        #expect(!source.contains("tabBarClearance"))
        #expect(!source.contains("AddTransactionSheet("))
        #expect(!source.contains("actionFAB("))
    }

    @Test("Current Month owns transaction creation")
    func currentMonthOwnsTransactionCreation() throws {
        let source = try Self.read(
            "Pulpe",
            "Features",
            "CurrentMonth",
            "CurrentMonthView.swift"
        )

        #expect(source.contains("case addTransaction"))
        #expect(source.contains("AddTransactionSheet("))
        #expect(source.contains("onAdd: store.addTransaction"))
    }

    @Test("Current Month transaction action fills its declared hit area")
    func currentMonthTransactionActionFillsHitArea() throws {
        let source = try Self.read(
            "Pulpe",
            "Features",
            "CurrentMonth",
            "CurrentMonthView.swift"
        )
        guard let start = source.range(of: #"Button("Ajouter une opération""#),
              let end = source.range(
                  of: #".accessibilityLabel("Ajouter une opération")"#,
                  range: start.upperBound..<source.endIndex
              )
        else {
            Issue.record("Missing Current Month transaction action")
            return
        }

        let action = source[start.lowerBound..<end.upperBound]
        guard let frame = action.range(of: "minHeight: DesignTokens.TapTarget.minimum"),
              let contentShape = action.range(of: ".contentShape(Rectangle())"),
              let pressedStyle = action.range(of: ".plainPressedButtonStyle()")
        else {
            Issue.record("Transaction action must declare its frame, content shape and pressed style")
            return
        }

        #expect(frame.lowerBound < contentShape.lowerBound)
        #expect(contentShape.lowerBound < pressedStyle.lowerBound)
    }
}
