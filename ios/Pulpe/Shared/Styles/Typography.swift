import SwiftUI

/// Typography system for Pulpe
///
/// - **Manrope**: true title and brand tokens only
/// - **System (SF Pro)**: all content, labels, captions, buttons, and amounts
///
/// Exceptions outside this file are limited to:
/// - Functional monospaced text (recovery keys, codes, tabular values)
/// - SF Symbols sizing on `Image(systemName:)`
/// - Technical accessibility/rendering cases that cannot be expressed with an existing token
enum PulpeTypography {
    // MARK: - Brand Titles (Manrope)

    static let brandTitle = Font.custom("Manrope-Bold", size: 34, relativeTo: .largeTitle)
    static let onboardingTitle = Font.custom("Manrope-Bold", size: 28, relativeTo: .title)
    static let stepTitle = Font.custom("Manrope-Bold", size: 22, relativeTo: .title2)
    static let tutorialTitle = Font.custom("Manrope-Bold", size: 20, relativeTo: .title3)
    static let heroIcon = Font.custom("Manrope-Bold", size: 48, relativeTo: .largeTitle)
    static let welcomeEmoji = Font.custom("Manrope-Bold", size: 64, relativeTo: .largeTitle)

    // MARK: - Labels

    static let labelLarge: Font = .system(.subheadline, weight: .semibold)
    static let labelLargeBold: Font = .system(.subheadline, weight: .bold)

    // MARK: - Display / Amount

    static let amountHeroLight: Font = .system(size: 44, weight: .light)
    static let amountDisplayLarge: Font = .system(size: 32)
    static let previewAmount: Font = .system(size: 28, weight: .medium)
    static let amountXL: Font = .system(size: 24, weight: .medium)
    static let emojiDisplay: Font = .system(size: 48)

    // MARK: - Card / Section

    static let cardTitle: Font = .system(size: 18, weight: .semibold)
    static let sectionIcon: Font = .system(size: 22, weight: .medium)
    static let actionIcon: Font = .system(size: 20, weight: .semibold)

    // MARK: - List Row

    static let listRowTitle: Font = .system(size: 16, weight: .semibold)
    static let listRowSubtitle: Font = .system(.callout, weight: .regular)

    // MARK: - Detail / Metric Labels

    static let detailLabel: Font = .system(size: 12, weight: .semibold)
    static let detailLabelBold: Font = .system(size: 12, weight: .bold)
    static let metricLabel: Font = .system(size: 13, weight: .semibold)
    static let metricLabelBold: Font = .system(size: 13, weight: .bold)
    static let heroMetric: Font = .system(size: 14, weight: .semibold)
    static let metricMini: Font = .system(size: 10, weight: .semibold)

    // MARK: - System (SF Pro)

    static let stepSubtitle: Font = .subheadline
    static let bodyLarge: Font = .body
    static let labelMedium: Font = .system(.footnote, weight: .medium)
    static let progressValue: Font = .system(.callout, weight: .bold)
    static let amountHero: Font = .system(.largeTitle, weight: .bold)
    static let onboardingSubtitle: Font = .body
    static let inputLabel: Font = .system(.subheadline, weight: .semibold)
    static let inputValue: Font = .system(.title2, weight: .medium)
    static let inputHelper: Font = .system(.caption, weight: .medium)
    static let tutorialBody: Font = .subheadline
    static let tutorialStep: Font = .system(.footnote, weight: .semibold)
    static let tabLabel: Font = .system(.caption2, weight: .medium)
    static let amountLarge: Font = .system(.title, weight: .bold)
    static let amountMedium: Font = .system(.callout, weight: .semibold)
    static let buttonPrimary: Font = .system(.body, weight: .semibold)
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
