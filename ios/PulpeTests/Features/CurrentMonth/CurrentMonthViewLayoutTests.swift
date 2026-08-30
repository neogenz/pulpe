import Foundation
import Testing

struct CurrentMonthViewLayoutTests {
    @Test func loadedDashboardPinsVerticalScrollContentToTheViewportWidth() throws {
        let sourceFile = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .deletingLastPathComponent()
            .appending(path: "Pulpe/Features/CurrentMonth/CurrentMonthView.swift")
        let source = try String(contentsOf: sourceFile, encoding: .utf8)

        let rootViewportConstraint =
            #"\n {16}\}\n {16}\.containerRelativeFrame\(\.horizontal\)\n {12}\}\n {12}\.refreshable \{"#
        #expect(source.range(of: rootViewportConstraint, options: .regularExpression) != nil)
    }
}
