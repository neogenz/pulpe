import SwiftUI

/// Pulpe gradient logo - matches the Angular frontend w-10 h-10 pulpe-gradient rounded-full
struct PulpeLogo: View {
    let size: CGFloat

    init(size: CGFloat = 40) {
        self.size = size
    }

    private let gradient = LinearGradient(
        colors: Color.pulpeGradientColors,
        startPoint: .topLeading,
        endPoint: .bottomTrailing
    )

    var body: some View {
        Circle()
            .fill(gradient)
            .frame(width: size, height: size)
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
