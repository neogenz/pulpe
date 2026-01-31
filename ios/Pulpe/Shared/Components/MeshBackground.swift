import SwiftUI

/// Static mesh gradient background for iOS 26+ — provides an organic, colorful backdrop
/// that gives Liquid Glass surfaces visible content to refract through.
#if compiler(>=6.2)
@available(iOS 26.0, *)
struct MeshBackground: View {
    var tint: MeshBackgroundTint = .neutral

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
        switch tint {
        case .neutral:
            return [
                Color(hex: 0xA8E0B0).opacity(0.60),
                Color(hex: 0xC5E0C8).opacity(0.50),
                Color(hex: 0xD0EDCF).opacity(0.40),
                Color(hex: 0xC5E0C8).opacity(0.35),
                Color(hex: 0xEEF5EF),
                Color(hex: 0xD8EDD8).opacity(0.30),
                Color(hex: 0xD0EDCF).opacity(0.45),
                Color(hex: 0xA8E0B0).opacity(0.55),
                Color(hex: 0xC5E0C8).opacity(0.35)
            ]
        case .positive:
            return [
                Color(hex: 0xD0EDCF).opacity(0.55),
                Color(hex: 0xA8E0B0).opacity(0.40),
                Color(hex: 0xC5E0C8).opacity(0.25),
                Color(hex: 0xD8EDD8).opacity(0.30),
                Color(hex: 0xF5FAF6),
                Color(hex: 0xE4F3E0).opacity(0.35),
                Color(hex: 0xA8E0B0).opacity(0.45),
                Color(hex: 0xD0EDCF).opacity(0.50),
                Color(hex: 0xC5E0C8).opacity(0.20)
            ]
        case .negative:
            return [
                Color(hex: 0xFDE8D8).opacity(0.55),
                Color(hex: 0xF0C8A0).opacity(0.40),
                Color(hex: 0xE8C4A0).opacity(0.20),
                Color(hex: 0xFDF4EC).opacity(0.30),
                Color(hex: 0xFFFAF6),
                Color(hex: 0xFDE8D8).opacity(0.25),
                Color(hex: 0xF0C8A0).opacity(0.45),
                Color(hex: 0xFDE8D8).opacity(0.50),
                Color(hex: 0xE8C4A0).opacity(0.15)
            ]
        }
    }
}

enum MeshBackgroundTint {
    case neutral
    case positive
    case negative
}
#endif
