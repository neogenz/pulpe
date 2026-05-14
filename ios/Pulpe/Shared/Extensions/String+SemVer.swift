import Foundation

extension String {
    /// Compare two `MAJOR.MINOR.PATCH` strings numerically.
    ///
    /// Uses `String.compare(_:options:)` with `.numeric` so `"1.0.10"` is correctly
    /// treated as greater than `"1.0.2"` (lexicographic compare would say the opposite).
    /// Non-numeric segments fall back to standard ordering — safe for the strict
    /// semver-shaped values served by the backend `appVersionResponseSchema`.
    func isSemVerBelow(_ other: String) -> Bool {
        compare(other, options: .numeric) == .orderedAscending
    }
}
