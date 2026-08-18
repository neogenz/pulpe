import SwiftUI

/// Viewport-fixed mint surface for the home dashboard.
///
/// The mint is a surface, not a wash: it runs full-bleed from the top of the
/// screen down to the hero's own bottom edge, and stops there on a curve. A
/// hard edge would read as banding at this contrast — the curve is what lets
/// a pale tint hold a boundary. The curve alone still read as a die-cut, two
/// flat planes meeting; the shadow is what puts the emotion zone *in front of*
/// the ledger instead of beside it.
///
/// Reads height from `HomeHeroSurfaceTracker` so re-renders are scoped to this
/// subtree only. The parent must never read `tracker.height` in its own body.
struct HomeHeroSurfaceBackground: View {
    let tracker: HomeHeroSurfaceTracker

    var body: some View {
        ZStack(alignment: .top) {
            Color.appBackground
            LinearGradient(
                colors: [.homeHeroSurfaceTop, .homeHeroSurface],
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
