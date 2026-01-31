import SwiftUI

/// Breathing mesh gradient background that replaces the static premium gradient on iOS 26+.
/// Points oscillate gently to create a living, organic backdrop for Liquid Glass surfaces.
#if compiler(>=6.2)
@available(iOS 26.0, *)
struct AnimatedMeshBackground: View {
    var body: some View {
        TimelineView(.animation(minimumInterval: 0.05, paused: false)) { timeline in
            let t = timeline.date.timeIntervalSinceReferenceDate

            MeshGradient(
                width: 3, height: 3,
                points: [
                    // Top row
                    .init(x: 0, y: 0),
                    .init(x: Float(sin(t * 0.3) * 0.08 + 0.5), y: 0),
                    .init(x: 1, y: 0),
                    // Middle row — center point drifts slowly
                    .init(x: 0, y: 0.5),
                    .init(
                        x: Float(cos(t * 0.2) * 0.06 + 0.5),
                        y: Float(sin(t * 0.25) * 0.06 + 0.5)
                    ),
                    .init(x: 1, y: 0.5),
                    // Bottom row
                    .init(x: 0, y: 1),
                    .init(x: 0.5, y: 1),
                    .init(x: 1, y: 1)
                ],
                colors: meshColors
            )
            .blur(radius: 30)
        }
        .ignoresSafeArea()
    }

    private var meshColors: [Color] {
        [
            // Top row: subtle mint / sage tints
            Color(hex: 0xA8E0B0).opacity(0.12),
            Color.mint.opacity(0.10),
            Color.teal.opacity(0.06),
            // Middle row: mostly clear with faint center glow
            Color.clear,
            Color.white.opacity(0.08),
            Color.clear,
            // Bottom row: faint sage / green wash
            Color(hex: 0xC5E0C8).opacity(0.08),
            Color(hex: 0xA8E0B0).opacity(0.10),
            Color.clear
        ]
    }
}
#endif
