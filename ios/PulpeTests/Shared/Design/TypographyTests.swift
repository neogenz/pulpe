@testable import Pulpe
import Testing
import UIKit

struct TypographyTests {
    // MARK: - Font Registration

    /// All custom font PostScript names must resolve to a UIFont, proving the .ttf files
    /// are bundled correctly and registered via UIAppFonts in Info.plist.
    @Test(arguments: [
        "Manrope-Bold",
        "Manrope-SemiBold",
        "Manrope-Medium"
    ])
    func customFont_isRegisteredAndLoadable(postScriptName: String) {
        let font = UIFont(name: postScriptName, size: 17)
        #expect(font != nil, "Font '\(postScriptName)' not found — verify .ttf is bundled and UIAppFonts is configured")
        #expect(font?.fontName == postScriptName)
    }

    // MARK: - Typography Token Existence

    /// PulpeTypography enum must expose all semantic aliases matching SwiftUI text styles.
    /// This prevents accidental deletion of tokens that views depend on.
    @Test func allSemanticAliases_exist() {
        // Brand & hero
        _ = PulpeTypography.brandTitle
        _ = PulpeTypography.amountHero

        // Onboarding
        _ = PulpeTypography.onboardingTitle
        _ = PulpeTypography.onboardingSubtitle

        // Steps
        _ = PulpeTypography.stepTitle
        _ = PulpeTypography.stepSubtitle

        // Body & labels
        _ = PulpeTypography.bodyLarge
        _ = PulpeTypography.labelLarge
        _ = PulpeTypography.labelLargeBold
        _ = PulpeTypography.labelMedium

        // Input
        _ = PulpeTypography.inputLabel
        _ = PulpeTypography.inputValue
        _ = PulpeTypography.inputHelper

        // Buttons
        _ = PulpeTypography.buttonPrimary
        _ = PulpeTypography.buttonSecondary

        // Numpad
        _ = PulpeTypography.numpadKey
        _ = PulpeTypography.numpadSubtext

        // Hero icons & emoji
        _ = PulpeTypography.heroIcon
        _ = PulpeTypography.welcomeEmoji

        // Semantic aliases (used to replace bare .font(.textStyle) calls)
        _ = PulpeTypography.title
        _ = PulpeTypography.title2
        _ = PulpeTypography.title3
        _ = PulpeTypography.headline
        _ = PulpeTypography.subheadline
        _ = PulpeTypography.body
        _ = PulpeTypography.callout
        _ = PulpeTypography.footnote
        _ = PulpeTypography.caption
        _ = PulpeTypography.caption2
    }
}
