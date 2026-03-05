import SwiftUI
import UIKit

extension Color {
    // MARK: - Financial Colors (from Asset Catalog with light/dark/high-contrast variants)

    /// Income indicator color - Blue (#0061A6 light, #5AA8E0 dark)
    static let financialIncome = Color("FinancialIncome")

    /// Expense indicator color - Orange (#B35800 light, #F0A050 dark)
    static let financialExpense = Color("FinancialExpense")

    /// Savings indicator color - Green (#1E8A4C light, #50C882 dark)
    static let financialSavings = Color("FinancialSavings")

    /// Over-budget indicator - Warm amber, not aggressive red (#C27A00 light, #E5A33A dark)
    static let financialOverBudget = Color(light: Color(hex: 0xC27A00), dark: Color(hex: 0xE5A33A))

    // MARK: - Hero Card Gradient Colors (4-stop, 150° linear)
    // Aligned with frontend --pulpe-hero-* tokens (base → color-mix 75% black)

    /// Comfortable state gradient stops — based on #006E25 (mat-sys-primary)
    static let heroGradientComfortable: [Color] = [
        Color(light: Color(hex: 0x006E25), dark: Color(hex: 0x00390F)),
        Color(light: Color(hex: 0x005F20), dark: Color(hex: 0x00320D)),
        Color(light: Color(hex: 0x00521B), dark: Color(hex: 0x002B0B)),
        Color(light: Color(hex: 0x004516), dark: Color(hex: 0x002409))
    ]

    /// Tight state gradient stops — based on #B35800 (pulpe-amber)
    static let heroGradientTight: [Color] = [
        Color(light: Color(hex: 0xB35800), dark: Color(hex: 0x3D2200)),
        Color(light: Color(hex: 0x9C4D00), dark: Color(hex: 0x351E00)),
        Color(light: Color(hex: 0x864200), dark: Color(hex: 0x2E1A00)),
        Color(light: Color(hex: 0x703800), dark: Color(hex: 0x261500))
    ]

    /// Deficit state gradient stops — based on #BA1A1A (mat-sys-error)
    static let heroGradientDeficit: [Color] = [
        Color(light: Color(hex: 0xBA1A1A), dark: Color(hex: 0x930009)),
        Color(light: Color(hex: 0xA51717), dark: Color(hex: 0x830008)),
        Color(light: Color(hex: 0x8F1313), dark: Color(hex: 0x6E0007)),
        Color(light: Color(hex: 0x7A1010), dark: Color(hex: 0x5C0005))
    ]

    // MARK: - Brand Colors

    /// Primary brand color - Dark green (#006E25 light, #7EDB83 dark)
    static let pulpePrimary = Color("PulpePrimary")

    // MARK: - Primary Container

    static let primaryContainer = Color(light: Color(hex: 0x99F89D), dark: Color(hex: 0x00531A))
    static let onPrimaryContainer = Color(light: Color(hex: 0x00531A), dark: Color(hex: 0x99F89D))

    // MARK: - Secondary

    static let secondaryColor = Color(light: Color(hex: 0x406741), dark: Color(hex: 0xA6D2A3))
    static let secondaryContainer = Color(light: Color(hex: 0xC1EEBE), dark: Color(hex: 0x294F2B))

    // MARK: - App Background
    // Single place to tweak the main screen background.
    // iOS default systemGroupedBackground is #F2F2F7 light / #000000 dark.
    static let appBackground = Color(uiColor: .systemGroupedBackground)

    // MARK: - Surface (iOS System Colors — neutral gray hierarchy)

    static let surface = Color(uiColor: .systemBackground)
    static let surfaceDim = Color(uiColor: .systemGray5)
    static let surfaceBright = Color(uiColor: .systemBackground)
    static let surfaceContainerLowest = Color(uiColor: .secondarySystemGroupedBackground)
    static let surfaceContainerLow = Color(uiColor: .secondarySystemBackground)
    static let surfaceContainer = Color(uiColor: .systemGray6)
    static let surfaceContainerHigh = Color(uiColor: .systemGray6)
    static let surfaceContainerHighest = Color(uiColor: .systemGray4)
    static let surfaceVariant = Color(uiColor: .systemGray5)

    // MARK: - Semantic Text Colors

    /// Primary text — iOS system label (pure black light, pure white dark)
    static let textPrimary = Color(.label)

    /// Text on primary-colored backgrounds (white in both modes)
    static let textOnPrimary = Color(light: .white, dark: .white)

    /// Tertiary text — iOS system tertiary label
    static let pulpeTextTertiary = Color(.tertiaryLabel)

    /// Secondary content on surface — iOS system secondary label
    static let onSurfaceVariant = Color(.secondaryLabel)

    // MARK: - Outline

    static let outline = Color(light: Color(hex: 0x6F7A6D), dark: Color(hex: 0x899486))
    static let outlineVariant = Color(light: Color(hex: 0xBFCABA), dark: Color(hex: 0x3F493E))

    // MARK: - Error Colors

    /// Error primary — warm orange, not aggressive red (#D4760A light, #F0A050 dark)
    static let errorPrimary = Color(light: Color(hex: 0xD4760A), dark: Color(hex: 0xF0A050))

    /// Error background — soft warm tint (#FFF3E0 light, #3A2510 dark)
    static let errorBackground = Color(light: Color(hex: 0xFFF3E0), dark: Color(hex: 0x3A2510))

    // MARK: - Destructive Colors (true red for irreversible actions)

    /// Destructive primary — true red for account deletion, danger zones (#C62828 light, #EF5350 dark)
    static let destructivePrimary = Color(light: Color(hex: 0xC62828), dark: Color(hex: 0xEF5350))

    /// Destructive background — soft red tint for danger zone cards (#FDECEA light, #2A1414 dark)
    static let destructiveBackground = Color(light: Color(hex: 0xFDECEA), dark: Color(hex: 0x2A1414))

    // MARK: - Warning Colors

    /// Warning primary — amber/yellow for tips and caution (#B8860B light, #FFD54F dark)
    static let warningPrimary = Color(light: Color(hex: 0xB8860B), dark: Color(hex: 0xFFD54F))

    /// Warning background — soft amber tint (#FFF8E1 light, #382E12 dark)
    static let warningBackground = Color(light: Color(hex: 0xFFF8E1), dark: Color(hex: 0x382E12))

    // MARK: - Component Colors

    /// Background for count badges in section headers
    static let countBadge = Color("CountBadge")

    /// Background track for progress indicators
    static let progressTrack = Color("ProgressTrack")

    /// Border color for input fields (unfocused state)
    static let inputBorder = Color("InputBorder")

    /// Generic badge background
    static let badgeBackground = Color("BadgeBackground")

    /// Input field background — subtle gray fill for contrast on white sheets
    static let inputBackgroundSoft = Color(uiColor: .tertiarySystemFill)

    /// Input focus glow color
    static let inputFocusGlow = Color(
        light: Color(hex: 0x006E25).opacity(0.12),
        dark: Color(hex: 0x4AA070).opacity(0.15)
    )

    // MARK: - Gradient Colors

    /// Aligned with frontend dark theme (styles/_financial-colors.scss)
    static let pulpeGradientColors: [Color] = [
        Color(light: Color(hex: 0x0088FF), dark: Color(hex: 0x1A1A1A)),
        Color(light: Color(hex: 0x00DDAA), dark: Color(hex: 0x1E2820)),
        Color(light: Color(hex: 0x00FF55), dark: Color(hex: 0x00531A)),
        Color(light: Color(hex: 0x88FF44), dark: Color(hex: 0x2B883B))
    ]

    // MARK: - Onboarding & Tutorial Colors

    /// High-contrast text colors for onboarding
    static let textPrimaryOnboarding = Color(light: Color(hex: 0x1A1A1A), dark: Color(hex: 0xF5F5F5))
    /// Secondary text - improved dark mode contrast (#D0D0D0 ≈ 81% luminance for better readability)
    static let textSecondaryOnboarding = Color(light: Color(hex: 0x4A4A4A), dark: Color(hex: 0xD0D0D0))
    /// Tertiary text - improved dark mode contrast (#ABABAB ≈ 67% luminance)
    static let textTertiaryOnboarding = Color(light: Color(hex: 0x6B6B6B), dark: Color(hex: 0xABABAB))

    /// Onboarding backgrounds
    static let onboardingBackground = Color(light: Color(hex: 0xF8FAF9), dark: Color(hex: 0x1C1C1E))
    static let onboardingCardBackground = Color(light: .white, dark: Color(hex: 0x2C2C2E))

    // MARK: - Auth Screen Gradient Colors

    /// Welcome sky gradient stops — fills a rounded shape, so 0→1 maps to the shape height
    private static let welcomeGradientStops: [Gradient.Stop] = [
        .init(color: Color(light: Color(hex: 0x00A838), dark: Color(hex: 0x006B25)), location: 0.0),
        .init(color: Color(light: Color(hex: 0x3EBE65), dark: Color(hex: 0x1A4A25)), location: 0.30),
        .init(color: Color(light: Color(hex: 0x90DBA8), dark: Color(hex: 0x1A2A1E)), location: 0.65),
        .init(color: Color(light: .white, dark: Color(hex: 0x1C1C1E)), location: 1.0),
    ]

    /// Login gradient — subtle branded tint, form stays on clean white
    private static let loginGradientStops: [Gradient.Stop] = [
        .init(color: Color(light: Color(hex: 0xD6F2DE), dark: Color(hex: 0x1A3520)), location: 0.0),
        .init(color: Color(light: .white, dark: Color(hex: 0x1C1C1E)), location: 0.30),
    ]

    /// Base color behind gradient shapes
    private static let authBase = Color(light: .white, dark: Color(hex: 0x1C1C1E))

    /// Welcome sky gradient — covers top ~55%, fades out with a soft convex curve at the bottom
    @ViewBuilder
    static var welcomeGradientBackground: some View {
        ZStack(alignment: .top) {
            authBase

            LinearGradient(
                stops: welcomeGradientStops,
                startPoint: .top,
                endPoint: .bottom
            )
            .containerRelativeFrame(.vertical) { height, _ in height * 0.57 }
            .mask {
                // Radial gradient centered at top: sides fade before center -> convex curve
                Canvas { context, size in
                    let radius = size.height * 1.45
                    let center = CGPoint(x: size.width / 2, y: 0)
                    let shading = Gradient(stops: [
                        .init(color: .white, location: 0.0),
                        .init(color: .white, location: 0.4),
                        .init(color: .clear, location: 0.82),
                    ])
                    context.fill(
                        Path(CGRect(origin: .zero, size: size)),
                        with: .radialGradient(
                            shading,
                            center: center,
                            startRadius: 0,
                            endRadius: radius
                        )
                    )
                }
            }
        }
        .ignoresSafeArea()
    }

    /// Full-screen login gradient — subtle branded top, clean white for the form
    @ViewBuilder
    static var loginGradientBackground: some View {
        LinearGradient(
            stops: loginGradientStops,
            startPoint: .top,
            endPoint: .bottom
        )
        .ignoresSafeArea()
    }

    /// Glass-morphic card background for auth forms
    static let authCardGlass = Color(light: .white.opacity(0.85), dark: Color(hex: 0x1C1C1E).opacity(0.75))

    /// Input field background for auth screens (high contrast - fully opaque)
    static let authInputBackground = Color(light: .white, dark: Color(hex: 0x2C2C2E))

    /// Input field text color for auth screens
    static let authInputText = Color(light: Color(hex: 0x1A1A1A), dark: .white)

    /// Input field border color for auth screens
    static let authInputBorder = Color(light: Color(hex: 0xE0E0E0), dark: Color(hex: 0x3C3C3E))

    /// Mint green background matching landing page suggestion
    static let mintBackground = Color(light: Color(hex: 0xBDF5B7), dark: Color(hex: 0x1A3A1A))

    /// Tutorial overlay with better contrast
    static let tutorialOverlay = Color.black.opacity(0.85)
    static let tutorialSpotlightGlow = Color(hex: 0x00C853).opacity(0.3)

    /// Step category colors for visual distinction
    static let stepIncome = Color(light: Color(hex: 0x2E7D32), dark: Color(hex: 0x4CAF50))
    static let stepHousing = Color(light: Color(hex: 0x1565C0), dark: Color(hex: 0x42A5F5))
    static let stepHealth = Color(light: Color(hex: 0xC62828), dark: Color(hex: 0xEF5350))
    static let stepPhone = Color(light: Color(hex: 0x6A1B9A), dark: Color(hex: 0xAB47BC))
    static let stepTransport = Color(light: Color(hex: 0xEF6C00), dark: Color(hex: 0xFFA726))
    static let stepCredit = Color(light: Color(hex: 0x37474F), dark: Color(hex: 0x78909C))

    /// Onboarding accent gradient
    static let onboardingGradient = LinearGradient(
        colors: [Color(light: Color(hex: 0x006E25), dark: Color(hex: 0x2E7D32)),
                 Color(light: Color(hex: 0x00A838), dark: Color(hex: 0x4CAF50))],
        startPoint: .leading,
        endPoint: .trailing
    )

    // MARK: - PIN Screen Colors (adaptive light/dark)

    /// PIN background gradient stops
    static let pinGradientTop = Color(light: Color(hex: 0xF0F2F5), dark: Color(hex: 0x0F1923))
    static let pinGradientMid = Color(light: Color(hex: 0xE8EBF0), dark: Color(hex: 0x1A2733))
    static let pinGradientBottom = Color(light: Color(hex: 0xE0E4EA), dark: Color(hex: 0x0D1520))

    /// PIN screen gradient
    static let pinBackground = LinearGradient(
        colors: [pinGradientTop, pinGradientMid, pinGradientBottom],
        startPoint: .top,
        endPoint: .bottom
    )

    /// Primary text on PIN screens
    static let pinText = Color(light: Color(hex: 0x1A1F2B), dark: .white)

    /// Secondary text on PIN screens (subtitles, links) - improved dark mode contrast (70% opacity)
    static let pinTextSecondary = Color(light: Color(hex: 0x5A6070), dark: .white.opacity(0.7))

    /// Numpad button fill
    static let pinButtonFill = Color(light: Color(hex: 0x1A1F2B).opacity(0.06), dark: .white.opacity(0.08))

    /// Numpad button stroke
    static let pinButtonStroke = Color(light: Color(hex: 0x1A1F2B).opacity(0.10), dark: .white.opacity(0.15))

    /// PIN dot color (filled state)
    static let pinDotFilled = Color(light: Color(hex: 0x1A1F2B), dark: .white)

    /// PIN dot color (empty state)
    static let pinDotEmpty = Color(light: Color(hex: 0x1A1F2B).opacity(0.2), dark: .white.opacity(0.3))

    /// Recovery key input field background
    static let pinInputBackground = Color(light: Color(hex: 0x1A1F2B).opacity(0.05), dark: .white.opacity(0.08))

    /// Recovery key input field border
    static let pinInputBorder = Color(light: Color(hex: 0x1A1F2B).opacity(0.12), dark: .white.opacity(0.15))

    // MARK: - Skeleton

    /// Placeholder fill for skeleton loading shapes
    static let skeletonPlaceholder = Color(uiColor: .systemGray5)

    // MARK: - Initializers

    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }

    init(light: Color, dark: Color) {
        self.init(uiColor: UIColor { traits in
            traits.userInterfaceStyle == .dark ? UIColor(dark) : UIColor(light)
        })
    }
}
