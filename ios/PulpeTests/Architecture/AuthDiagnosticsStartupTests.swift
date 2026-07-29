import Foundation
import Testing

@Suite("Auth diagnostics startup invariants")
struct AuthDiagnosticsStartupTests {
    private static func pulpeAppSource() throws -> String {
        let url = URL(fileURLWithPath: #filePath)
            .deletingLastPathComponent() // Architecture/
            .deletingLastPathComponent() // PulpeTests/
            .deletingLastPathComponent() // ios/
            .appendingPathComponent("Pulpe")
            .appendingPathComponent("App")
            .appendingPathComponent("PulpeApp.swift")

        return try String(contentsOf: url, encoding: .utf8)
    }

    @Test("Analytics initializes once before AppState")
    func analyticsInitialization_beforeAppState_occursExactlyOnce() throws {
        let source = try Self.pulpeAppSource()
        let analyticsCall = "AnalyticsService.shared.initialize()"
        let analyticsRange = try #require(source.range(of: analyticsCall))
        let appStateRange = try #require(source.range(of: "let appState = AppState()"))

        #expect(analyticsRange.lowerBound < appStateRange.lowerBound)
        #expect(source[analyticsRange.upperBound...].range(of: analyticsCall) == nil)
    }
}
