import SwiftUI

/// Typography system for Pulpe
///
/// - **Manrope**: titles, hero amounts, brand elements
/// - **DM Sans**: prominent brand labels only
/// - **System (SF Pro)**: body text, captions, amounts, general UI
enum PulpeTypography {
    // MARK: - Brand Titles (Manrope)

    static let brandTitle = Font.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle)
    static let amountHero = Font.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle)
    static let progressValue = Font.custom("Manrope-Bold", size: 16, relativeTo: .callout)
    static let onboardingTitle = Font.custom("Manrope-Bold", size: 28, relativeTo: .title)
    static let onboardingSubtitle = Font.custom("Manrope-Medium", size: 17, relativeTo: .body)
    static let stepTitle = Font.custom("Manrope-Bold", size: 22, relativeTo: .title2)
    static let tutorialTitle = Font.custom("Manrope-Bold", size: 20, relativeTo: .title3)
    static let tutorialStep = Font.custom("Manrope-SemiBold", size: 13, relativeTo: .footnote)
    static let heroIcon = Font.custom("Manrope-Bold", size: 48, relativeTo: .largeTitle)
    static let welcomeEmoji = Font.custom("Manrope-Bold", size: 64, relativeTo: .largeTitle)
    static let buttonPrimary = Font.custom("Manrope-SemiBold", size: 17, relativeTo: .body)
    static let inputValue = Font.custom("Manrope-Medium", size: 22, relativeTo: .title2)
    static let amountLarge = Font.custom("Manrope-Bold", size: 28, relativeTo: .title)
    static let amountMedium = Font.custom("Manrope-SemiBold", size: 16, relativeTo: .callout)

    // MARK: - Labels

    static let labelLarge: Font = .system(.subheadline, weight: .semibold)
    static let labelLargeBold: Font = .system(.subheadline, weight: .bold)

    // MARK: - System (SF Pro)

    static let stepSubtitle: Font = .subheadline
    static let bodyLarge: Font = .body
    static let labelMedium: Font = .system(.footnote, weight: .medium)
    static let inputLabel: Font = .system(.subheadline, weight: .semibold)
    static let inputHelper: Font = .system(.caption, weight: .medium)
    static let tutorialBody: Font = .subheadline
    static let tabLabel: Font = .system(.caption2, weight: .medium)
    static let buttonSecondary: Font = .system(.subheadline, weight: .medium)
    static let numpadKey: Font = .system(.title, weight: .medium)
    static let numpadSubtext: Font = .caption2
    static let progressUnit: Font = .system(.caption2, weight: .medium)

    // MARK: - Semantic Aliases (System)

    static let title: Font = .system(.title, weight: .semibold)
    static let title2: Font = .system(.title2, weight: .semibold)
    static let title3: Font = .system(.title3, weight: .semibold)
    static let headline: Font = .headline
    static let subheadline: Font = .subheadline
    static let body: Font = .body
    static let callout: Font = .callout
    static let footnote: Font = .footnote
    static let caption: Font = .caption
    static let caption2: Font = .caption2
}
