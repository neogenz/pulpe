import SwiftUI
import UIKit

extension Color {
    // MARK: - Financial Colors (from Asset Catalog with light/dark/high-contrast variants)

    /// Income indicator color - Blue (#0061A6 light, #5AA8E0 dark)
    static let financialIncome = Color("FinancialIncome")

    /// Expense indicator color - Orange (#B35800 light, #F0A050 dark)
    static let financialExpense = Color("FinancialExpense")

    /// Savings indicator color - Green (#157038 light, #50C882 dark)
    static let financialSavings = Color("FinancialSavings")

    /// Over-budget indicator - Warm amber, not aggressive red (#A86800 light, #E5A33A dark)
    static let financialOverBudget = Color(light: Color(hex: 0xA86800), dark: Color(hex: 0xE5A33A))

    // MARK: - Hero Card Gradient Colors (4-stop, ~128° linear)
    // Designed in oklch for perceptual uniformity, converted to hex for SwiftUI.
    // Gradient direction: dark → bright for depth and punch.

    /// Emerald Bright — oklch(0.45-0.75, C 0.16-0.22, H 147)
    static let heroGradientComfortable: [Color] = [
        Color(light: Color(hex: 0x006B1E), dark: Color(hex: 0x003D10)),
        Color(light: Color(hex: 0x008C30), dark: Color(hex: 0x005C20)),
        Color(light: Color(hex: 0x14AD45), dark: Color(hex: 0x007C32)),
        Color(light: Color(hex: 0x38D062), dark: Color(hex: 0x109E48))
    ]

    /// Tangerine — oklch(0.48-0.80, C 0.15-0.18, H 65-70)
    static let heroGradientTight: [Color] = [
        Color(light: Color(hex: 0x8C4400), dark: Color(hex: 0x4C2400)),
        Color(light: Color(hex: 0xB86200), dark: Color(hex: 0x6E3A00)),
        Color(light: Color(hex: 0xD88010), dark: Color(hex: 0x925208)),
        Color(light: Color(hex: 0xF49E28), dark: Color(hex: 0xB86C14))
    ]

    /// Sunset Coral — oklch(0.48-0.78, C 0.16, H 35-40)
    /// DA.md: "Le rouge est factuel et contextuel, pas punitif"
    static let heroGradientDeficit: [Color] = [
        Color(light: Color(hex: 0x9C3418), dark: Color(hex: 0x561C0C)),
        Color(light: Color(hex: 0xC45028), dark: Color(hex: 0x7C3418)),
        Color(light: Color(hex: 0xE06C38), dark: Color(hex: 0xA04C28)),
        Color(light: Color(hex: 0xF48A4C), dark: Color(hex: 0xC46438))
    ]

    /// Glass tint for hero card overlay elements — mid-tone of each gradient.
    static let heroTintComfortable = Color(hex: 0x14AD45)
    static let heroTintTight = Color(hex: 0xD88010)
    static let heroTintDeficit = Color(hex: 0xC45028)

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
    // DA.md §3.1: neutral warm — not cold (no blue-gray), not green.
    // Light: #F7F6F3 (warm neutral). Dark: #141210 (warm near-black, not pure #000).
    static let appBackground = Color(light: Color(hex: 0xF7F6F3), dark: Color(hex: 0x141210))

    // MARK: - Sheet Background
    // Warm sheet surface with visible contrast against card bg in dark mode.
    // Light: slightly cooler warm (#F5F3F0). Dark: #111111 (darker than card bg).
    static let sheetBackground = Color(light: Color(hex: 0xF5F3F0), dark: Color(hex: 0x111111))

    // MARK: - Surface (warm hierarchy — DA.md §3.1)

    static let surface = Color(light: .white, dark: Color(hex: 0x1A1816))
    static let surfaceDim = Color(light: Color(hex: 0xEBE9E5), dark: Color(hex: 0x161412))
    static let surfaceBright = Color(light: .white, dark: Color(hex: 0x1A1816))
    static let surfaceContainerLowest = Color(light: .white, dark: Color(hex: 0x1E1C1A))
    static let surfaceContainerLow = Color(light: Color(hex: 0xFCFAF7), dark: Color(hex: 0x1C1A18))
    static let surfaceContainer = Color(light: Color(hex: 0xF5F3F0), dark: Color(hex: 0x201E1C))
    static let surfaceContainerHigh = Color(light: Color(hex: 0xF0EDE9), dark: Color(hex: 0x242220))
    static let surfaceContainerHighest = Color(light: Color(hex: 0xE8E5E1), dark: Color(hex: 0x2A2826))
    static let surfaceVariant = Color(light: Color(hex: 0xEBE9E5), dark: Color(hex: 0x242220))

    // MARK: - Semantic Text Colors

    /// Primary text — iOS system label (pure black light, pure white dark)
    static let textPrimary = Color(.label)

    /// Text on primary-colored backgrounds (white in both modes)
    static let textOnPrimary = Color(light: .white, dark: .white)

    /// Secondary text — WCAG AA on all warm surfaces (labels, subtitles, captions)
    /// Light #524D48: 6.9:1 on #F0EDE9 (AAA) · Dark #B8B0A8: 7.6:1 on #242220 (AAA)
    static let textSecondary = Color(light: Color(hex: 0x524D48), dark: Color(hex: 0xB8B0A8))

    /// Tertiary text — WCAG AA on all warm surfaces (hints, footers, decorative)
    /// Light #6E6762: 4.8:1 on #F0EDE9 (AA) · Dark #958E88: 5.0:1 on #242220 (AA)
    static let textTertiary = Color(light: Color(hex: 0x6E6762), dark: Color(hex: 0x958E88))

    /// Secondary content on surface — alias for textSecondary (M3 naming)
    static let onSurfaceVariant = textSecondary

    // MARK: - Outline

    static let outline = Color(light: Color(hex: 0x6F7A6D), dark: Color(hex: 0x899486))
    static let outlineVariant = Color(light: Color(hex: 0xBFCABA), dark: Color(hex: 0x3F493E))

    // MARK: - Error Colors

    /// Error primary — warm orange, not aggressive red (#D4760A light, #F0A050 dark)
    static let errorPrimary = Color(light: Color(hex: 0xD4760A), dark: Color(hex: 0xF0A050))

    /// Error background — soft warm tint (#FFF3E0 light, #3A2510 dark)
    static let errorBackground = Color(light: Color(hex: 0xFFF3E0), dark: Color(hex: 0x3A2510))

    // MARK: - Destructive Colors (true red for irreversible actions)

    /// Destructive primary — true red for account deletion, danger zones (#C62828 light, #FF6B6B dark)
    static let destructivePrimary = Color(light: Color(hex: 0xC62828), dark: Color(hex: 0xFF6B6B))

    /// Destructive background — soft red tint for danger zone cards (#FDECEA light, #3A1818 dark)
    static let destructiveBackground = Color(light: Color(hex: 0xFDECEA), dark: Color(hex: 0x3A1818))

    // MARK: - Warning Colors

    /// Warning primary — amber/yellow for tips and caution (#B8860B light, #FFD54F dark)
    static let warningPrimary = Color(light: Color(hex: 0xB8860B), dark: Color(hex: 0xFFD54F))

    /// Warning background — soft amber tint (#FFF8E1 light, #382E12 dark)
    static let warningBackground = Color(light: Color(hex: 0xFFF8E1), dark: Color(hex: 0x382E12))

    // MARK: - Action Colors

    /// Edit action color - Blue, following iOS conventions (#0063B4 light, #6BAAEE dark)
    static let editAction = Color(light: Color(hex: 0x0063B4), dark: Color(hex: 0x6BAAEE))

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
    /// Secondary text - subtle green tint in dark mode for brand cohesion
    static let textSecondaryOnboarding = Color(light: Color(hex: 0x4A4A4A), dark: Color(hex: 0xC8D0CA))
    /// Tertiary text - subtle green tint in dark mode for brand cohesion
    static let textTertiaryOnboarding = Color(light: Color(hex: 0x6B6B6B), dark: Color(hex: 0xA0B0A4))

    /// Onboarding backgrounds
    static let onboardingBackground = Color(light: Color(hex: 0xF8FAF9), dark: Color(hex: 0x111614))
    static let onboardingCardBackground = Color(light: .white, dark: Color(hex: 0x1E2822))

    /// Section icon color for ExpensesStep
    static let onboardingSectionIcon =
        Color(light: Color(hex: 0x006E25).opacity(0.7), dark: Color(hex: 0x7EDB83).opacity(0.5))

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
        .init(color: Color(light: Color(hex: 0xD6F2DE), dark: Color(hex: 0x0D1A12)), location: 0.0),
        .init(color: Color(light: .white, dark: Color(hex: 0x141A16)), location: 0.30),
    ]

    /// Base color behind gradient shapes
    private static let authBase = Color(light: .white, dark: Color(hex: 0x111614))

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
    static let authInputBackground = Color(light: .white, dark: Color(hex: 0x1C2420))

    /// Input field text color for auth screens
    static let authInputText = Color(light: Color(hex: 0x1A1A1A), dark: .white)

    /// Input field border color for auth screens
    static let authInputBorder = Color(light: Color(hex: 0xE0E0E0), dark: Color(hex: 0x2A3028))

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

    /// Onboarding accent gradient — brighter dark mode for visibility on deep backgrounds
    static let onboardingGradient = LinearGradient(
        colors: [Color(light: Color(hex: 0x006E25), dark: Color(hex: 0x338A36)),
                 Color(light: Color(hex: 0x00A838), dark: Color(hex: 0x56C45A))],
        startPoint: .leading,
        endPoint: .trailing
    )

    // MARK: - PIN Screen Colors (adaptive light/dark)

    /// PIN background gradient stops — aligned with onboarding loginGradientStops
    static let pinGradientTop = Color(light: Color(hex: 0xD6F2DE), dark: Color(hex: 0x0D1A12))
    static let pinGradientMid = Color(light: Color(hex: 0xF0F5F2), dark: Color(hex: 0x111614))
    static let pinGradientBottom = Color(light: .white, dark: Color(hex: 0x141A16))

    /// PIN screen gradient
    static let pinBackground = LinearGradient(
        colors: [pinGradientTop, pinGradientMid, pinGradientBottom],
        startPoint: .top,
        endPoint: .bottom
    )

    /// Primary text on PIN screens
    static let pinText = Color(light: Color(hex: 0x1A1A1A), dark: .white)

    /// Secondary text on PIN screens (subtitles, links)
    static let pinTextSecondary = Color(light: Color(hex: 0x4A4A4A), dark: Color(hex: 0xC8D0CA))

    /// Numpad button fill — adjusted for green-tinted PIN background
    static let pinButtonFill = Color(
        light: Color(hex: 0x1A1A1A).opacity(0.06),
        dark: .white.opacity(0.08)
    )

    /// Numpad button stroke
    static let pinButtonStroke = Color(
        light: Color(hex: 0x1A1A1A).opacity(0.10),
        dark: .white.opacity(0.12)
    )

    /// PIN dot color (filled state)
    static let pinDotFilled = Color(light: Color(hex: 0x1A1A1A), dark: .white)

    /// PIN dot color (empty state)
    static let pinDotEmpty = Color(
        light: Color(hex: 0x1A1A1A).opacity(0.2),
        dark: .white.opacity(0.3)
    )

    /// Recovery key input field background
    static let pinInputBackground = Color(
        light: Color(hex: 0x1A1F2B).opacity(0.05),
        dark: .white.opacity(0.08)
    )

    /// Recovery key input field border
    static let pinInputBorder = Color(
        light: Color(hex: 0x1A1F2B).opacity(0.12),
        dark: .white.opacity(DesignTokens.Opacity.accent)
    )

    // MARK: - Dashboard Emotion Zone (DA.md §3.1 — zone d'émotion header)

    /// Comfortable (Emerald): pale green → neutral warm
    static let dashboardGradientComfortable = Color(light: Color(hex: 0xD0F0DC), dark: Color(hex: 0x0C200E))
    /// Tight (Tangerine): pale warm orange → neutral warm
    static let dashboardGradientTight = Color(light: Color(hex: 0xFCECD0), dark: Color(hex: 0x1C1408))
    /// Deficit (Sunset Coral): warm peach → neutral warm
    static let dashboardGradientDeficit = Color(light: Color(hex: 0xFADCD0), dark: Color(hex: 0x201008))

    // MARK: - Skeleton

    /// Placeholder fill for skeleton loading shapes — warm tint to match neutral warm bg
    static let skeletonPlaceholder = Color(light: Color(hex: 0xE8E5E1), dark: Color(hex: 0x242220))

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
