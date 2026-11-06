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

        // #704: the scroll content is sized to the width the reader is offered, so no child can
        // widen the page into a sideways pan, and nothing kept in state outlives a resize (the
        // iPhone Duo closing).
        let rootViewportConstraint = #"GeometryReader \{ geometry in\n {12}ScrollView \{"#
            + #"[\s\S]*?\n {16}\.frame\(width: geometry\.size\.width\)\n {12}\}"#
        #expect(source.range(of: rootViewportConstraint, options: .regularExpression) != nil)
        #expect(!source.contains("viewportWidth"))
    }
}
