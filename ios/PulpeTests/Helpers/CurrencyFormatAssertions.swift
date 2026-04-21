import Foundation

/// Swiss locales use a grouping separator that historically was ASCII `'` and
/// is now U+2019 (right single quotation mark) in iOS 17+. Accept either so
/// assertions stay resilient across OS versions.
func containsSwissGroupingSeparator(_ formatted: String) -> Bool {
    formatted.contains("'") || formatted.contains("\u{2019}")
}
