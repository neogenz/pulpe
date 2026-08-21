import SwiftUI

/// Viewport-fixed forest surface behind a hero zone (ios/DESIGN.md, The Two-Zone Rule).
///
/// Full-bleed from the top of the screen down to the hero's own bottom edge, where it
/// stops on a curve over `appBackground`. Its depth is a two-stop gradient plus
/// `Shadow.zoneBoundary` and nothing else (The Hero Depth Rule).
///
/// Reads height from `HeroZoneTracker` so re-renders are scoped to this subtree only.
/// The parent must never read `tracker.height` in its own body.
struct HeroZoneSurface: View {
    let tracker: HeroZoneTracker

    var body: some View {
        ZStack(alignment: .top) {
            Color.appBackground
            LinearGradient(
                colors: [.heroSurfaceTop, .heroSurface],
                startPoint: .top,
                endPoint: .bottom
            )
            .frame(height: tracker.height)
            .clipShape(
                .rect(
                    bottomLeadingRadius: DesignTokens.CornerRadius.zone,
                    bottomTrailingRadius: DesignTokens.CornerRadius.zone
                )
            )
            .shadow(DesignTokens.Shadow.zoneBoundary)
        }
    }
}
