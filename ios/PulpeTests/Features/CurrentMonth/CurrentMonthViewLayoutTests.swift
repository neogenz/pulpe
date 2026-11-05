import Foundation
import Testing

struct CurrentMonthViewLayoutTests {
    @Test func loadedDashboardPinsVerticalScrollContentToTheViewportWidth() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/CurrentMonthView+Dashboard.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        // #704: the scroll content is sized to the scroll view's own width, which it measures, so
        // no child can widen the page into a sideways pan (and the width follows a window resize).
        let rootViewportConstraint = #"\n {12}\.frame\(width: viewportWidth\)\n {8}\}"#
            + #"\n {8}\.onGeometryChange\(for: CGFloat\.self, of: \\\.size\.width\) \{ viewportWidth = \$0 \}"#
            + #"\n {8}\.refreshable \{"#
        #expect(source.range(of: rootViewportConstraint, options: .regularExpression) != nil)
    }
}
