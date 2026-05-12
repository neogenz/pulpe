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
/// - `Style`: `.solid` (active filter / primary chip) · `.outlined` (default) · `.muted` (informational)
/// - `Size`: `.standard` (default) · `.prominent` (CTA chips). No `.compact` — Pulpe DA pillar
///   "Légèreté" forbids tight density.
///
/// ## Tap area
/// `PulpeChip` keeps the **visual** compact and applies a `Capsule()` `contentShape` plus a
/// 44pt minimum frame so a wrapping `Button { ... } label: { PulpeChip(...) }` honours
/// Apple HIG — see `swiftui-hit-areas.md`.
struct PulpeChip<Trailing: View>: View {
    // MARK: - Style

    enum Style: Equatable {
        /// Filled, used for active filter / primary chip. Inverts foreground to `systemBackground`.
        case solid
        /// Default chip — `surface` fill + hairline outline.
        case outlined
        /// Informational chip — `surfaceContainerHigh` fill, no border.
        case muted
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

        fileprivate var verticalPadding: CGFloat {
            switch self {
            case .standard: DesignTokens.ChipMetrics.Standard.verticalPadding
            case .prominent: DesignTokens.ChipMetrics.Prominent.verticalPadding
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
    let label: String
    let count: Int?
    let style: Style
    let size: Size
    let isDisabled: Bool
    let trailing: Trailing

    // MARK: - Init

    init(
        icon: String? = nil,
        label: String,
        count: Int? = nil,
        style: Style = .outlined,
        size: Size = .standard,
        isDisabled: Bool = false,
        @ViewBuilder trailing: () -> Trailing = { EmptyView() }
    ) {
        self.icon = icon
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
            .padding(.vertical, size.verticalPadding)
            .background(Capsule().fill(backgroundFill))
            .overlay { borderOverlay }
            .foregroundStyle(foregroundColor)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Capsule())
            .opacity(isDisabled ? DesignTokens.Opacity.disabled : 1)
    }

    // MARK: - Content

    @ViewBuilder
    private var content: some View {
        HStack(spacing: size.interElementGap) {
            if let icon {
                Image(systemName: icon)
                    .contentTransition(.symbolEffect(.replace))
            }
            Text(label)
                .font(PulpeTypography.metricLabelBold)
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
        case .solid: Color.textPrimary
        case .outlined: Color.surface
        case .muted: Color.surfaceContainerHigh
        }
    }

    @ViewBuilder
    private var borderOverlay: some View {
        if style == .outlined {
            Capsule()
                .strokeBorder(
                    Color.onSurfaceVariant.opacity(DesignTokens.Opacity.outlinePill),
                    lineWidth: DesignTokens.BorderWidth.thin
                )
        }
    }

    private var foregroundColor: Color {
        switch style {
        case .solid: Color(.systemBackground)
        case .outlined, .muted: Color.textPrimary
        }
    }

    private var countBadgeFill: Color {
        switch style {
        case .solid: Color(.systemBackground).opacity(DesignTokens.Opacity.secondary)
        case .outlined, .muted: Color.surfaceContainerHigh
        }
    }

    private var countBadgeForeground: Color {
        switch style {
        case .solid: Color(.systemBackground)
        case .outlined, .muted: Color.textTertiary
        }
    }
}

// MARK: - Preview

#Preview {
    VStack(alignment: .leading, spacing: DesignTokens.Spacing.lg) {
        Text("Standard").font(.caption).foregroundStyle(.secondary)
        HStack(spacing: DesignTokens.ChipMetrics.Standard.interChipGap) {
            PulpeChip(label: "Tout", count: 12, style: .solid)
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
        PulpeChip(label: "CTA", style: .solid, size: .prominent)

        Text("Muted").font(.caption).foregroundStyle(.secondary)
        PulpeChip(label: "Info", style: .muted)
    }
    .padding()
    .frame(maxWidth: .infinity, maxHeight: .infinity)
    .background(Color.appBackground)
}
