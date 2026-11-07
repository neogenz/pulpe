import SwiftUI

/// Forest gradient with a mint halo: the zone of the entry screens (welcome, login, onboarding)
/// that "answers" what the user enters (V2 `oz`).
struct EntryZoneBackground: View {
    var body: some View {
        ZStack {
            LinearGradient(colors: [.heroSurfaceTop, .heroSurface], startPoint: .top, endPoint: .bottom)
            RadialGradient(
                colors: [Color.heroAccentPositive.opacity(DesignTokens.Opacity.accent), .clear],
                center: .center,
                startRadius: 0,
                endRadius: DesignTokens.Entry.ringSize
            )
        }
        .ignoresSafeArea()
    }
}
