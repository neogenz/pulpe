import SwiftUI

/// Typography system for Pulpe
///
/// - **Manrope**: brand titles + financial amounts (bold/extrabold)
/// - **System (SF Pro)**: all content, labels, captions, buttons
///
/// Exceptions outside this file are limited to:
/// - Functional monospaced text (recovery keys, codes, tabular values)
/// - SF Symbols sizing on `Image(systemName:)`
/// - Technical accessibility/rendering cases that cannot be expressed with an existing token
enum PulpeTypography {
    // MARK: - Brand Titles (Manrope Bold)

    static let brandTitle = Font.custom("Manrope", size: 34, relativeTo: .largeTitle).weight(.bold)
    static let onboardingTitle = Font.custom("Manrope", size: 28, relativeTo: .title).weight(.bold)
    static let stepTitle = Font.custom("Manrope", size: 22, relativeTo: .title2).weight(.bold)
    static let tutorialTitle = Font.custom("Manrope", size: 20, relativeTo: .title3).weight(.bold)

    // MARK: - Display (Manrope ExtraBold — large decorative/hero)

    /// Year display number in budget list (72pt)
    static let displayYear = Font.custom("Manrope", size: 72, relativeTo: .largeTitle).weight(.heavy)
    /// Hero icon / year recap amount (48pt)
    static let heroIcon = Font.custom("Manrope", size: 48, relativeTo: .largeTitle).weight(.heavy)
    /// Welcome/onboarding hero text (64pt)
    static let welcomeEmoji = Font.custom("Manrope", size: 64, relativeTo: .largeTitle).weight(.bold)

    // MARK: - Financial Amounts (Manrope ExtraBold — hero numbers)

    static let amountHero = Font.custom("Manrope", size: 34, relativeTo: .largeTitle).weight(.heavy)
    static let amountDisplayLarge = Font.custom("Manrope", size: 32, relativeTo: .largeTitle).weight(.heavy)
    static let amountLarge = Font.custom("Manrope", size: 28, relativeTo: .title).weight(.heavy)
    static let previewAmount = Font.custom("Manrope", size: 28, relativeTo: .title).weight(.bold)
    static let amountXL = Font.custom("Manrope", size: 24, relativeTo: .title2).weight(.heavy)
    static let amountCard = Font.custom("Manrope", size: 20, relativeTo: .title3).weight(.heavy)

    // MARK: - Display / Amount (SF Pro — auxiliary)

    static let amountHeroLight: Font = .system(size: 44, weight: .light)
    static let amountMedium: Font = .system(.callout, weight: .semibold)
    static let emojiDisplay: Font = .system(size: 48)

    // MARK: - Labels

    static let labelLarge: Font = .system(.subheadline, weight: .semibold)
    static let labelLargeBold: Font = .system(.subheadline, weight: .bold)

    // MARK: - Card / Section

    static let cardTitle: Font = .system(.headline, weight: .semibold)
    static let sectionIcon: Font = .system(.title2, weight: .medium)
    static let actionIcon: Font = .system(.title3, weight: .semibold)

    // MARK: - List Row

    static let listRowTitle: Font = .system(.body, weight: .semibold)
    static let listRowSubtitle: Font = .system(.callout, weight: .regular)

    // MARK: - Detail / Metric Labels

    static let detailLabel: Font = .system(.caption, weight: .semibold)
    static let detailLabelBold: Font = .system(.caption, weight: .bold)
    static let metricLabel: Font = .system(.footnote, weight: .semibold)
    static let metricLabelBold: Font = .system(.footnote, weight: .bold)
    static let metricMini: Font = .system(.caption2, weight: .semibold)

    // MARK: - System (SF Pro)

    static let stepSubtitle: Font = .subheadline
    static let bodyLarge: Font = .body
    static let labelMedium: Font = .system(.footnote, weight: .medium)
    static let progressValue: Font = .system(.callout, weight: .bold)
    static let onboardingSubtitle: Font = .body
    static let inputLabel: Font = .system(.subheadline, weight: .semibold)
    static let inputValue: Font = .system(.title2, weight: .medium)
    static let inputHelper: Font = .system(.caption, weight: .medium)
    static let tutorialBody: Font = .subheadline
    static let tutorialStep: Font = .system(.footnote, weight: .semibold)
    static let tabLabel: Font = .system(.caption2, weight: .medium)
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
