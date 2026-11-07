import SwiftUI

extension DesignTokens {
    /// Entrée boards (onboarding, auth): a forest zone on top, a light card pulled up over it.
    enum Entry {
        /// Radius of the light card's top corners, and how far it overlaps the zone (V2 `cz`).
        static let cardRadius: CGFloat = 28
        /// Budget ring diameter and stroke (V2 `ring`).
        static let ringSize: CGFloat = 184
        static let ringStroke: CGFloat = 14
        /// Clear space between two ring segments, cap to cap.
        static let ringSegmentGap: CGFloat = 5
        /// Below this step height (iPhone SE, open iPhone Duo) the ring zone would leave the card
        /// too short for its form, so the ring steps keep the one-line summary instead.
        static let ringZoneMinHeight: CGFloat = 700
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
        /// Width cap of a full-screen entry column: on a wide screen (the open iPhone Duo) the
        /// buttons stay a button's width instead of spanning ~575pt.
        static let columnMaxWidth: CGFloat = 480
        /// Centered dialog card (V2 « Clé · consentement »): width cap, icon disc, entrance scale.
        static let dialogMaxWidth: CGFloat = 300
        static let dialogIconDisc: CGFloat = 36
        static let dialogEntranceScale: CGFloat = 0.96
        /// Numbered square of a steps card (V2 « PIN · récupération »).
        static let stepBadge: CGFloat = 28
        /// Width of the welcome mascot: the hero of the screen without pushing the sign-up
        /// buttons below the fold on an iPhone SE.
        static let mascotWidth: CGFloat = 232
        /// How far the mascot drifts up and back while it idles: alive, never bobbing.
        static let mascotFloat: CGFloat = 6
        /// Scale the mascot rises from on entrance (never from zero).
        static let mascotEntranceScale: CGFloat = 0.9
        /// Sparkle glyph and dot sizes around the mascot.
        static let sparkleSize: CGFloat = 14
        static let sparkleDot: CGFloat = 6
        /// Scale a sparkle shrinks to at the low point of its twinkle.
        static let twinkleScale: CGFloat = 0.7
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
