import SwiftUI

/// Capsule-shaped atomic chip used everywhere a pill / filter / status badge is needed.
///
/// One source of truth for chip rendering — replaces the ad-hoc
/// `HStack { ... }.padding(...).background(Capsule().fill(...))` recipe scattered across
/// the app. Composes an optional leading icon, a label, an optional count badge and a
/// trailing slot (chevron, etc.) inside a `Capsule()` background, with metrics pulled
/// from `DesignTokens.ChipMetrics`.
///
/// ## Variants
/// - `Style`: `.selected` (V2 on: pale green, 1.5pt green ring, deep-green ink, leading check) ·
///   `.outlined` (V2 off, default: white, 1pt line inset, ink) · `.muted` (informational) ·
///   `.tinted` / `.semantic` (status badges). Never solid black.
/// - `Size`: `.standard` (default) · `.prominent` (wider CTA chips). Both are 36pt tall.
///
/// ## Tap area
/// The visual is 36pt; the hit area is padded out to 44pt and back in so a wrapping
/// `Button { ... } label: { PulpeChip(...) }` honours Apple HIG without growing the layout
/// — see `swiftui-hit-areas.md`.
struct PulpeChip<Trailing: View>: View {
    // MARK: - Style

    enum Style: Equatable {
        /// V2 on: `accentWash` fill, 1.5pt `pulpePrimary` ring, `accentInk` label, leading check
        /// (unless the chip carries its own icon).
        case selected
        /// V2 off, the default chip: `surface` fill + 1pt `outline` (line2) inset border.
        case outlined
        /// Informational chip — `surfaceContainerHigh` fill, no border.
        case muted
        /// Explicit fill + foreground pair, no border — hero-surface state chips and
        /// status badges on the bare canvas, where `.muted`'s `surfaceContainerHigh`
        /// is indistinguishable from `appBackground` (1.04:1).
        case tinted(surface: Color, foreground: Color)

        /// The default way to build a state or informational chip: one semantic color
        /// carrying both the wash and the ink. Pairs whose fill and ink differ (the
        /// paused savings-goal badge) still spell out `.tinted` themselves.
        static func semantic(_ color: Color) -> Style {
            .tinted(
                surface: color.opacity(DesignTokens.Opacity.badgeBackground),
                foreground: color
            )
        }
    }

    // MARK: - Size

    enum Size: Equatable {
        case standard
        case prominent

        fileprivate var horizontalPadding: CGFloat {
            switch self {
            case .standard: DesignTokens.ChipMetrics.Standard.horizontalPadding
            case .prominent: DesignTokens.ChipMetrics.Prominent.horizontalPadding
            }
        }

        fileprivate var interElementGap: CGFloat {
            switch self {
            case .standard: DesignTokens.ChipMetrics.Standard.interElementGap
            case .prominent: DesignTokens.ChipMetrics.Prominent.interElementGap
            }
        }
    }

    // MARK: - Stored Properties

    let icon: String?
    let dotColor: Color?
    let label: String
    let count: Int?
    let style: Style
    let size: Size
    let isDisabled: Bool
    let trailing: Trailing

    // MARK: - Init

    init(
        icon: String? = nil,
        dotColor: Color? = nil,
        label: String,
        count: Int? = nil,
        style: Style = .outlined,
        size: Size = .standard,
        isDisabled: Bool = false,
        @ViewBuilder trailing: () -> Trailing
    ) {
        self.icon = icon
        self.dotColor = dotColor
        self.label = label
        self.count = count
        self.style = style
        self.size = size
        self.isDisabled = isDisabled
        self.trailing = trailing()
    }

    // MARK: - Body

    var body: some View {
        content
            .padding(.horizontal, size.horizontalPadding)
            .frame(height: DesignTokens.FrameHeight.chip)
            .background(Capsule().fill(backgroundFill))
            .overlay { borderOverlay }
            .foregroundStyle(foregroundColor)
            // Hit area: out to 44pt and back in, so the layout stays 36pt.
            .padding(.vertical, hitAreaOutset)
            .contentShape(Rectangle())
            .padding(.vertical, -hitAreaOutset)
            .opacity(isDisabled ? DesignTokens.Opacity.disabled : 1)
    }

    private var hitAreaOutset: CGFloat {
        (DesignTokens.TapTarget.minimum - DesignTokens.FrameHeight.chip) / 2
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        HStack(spacing: size.interElementGap) {
            if let dotColor {
                Circle()
                    .fill(dotColor)
                    .frame(
                        width: DesignTokens.ChipMetrics.stateDotSize,
                        height: DesignTokens.ChipMetrics.stateDotSize
                    )
            }
            if let icon {
                Image(systemName: icon)
                    .contentTransition(.symbolEffect(.replace))
            } else if style == .selected {
                Image(systemName: "checkmark")
                    .font(PulpeTypography.metricMini)
                    .accessibilityHidden(true)
            }
            Text(label)
                .font(PulpeTypography.chipLabel)
                // Matches the icon above: a chip whose label swaps mid-animation should
                // cross-fade with its symbol, not snap while the symbol morphs. Inert for
                // the static labels most chips carry.
                .contentTransition(.opacity)
            if let count {
                countBadge(count)
            }
            trailing
        }
    }

    @ViewBuilder
    private func countBadge(_ value: Int) -> some View {
        Text("\(value)")
            .font(PulpeTypography.metricMini)
            .monospacedDigit()
            .padding(.horizontal, DesignTokens.ChipMetrics.CountBadge.horizontalPadding)
            .padding(.vertical, DesignTokens.ChipMetrics.CountBadge.verticalPadding)
            .background(Capsule().fill(countBadgeFill))
            .foregroundStyle(countBadgeForeground)
    }

    // MARK: - Style Resolution

    private var backgroundFill: Color {
        switch style {
        case .selected: Color.accentWash
        case .outlined: Color.surface
        case .muted: Color.surfaceContainerHigh
        case .tinted(let surface, _): surface
        }
    }

    @ViewBuilder
    private var borderOverlay: some View {
        switch style {
        case .outlined:
            Capsule().strokeBorder(Color.outline, lineWidth: DesignTokens.BorderWidth.thin)
        case .selected:
            Capsule().strokeBorder(Color.pulpePrimary, lineWidth: DesignTokens.Control.chipSelectedRing)
        case .muted, .tinted:
            EmptyView()
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .selected: Color.accentInk
        case .outlined, .muted: Color.textPrimary
        case .tinted(_, let foreground): foreground
        }
    }

    private var countBadgeFill: Color {
        switch style {
        case .selected: Color.clear
        case .outlined, .muted, .tinted: Color.surfaceContainerHigh
        }
    }

    private var countBadgeForeground: Color {
        switch style {
        case .selected: Color.accentInk
        case .outlined, .muted, .tinted: Color.textSecondary
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
        Text("Standard").font(.caption).foregroundStyle(.secondary)
        HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
            PulpeChip(label: "Tout", count: 12, style: .selected)
            PulpeChip(label: "Revenus", count: 3, style: .outlined)
            PulpeChip(label: "Épargne", count: 0, style: .outlined, isDisabled: true)
        }

        Text("With icon + trailing").font(.caption).foregroundStyle(.secondary)
        PulpeChip(
            icon: "checkmark.square",
            label: "Pointé",
            count: 4,
            style: .outlined,
            trailing: {
                Image(systemName: "chevron.down")
                    .font(PulpeTypography.metricMini)
                    .foregroundStyle(Color.textTertiary)
            }
        )

        Text("Prominent").font(.caption).foregroundStyle(.secondary)
        PulpeChip(label: "CTA", style: .selected, size: .prominent)

        Text("Muted").font(.caption).foregroundStyle(.secondary)
        PulpeChip(label: "Info", style: .muted)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}

// MARK: - No trailing view

extension PulpeChip where Trailing == EmptyView {
    /// A defaulted `@ViewBuilder` closure would make the compiler infer `Trailing`
    /// from the default; Swift warns on it today and rejects it in a future mode.
    init(
        icon: String? = nil,
        dotColor: Color? = nil,
        label: String,
        count: Int? = nil,
        style: Style = .outlined,
        size: Size = .standard,
        isDisabled: Bool = false
    ) {
        self.init(
            icon: icon,
            dotColor: dotColor,
            label: label,
            count: count,
            style: style,
            size: size,
            isDisabled: isDisabled
        ) { EmptyView() }
    }
}
