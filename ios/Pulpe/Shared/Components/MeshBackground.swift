import SwiftUI

/// Static mesh gradient background for iOS 26+ — provides an organic, colorful backdrop
/// that gives Liquid Glass surfaces visible content to refract through.
#if compiler(>=6.2)
@available(iOS 26.0, *)
struct MeshBackground: View {
    var tint: MeshBackgroundTint = .neutral
    @Environment(\.colorScheme) private var colorScheme

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
        if colorScheme == .dark {
            return darkColors
        }
        return lightColors
    }

    private var lightColors: [Color] {
        switch tint {
        case .neutral:
            return MeshPalette.lightNeutral
        case .positive:
            return MeshPalette.lightPositive
        case .negative:
            return MeshPalette.lightNegative
        }
    }

    private var darkColors: [Color] {
        switch tint {
        case .neutral:
            return MeshPalette.darkNeutral
        case .positive:
            return MeshPalette.darkPositive
        case .negative:
            return MeshPalette.darkNegative
        }
    }
}

/// Extracted palette to help the compiler with type-checking.
/// Opacity is baked into hex values to avoid complex type inference chains.
private enum MeshPalette {
    // MARK: - Light (same as original)

    static let lightNeutral: [Color] = {
        let c: [Color] = [
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
        return c
    }()

    static let lightPositive: [Color] = {
        let c: [Color] = [
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
        return c
    }()

    static let lightNegative: [Color] = {
        let c: [Color] = [
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
        return c
    }()

    // MARK: - Dark (muted, deep tones)

    static let darkNeutral: [Color] = [
        Color(hex: 0x142016),
        Color(hex: 0x1A2C1E),
        Color(hex: 0x162418),
        Color(hex: 0x1C2E20),
        Color(hex: 0x1E3224),
        Color(hex: 0x182A1C),
        Color(hex: 0x162418),
        Color(hex: 0x1A2C1E),
        Color(hex: 0x142016)
    ]

    static let darkPositive: [Color] = [
        Color(hex: 0x162E18),
        Color(hex: 0x1C3420),
        Color(hex: 0x183018),
        Color(hex: 0x1E3622),
        Color(hex: 0x203826),
        Color(hex: 0x1A3220),
        Color(hex: 0x183018),
        Color(hex: 0x1C3420),
        Color(hex: 0x162E18)
    ]

    static let darkNegative: [Color] = [
        Color(hex: 0x2A1E14),
        Color(hex: 0x302218),
        Color(hex: 0x282016),
        Color(hex: 0x32261A),
        Color(hex: 0x34281C),
        Color(hex: 0x2C2016),
        Color(hex: 0x282016),
        Color(hex: 0x302218),
        Color(hex: 0x2A1E14)
    ]
}

enum MeshBackgroundTint {
    case neutral
    case positive
    case negative
}
#endif
