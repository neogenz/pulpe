import SwiftUI

/// Typography system for Pulpe onboarding and tutorial
enum PulpeTypography {
    // MARK: - Onboarding Headlines

    static let onboardingTitle = Font.system(size: 28, weight: .bold, design: .rounded)
    static let onboardingSubtitle = Font.system(size: 17, weight: .medium, design: .rounded)

    // MARK: - Step Titles

    static let stepTitle = Font.system(size: 24, weight: .bold, design: .rounded)
    static let stepSubtitle = Font.system(size: 15, weight: .regular, design: .default)

    // MARK: - Body Text

    static let bodyLarge = Font.system(size: 17, weight: .regular, design: .default)

    // MARK: - Labels

    static let labelLarge = Font.system(size: 15, weight: .semibold, design: .default)

    // MARK: - Input Labels

    static let inputLabel = Font.system(size: 14, weight: .semibold, design: .default)
    static let inputValue = Font.system(size: 24, weight: .medium, design: .rounded)
    static let inputHelper = Font.system(size: 12, weight: .medium, design: .default)

    // MARK: - Tutorial

    static let tutorialTitle = Font.system(size: 20, weight: .bold, design: .rounded)
    static let tutorialBody = Font.system(size: 15, weight: .regular, design: .default)
    static let tutorialStep = Font.system(size: 13, weight: .semibold, design: .rounded)

    // MARK: - Buttons

    static let buttonPrimary = Font.system(size: 17, weight: .semibold, design: .rounded)
    static let buttonSecondary = Font.system(size: 15, weight: .medium, design: .default)
}
