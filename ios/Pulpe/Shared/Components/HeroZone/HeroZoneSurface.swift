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

    /// Paint a full-width neutral list row with no system-owned chrome.
    func contentListRow() -> some View {
        modifier(ContentListRowModifier())
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
            .padding(.top, -DesignTokens.CornerRadius.zone)
    }
}

private struct ContentListRowModifier: ViewModifier {
    func body(content: Content) -> some View {
        content
            .frame(maxWidth: .infinity)
            .listRowInsets(EdgeInsets())
            .listRowSeparator(.hidden)
            .listRowBackground(Color.appBackground)
    }
}
