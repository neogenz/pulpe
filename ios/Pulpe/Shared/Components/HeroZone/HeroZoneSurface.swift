import SwiftUI

/// The two zones of a hero screen, as scroll-native modifiers (ios/DESIGN.md, The Two-Zone Rule).
///
/// `heroZone` paints the forest gradient as the hero's own background, bled far above the
/// viewport so the status bar and any pull-to-refresh overscroll are always forest. The
/// surface scrolls with its content: nothing to track, nothing that can lag.
///
/// `contentZone` turns the ledger into an `appBackground` card with `CornerRadius.zone`
/// top corners, pulled up over the hero by that radius so it reads as a sheet rising over
/// the forest. Depth is `Shadow.zoneBoundary` and nothing else (The Hero Depth Rule).
extension View {
    /// Apply to the hero block, after its own paddings, inside the screen's `ScrollView`.
    /// `parallax` makes the hero drift at `Motion.heroParallax` of the scroll so the card
    /// appears to cover it; off under Reduce Motion.
    func heroZone(parallax: Bool = false) -> some View {
        modifier(HeroZoneModifier(parallax: parallax))
    }

    /// Apply to the block directly under the hero, after its own paddings.
    func contentZone() -> some View {
        modifier(ContentZoneModifier())
    }

    /// Apply to the hero screen, around its `ScrollView`. `isUnderBar` stays true while the
    /// forest lies under the navigation bar and turns false once the content zone has risen
    /// beneath it: the bar's light ink and hero buttons belong to the forest, and over the
    /// light canvas they vanish. True until a hero is laid out.
    func trackingHeroUnderBar(_ isUnderBar: Binding<Bool>) -> some View {
        modifier(HeroUnderBarModifier(isUnderBar: isUnderBar))
    }
}

/// The screen's own space: laid out inside the safe area, so y = 0 is the bar's bottom.
private let heroScreenSpace = "heroScreen"

/// Whether the hero's forest is still under the bar, as the content zone reports it; nil
/// while no content zone is laid out.
private struct HeroUnderBarKey: PreferenceKey {
    static var defaultValue: Bool? { nil }

    static func reduce(value: inout Bool?, nextValue: () -> Bool?) {
        value = value ?? nextValue()
    }
}

private struct HeroUnderBarModifier: ViewModifier {
    @Binding var isUnderBar: Bool

    func body(content: Content) -> some View {
        content
            .coordinateSpace(.named(heroScreenSpace))
            // A lazy stack that drops a scrolled-away zone keeps the last answer.
            .onPreferenceChange(HeroUnderBarKey.self) { isCovered in
                if let isCovered { isUnderBar = isCovered }
            }
    }
}

private struct HeroZoneModifier: ViewModifier {
    let parallax: Bool
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        let factor = parallax && !reduceMotion ? DesignTokens.Motion.heroParallax : 0
        return content
            // Room for the content card to overlap without covering the hero's last line.
            .padding(.bottom, DesignTokens.CornerRadius.zone)
            .frame(maxWidth: .infinity)
            .background {
                VStack(spacing: 0) {
                    Color.heroSurfaceTop.frame(height: DesignTokens.Layout.overscrollBleed)
                    LinearGradient(
                        colors: [.heroSurfaceTop, .heroSurface],
                        startPoint: .top,
                        endPoint: .bottom
                    )
                }
                .padding(.top, -DesignTokens.Layout.overscrollBleed)
            }
            // Only while scrolled past the top (negative minY): never pushes the hero up
            // into the bleed, so the overscroll region stays forest during a refresh.
            .visualEffect { content, proxy in
                content.offset(y: max(0, -proxy.frame(in: .scrollView).minY) * factor)
            }
    }
}

private struct ContentZoneModifier: ViewModifier {
    @State private var isHeroUnderBar = true

    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity)
            .background {
                UnevenRoundedRectangle(
                    topLeadingRadius: DesignTokens.CornerRadius.zone,
                    topTrailingRadius: DesignTokens.CornerRadius.zone,
                    style: .continuous
                )
                .fill(Color.appBackground)
                .shadow(DesignTokens.Shadow.zoneBoundary)
                // A short ledger still paints the canvas down past the screen edge, and the
                // card's bottom edge (and its shadow) never comes into view.
                .padding(.bottom, -DesignTokens.Layout.overscrollBleed)
            }
            // The card's top edge, measured here rather than on the hero, whose parallax
            // offset would move it: the forest is under the bar until this edge reaches it.
            .onGeometryChange(for: Bool.self) { proxy in
                proxy.frame(in: .named(heroScreenSpace)).minY > 0
            } action: { isHeroUnderBar = $0 }
            .preference(key: HeroUnderBarKey.self, value: isHeroUnderBar)
            .padding(.top, -DesignTokens.CornerRadius.zone)
    }
}
