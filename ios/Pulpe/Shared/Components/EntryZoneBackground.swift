import SwiftUI

/// Forest gradient with a mint halo: the zone of the entry screens (welcome, login, onboarding)
/// that "answers" what the user enters (V2 `oz`).
struct EntryZoneBackground: View {
    /// A zone that meets other forest chrome (the onboarding top bar) fades its halo out inside
    /// its own frame: a halo wider than a short zone is cut at its edge, a hard seam on the forest.
    var keepsHaloInside = false

    var body: some View {
        ZStack {
            LinearGradient(colors: [.heroSurfaceTop, .heroSurface], startPoint: .top, endPoint: .bottom)
            if keepsHaloInside {
                EllipticalGradient(colors: [halo, .clear], startRadiusFraction: 0, endRadiusFraction: 0.5)
            } else {
                RadialGradient(
                    colors: [halo, .clear], center: .center, startRadius: 0, endRadius: DesignTokens.Entry.ringSize
                )
            }
        }
        .ignoresSafeArea()
    }

    private var halo: Color { Color.heroAccentPositive.opacity(DesignTokens.Opacity.accent) }
}
