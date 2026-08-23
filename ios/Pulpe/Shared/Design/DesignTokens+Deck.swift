import SwiftUI

extension DesignTokens {
    /// Motion grammar of a paged card deck (home quick-check): the neighbouring cards
    /// peek at the screen edges as tickets tucked behind the focused one, and turn away
    /// as the deck rotates.
    enum Deck {
        /// Gap between two slots: a sliver, so each neighbour peeks in the page gutter
        /// and says the deck slides; the « 1 / 4 » position says how far.
        static let slotGap: CGFloat = Spacing.xs
        /// How much a fully tucked neighbour shrinks (scale = 1 − drop), anchored on its
        /// inner edge so the peek width survives the shrink.
        static let tuckScaleDrop: CGFloat = 0.1
        /// Perspective turn of a fully tucked neighbour around the vertical axis, in
        /// degrees — the cue that the deck rotates rather than slides.
        static let turnDegrees: Double = 8
        /// How far a fully tucked neighbour fades (opacity = 1 − fade): one step behind
        /// the focused card, still legible as a card.
        static let tuckFade: Double = 0.35
    }
}
