import SwiftUI

/// Typography system for Pulpe — uses semantic TextStyles for Dynamic Type scaling
enum PulpeTypography {
    // MARK: - Brand

    static let brandTitle = Font.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle)

    // MARK: - Hero Amounts

    static let amountHero = Font.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle)

    // MARK: - Progress Indicator

    static let progressValue = Font.custom("Manrope-Bold", size: 16, relativeTo: .callout)
    static let progressUnit = Font.custom("DMSans-Medium", size: 11, relativeTo: .caption2)

    // MARK: - Onboarding Headlines

    static let onboardingTitle = Font.custom("Manrope-Bold", size: 28, relativeTo: .title)
    static let onboardingSubtitle = Font.custom("Manrope-Medium", size: 17, relativeTo: .body)

    // MARK: - Step Titles

    static let stepTitle = Font.custom("Manrope-Bold", size: 22, relativeTo: .title2)
    static let stepSubtitle = Font.custom("DMSans-Regular", size: 15, relativeTo: .subheadline)

    // MARK: - Body Text

    static let bodyLarge = Font.custom("DMSans-Regular", size: 17, relativeTo: .body)

    // MARK: - Labels

    static let labelLarge = Font.custom("DMSans-SemiBold", size: 15, relativeTo: .subheadline)
    static let labelMedium = Font.custom("DMSans-Medium", size: 13, relativeTo: .footnote)

    // MARK: - Input Labels

    static let inputLabel = Font.custom("DMSans-SemiBold", size: 15, relativeTo: .subheadline)
    static let inputValue = Font.custom("Manrope-Medium", size: 22, relativeTo: .title2)
    static let inputHelper = Font.custom("DMSans-Medium", size: 12, relativeTo: .caption)

    // MARK: - Tutorial

    static let tutorialTitle = Font.custom("Manrope-Bold", size: 20, relativeTo: .title3)
    static let tutorialBody = Font.custom("DMSans-Regular", size: 15, relativeTo: .subheadline)
    static let tutorialStep = Font.custom("Manrope-SemiBold", size: 13, relativeTo: .footnote)

    // MARK: - Buttons

    static let buttonPrimary = Font.custom("Manrope-SemiBold", size: 17, relativeTo: .body)
    static let buttonSecondary = Font.custom("DMSans-Medium", size: 15, relativeTo: .subheadline)

    // MARK: - Numpad

    static let numpadKey = Font.custom("DMSans-Medium", size: 28, relativeTo: .title)
    static let numpadSubtext = Font.custom("DMSans-Regular", size: 10, relativeTo: .caption2)

    // MARK: - Hero Icons & Emoji

    static let heroIcon = Font.custom("Manrope-Bold", size: 48, relativeTo: .largeTitle)
    static let welcomeEmoji = Font.custom("Manrope-Bold", size: 64, relativeTo: .largeTitle)

    // MARK: - Semantic Aliases (for replacing bare .font() calls)

    static let title = Font.custom("DMSans-SemiBold", size: 28, relativeTo: .title)
    static let title2 = Font.custom("DMSans-SemiBold", size: 22, relativeTo: .title2)
    static let title3 = Font.custom("DMSans-SemiBold", size: 20, relativeTo: .title3)
    static let headline = Font.custom("DMSans-SemiBold", size: 17, relativeTo: .headline)
    static let subheadline = Font.custom("DMSans-Regular", size: 15, relativeTo: .subheadline)
    static let body = Font.custom("DMSans-Regular", size: 17, relativeTo: .body)
    static let callout = Font.custom("DMSans-Regular", size: 16, relativeTo: .callout)
    static let footnote = Font.custom("DMSans-Regular", size: 13, relativeTo: .footnote)
    static let caption = Font.custom("DMSans-Regular", size: 12, relativeTo: .caption)
    static let caption2 = Font.custom("DMSans-Regular", size: 11, relativeTo: .caption2)
}
