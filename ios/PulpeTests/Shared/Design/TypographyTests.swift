@testable import Pulpe
import Testing
import UIKit

struct TypographyTests {
    // MARK: - Font Registration

    /// All custom font PostScript names must resolve to a UIFont, proving the .ttf files
    /// are bundled correctly and registered via UIAppFonts in Info.plist.
    @Test(arguments: [
        "Manrope-Bold"
    ])
    func customFont_isRegisteredAndLoadable(postScriptName: String) {
        let font = UIFont(name: postScriptName, size: 17)
        #expect(font != nil, "Font '\(postScriptName)' not found — verify .ttf is bundled and UIAppFonts is configured")
        #expect(font?.fontName == postScriptName)
    }

    // MARK: - Typography Token Existence

    /// Prevents accidental deletion of feature-specific typography tokens.
    @Test func featureTokens_exist() {
        _ = PulpeTypography.brandTitle
        _ = PulpeTypography.amountHero
        _ = PulpeTypography.amountLarge
        _ = PulpeTypography.amountMedium
        _ = PulpeTypography.progressValue
        _ = PulpeTypography.progressUnit
        _ = PulpeTypography.onboardingTitle
        _ = PulpeTypography.onboardingSubtitle
        _ = PulpeTypography.stepTitle
        _ = PulpeTypography.stepSubtitle
        _ = PulpeTypography.tutorialTitle
        _ = PulpeTypography.tutorialBody
        _ = PulpeTypography.tutorialStep
        _ = PulpeTypography.bodyLarge
        _ = PulpeTypography.labelLarge
        _ = PulpeTypography.labelLargeBold
        _ = PulpeTypography.labelMedium
        _ = PulpeTypography.amountHeroLight
        _ = PulpeTypography.amountDisplayLarge
        _ = PulpeTypography.previewAmount
        _ = PulpeTypography.amountXL
        _ = PulpeTypography.emojiDisplay
        _ = PulpeTypography.cardTitle
        _ = PulpeTypography.sectionIcon
        _ = PulpeTypography.actionIcon
        _ = PulpeTypography.listRowTitle
        _ = PulpeTypography.listRowSubtitle
        _ = PulpeTypography.detailLabel
        _ = PulpeTypography.detailLabelBold
        _ = PulpeTypography.metricLabel
        _ = PulpeTypography.metricLabelBold
        _ = PulpeTypography.metricMini
        _ = PulpeTypography.inputLabel
        _ = PulpeTypography.inputValue
        _ = PulpeTypography.inputHelper
        _ = PulpeTypography.buttonPrimary
        _ = PulpeTypography.buttonSecondary
        _ = PulpeTypography.tabLabel
        _ = PulpeTypography.numpadKey
        _ = PulpeTypography.numpadSubtext
        _ = PulpeTypography.heroIcon
        _ = PulpeTypography.welcomeEmoji
    }

    /// Prevents accidental deletion of semantic alias tokens.
    @Test func semanticAliases_exist() {
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
