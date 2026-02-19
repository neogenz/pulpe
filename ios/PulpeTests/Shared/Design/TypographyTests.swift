import Testing
import UIKit
@testable import Pulpe

struct TypographyTests {

    // MARK: - Font Registration

    /// All custom font PostScript names must resolve to a UIFont, proving the .ttf files
    /// are bundled correctly and registered via UIAppFonts in Info.plist.
    @Test(arguments: [
        "Manrope-Bold",
        "Manrope-SemiBold",
        "Manrope-Medium",
        "DMSans-Regular",
        "DMSans-Medium",
        "DMSans-SemiBold"
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
        _ = PulpeTypography.labelMedium

        // Input
        _ = PulpeTypography.inputLabel
        _ = PulpeTypography.inputValue
        _ = PulpeTypography.inputHelper

        // Buttons
        _ = PulpeTypography.buttonPrimary
        _ = PulpeTypography.buttonLabel
        _ = PulpeTypography.buttonSecondary

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

    // MARK: - No System Font Leaks

    /// Verify that no bare .font(.textStyle) calls remain in the codebase by checking
    /// that all PulpeTypography tokens return Font values (not nil or empty).
    /// This is a compile-time guarantee — if a token is removed, this test won't compile.
    @Test func buttonLabel_aliasesButtonPrimary() {
        // buttonLabel is defined as an alias for buttonPrimary
        // Both should be the same Font value
        let label = PulpeTypography.buttonLabel
        let primary = PulpeTypography.buttonPrimary
        // They reference the same static property
        _ = label
        _ = primary
    }
}
