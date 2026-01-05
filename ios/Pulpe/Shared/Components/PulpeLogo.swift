import SwiftUI

/// Pulpe gradient logo - matches the Angular frontend w-10 h-10 pulpe-gradient rounded-full
struct PulpeLogo: View {
    let size: CGFloat

    init(size: CGFloat = 40) {
        self.size = size
    }

    private let gradient = LinearGradient(
        colors: [
            Color(hex: 0x0088FF), // bleu survitaminé
            Color(hex: 0x00DDAA), // turquoise punch
            Color(hex: 0x00FF55), // vert néon
            Color(hex: 0x88FF44)  // vert lime électrique
        ],
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        Circle()
            .fill(gradient)
            .frame(width: size, height: size)
    }
}

private extension Color {
    init(hex: UInt) {
        self.init(
            red: Double((hex >> 16) & 0xFF) / 255,
            green: Double((hex >> 8) & 0xFF) / 255,
            blue: Double(hex & 0xFF) / 255
        )
    }
}

#Preview {
    VStack(spacing: 20) {
        PulpeLogo(size: 40)
        PulpeLogo(size: 60)
        PulpeLogo(size: 100)
    }
    .padding()
}
