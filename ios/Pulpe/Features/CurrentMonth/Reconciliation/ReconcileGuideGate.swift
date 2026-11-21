import Foundation

/// First-open gate for the « Comparer avec mes comptes » guide. The decision lives outside
/// SwiftUI so "show once" is unit-tested; the `@AppStorage` key lives here so the sheet and any
/// QA reset share one string. The flag is per device and set whatever the exit.
enum ReconcileGuideGate {
    static let storageKey = "hasSeenReconcileGuide"

    static func shouldPresent(hasSeen: Bool) -> Bool { !hasSeen }
}
