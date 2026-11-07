import SwiftUI

extension DesignTokens {
    /// Leading disc of a `TodoRow`.
    enum TodoRow {
        static let disc: CGFloat = 40
    }
}

extension DesignTokens.IconSize {
    /// Disc heading a status card (empty month, recap).
    static let statusDisc: CGFloat = 56
}

extension DesignTokens.Control {
    /// Disc of a status shown in a sheet (optional update, feedback).
    static let statusDiscCompact: CGFloat = 64
    /// Glyph-to-disc ratio of a status disc (full-screen or compact).
    static let statusGlyphRatio: CGFloat = 0.4
    /// Glyph inside the empty-state disc.
    static let emptyGlyph: CGFloat = 26
}
