import SwiftUI

/// Static mesh gradient background for iOS 26+ — provides an organic backdrop
/// for Liquid Glass surfaces without animation overhead.
#if compiler(>=6.2)
@available(iOS 26.0, *)
struct MeshBackground: View {
    var body: some View {
        MeshGradient(
            width: 3, height: 3,
            points: [
                .init(x: 0, y: 0), .init(x: 0.5, y: 0), .init(x: 1, y: 0),
                .init(x: 0, y: 0.5), .init(x: 0.5, y: 0.5), .init(x: 1, y: 0.5),
                .init(x: 0, y: 1), .init(x: 0.5, y: 1), .init(x: 1, y: 1)
            ],
            colors: meshColors
        )
        .ignoresSafeArea()
    }

    private var meshColors: [Color] {
        [
            Color(hex: 0xA8E0B0).opacity(0.12),
            Color.mint.opacity(0.10),
            Color.teal.opacity(0.06),
            Color.clear,
            Color.white.opacity(0.08),
            Color.clear,
            Color(hex: 0xC5E0C8).opacity(0.08),
            Color(hex: 0xA8E0B0).opacity(0.10),
            Color.clear
        ]
    }
}
#endif
