import SwiftUI

extension DesignTokens {
    /// Entrée boards (onboarding, auth): a forest zone on top, a light card pulled up over it.
    enum Entry {
        /// Radius of the light card's top corners, and how far it overlaps the zone (V2 `cz`).
        static let cardRadius: CGFloat = 28
        /// Budget ring diameter and stroke (V2 `ring`).
        static let ringSize: CGFloat = 184
        static let ringStroke: CGFloat = 14
        /// Overflow arc around the ring on "À combler".
        static let ringOverflowGap: CGFloat = 12
        static let ringOverflowStroke: CGFloat = 6
        /// Segment of the step progress bar.
        static let progressSegmentHeight: CGFloat = 4
        /// Amount box beside a label (V2 `onb-amt`).
        static let amountBoxHeight: CGFloat = 38
        static let amountBoxRadius: CGFloat = 10
        /// Main amount field of the income step (V2 `amt-lg`).
        static let amountFieldHeight: CGFloat = 64
        /// Round icon disc of a status screen or sheet header.
        static let iconDisc: CGFloat = 52
        /// Centered dialog card (V2 « Clé · consentement »): width cap, icon disc, entrance scale.
        static let dialogMaxWidth: CGFloat = 300
        static let dialogIconDisc: CGFloat = 36
        static let dialogEntranceScale: CGFloat = 0.96
        /// Numbered square of a steps card (V2 « PIN · récupération »).
        static let stepBadge: CGFloat = 28
        /// Welcome stickers.
        static let stickerRadius: CGFloat = 14
    }
}

extension PulpeTypography {
    /// Question of an onboarding card (V2 `cz h1`): Manrope 800 26.
    static let entryTitle = Font.custom("Manrope", size: 26, relativeTo: .title).weight(.heavy)
    /// Live greeting in the zone (V2): Manrope 800 56.
    static let entryGreeting = Font.custom("Manrope", size: 56, relativeTo: .largeTitle).weight(.heavy)
    /// Amount inside the ring (V2): Manrope 800 32.
    static let ringAmount = Font.custom("Manrope", size: 32, relativeTo: .title).weight(.heavy).monospacedDigit()
}
