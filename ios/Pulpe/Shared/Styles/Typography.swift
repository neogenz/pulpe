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
    // MARK: - V2 roles (ds.css: tabular digits on every amount)

    /// Hero figure (Manrope 800, 52pt, tracking `DesignTokens.Tracking.heroV2`).
    static let heroAmount = Font.custom("Manrope", size: 52, relativeTo: .largeTitle).weight(.heavy).monospacedDigit()
    /// Currency suffix beside the hero figure: 0.42em, ink2, bold.
    static let heroCurrencySuffix = Font.custom("Manrope", size: 22, relativeTo: .largeTitle).weight(.bold)
    /// Big figure (Manrope 800, 36pt).
    static let bigAmount = Font.custom("Manrope", size: 36, relativeTo: .largeTitle).weight(.heavy).monospacedDigit()
    static let bigCurrencySuffix = Font.custom("Manrope", size: 15, relativeTo: .largeTitle).weight(.bold)
    /// Mid figure (Manrope 800, 22pt).
    static let midAmount = Font.custom("Manrope", size: 22, relativeTo: .title2).weight(.heavy).monospacedDigit()
    static let midCurrencySuffix = Font.custom("Manrope", size: 13, relativeTo: .title2).weight(.bold)
    /// Large title of a root screen (SF 34 bold).
    static let pageTitle: Font = .system(.largeTitle, weight: .bold)
    /// Subtitle under a large title (15pt).
    static let pageSubtitle: Font = .subheadline
    /// Title of an empty state or a status screen (20pt bold).
    static let statusTitle: Font = .system(.title3, weight: .bold)
    /// Row title (16pt semibold).
    static let rowTitle: Font = .system(.callout, weight: .semibold)
    /// Value line of a settings row and a form line (16pt regular).
    static let rowTitleRegular: Font = .system(.callout)
    /// Trailing amount of a row (Manrope 700, 16pt).
    static let rowAmount = Font.custom("Manrope", size: 16, relativeTo: .callout).weight(.bold).monospacedDigit()
    /// Total line of a formula card (Manrope 800, 18pt).
    static let totalAmount = Font.custom("Manrope", size: 18, relativeTo: .callout).weight(.heavy).monospacedDigit()
    /// "After" figure of an impact block (Manrope 700, 17pt).
    static let impactAmount = Font.custom("Manrope", size: 17, relativeTo: .body).weight(.bold).monospacedDigit()
    /// Caption, 13pt minimum, in ink2.
    static let captionRegular: Font = .footnote
    /// Chip label and small button (15pt semibold).
    static let chipLabel: Font = .system(.subheadline, weight: .semibold)
    /// Banner text (15pt).
    static let bannerText: Font = .subheadline

    // MARK: - Brand Titles (Manrope Bold)

    static let brandTitle = Font.custom("Manrope", size: 34, relativeTo: .largeTitle).weight(.bold)
    static let onboardingTitle = Font.custom("Manrope", size: 28, relativeTo: .title).weight(.bold)
    static let stepTitle = Font.custom("Manrope", size: 22, relativeTo: .title2).weight(.bold)
    /// Heading that opens a section of content. The brand face at 20pt is what tells a
    /// section from the rows under it — without it the two sit 2pt apart in the same
    /// family and weight, and only a rule between them can say which is which.
    static let sectionTitle = Font.custom("Manrope", size: 20, relativeTo: .title3).weight(.bold)

    // MARK: - Display (Manrope ExtraBold — large decorative/hero)

    /// Year display number in budget list (72pt)
    static let displayYear = Font.custom("Manrope", size: 72, relativeTo: .largeTitle).weight(.heavy)
    /// Hero icon / year recap amount (48pt)
    static let heroIcon = Font.custom("Manrope", size: 48, relativeTo: .largeTitle).weight(.heavy)
    /// Welcome/onboarding hero text (64pt)
    static let welcomeEmoji = Font.custom("Manrope", size: 64, relativeTo: .largeTitle).weight(.bold)

    // MARK: - Dashboard Hero (Manrope — split amount)

    /// Dominant figure of the dashboard hero amount (48pt).
    static let dashboardHeroAmount = Font.custom("Manrope", size: 48, relativeTo: .largeTitle).weight(.heavy)
    /// Currency suffix beside it — same baseline, deliberately secondary (24pt).
    /// Scales against `.largeTitle` like the figure so the pair keeps its ratio.
    static let dashboardHeroCurrency = Font.custom("Manrope", size: 24, relativeTo: .largeTitle).weight(.bold)

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
