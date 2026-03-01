import SwiftUI

extension View {
    /// Track a screen view when the view appears.
    func trackScreen(_ name: String, properties: [String: Any] = [:]) -> some View {
        onAppear {
            AnalyticsService.shared.screen(name, properties: properties)
        }
    }
}
