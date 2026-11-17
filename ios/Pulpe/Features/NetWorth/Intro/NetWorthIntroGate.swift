import Foundation

/// First-visit gate for the « Mon patrimoine » explainer. The decision lives outside SwiftUI so
/// "show once, only on a settled page" is unit-tested; the `@AppStorage` key lives here so the
/// view and any QA reset share one string.
enum NetWorthIntroGate {
    static let storageKey = "hasSeenNetWorthIntro"

    /// `isLoaded`: the page shows its empty state or its figures, never while loading or failed.
    static func shouldPresentIntro(hasSeen: Bool, isLoaded: Bool) -> Bool {
        !hasSeen && isLoaded
    }
}
