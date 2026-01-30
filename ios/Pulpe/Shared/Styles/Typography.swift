import SwiftUI

/// Typography system for Pulpe — uses semantic TextStyles for Dynamic Type scaling
enum PulpeTypography {
    // MARK: - Brand

    static let brandTitle = Font.system(.largeTitle, design: .rounded).weight(.bold)

    // MARK: - Hero Amounts

    static let amountHero = Font.system(.largeTitle, design: .rounded).weight(.bold)

    // MARK: - Progress Indicator

    static let progressValue = Font.system(.callout, design: .rounded).weight(.bold)
    static let progressUnit = Font.system(.caption2, design: .default).weight(.medium)

    // MARK: - Onboarding Headlines

    static let onboardingTitle = Font.system(.title, design: .rounded).weight(.bold)
    static let onboardingSubtitle = Font.system(.body, design: .rounded).weight(.medium)

    // MARK: - Step Titles

    static let stepTitle = Font.system(.title2, design: .rounded).weight(.bold)
    static let stepSubtitle = Font.system(.subheadline, design: .default)

    // MARK: - Body Text

    static let bodyLarge = Font.system(.body, design: .default)

    // MARK: - Labels

    static let labelLarge = Font.system(.subheadline, design: .default).weight(.semibold)

    // MARK: - Input Labels

    static let inputLabel = Font.system(.subheadline, design: .default).weight(.semibold)
    static let inputValue = Font.system(.title2, design: .rounded).weight(.medium)
    static let inputHelper = Font.system(.caption, design: .default).weight(.medium)

    // MARK: - Tutorial

    static let tutorialTitle = Font.system(.title3, design: .rounded).weight(.bold)
    static let tutorialBody = Font.system(.subheadline, design: .default)
    static let tutorialStep = Font.system(.footnote, design: .rounded).weight(.semibold)

    // MARK: - Buttons

    static let buttonPrimary = Font.system(.body, design: .rounded).weight(.semibold)
    static let buttonSecondary = Font.system(.subheadline, design: .default).weight(.medium)

    // MARK: - Semantic Aliases (for replacing bare .font() calls)

    static let title = Font.system(.title, design: .default).weight(.bold)
    static let title2 = Font.system(.title2, design: .default).weight(.bold)
    static let title3 = Font.system(.title3, design: .default).weight(.semibold)
    static let headline = Font.system(.headline, design: .default)
    static let subheadline = Font.system(.subheadline, design: .default)
    static let body = Font.system(.body, design: .default)
    static let callout = Font.system(.callout, design: .default)
    static let footnote = Font.system(.footnote, design: .default)
    static let caption = Font.system(.caption, design: .default)
    static let caption2 = Font.system(.caption2, design: .default)
}
