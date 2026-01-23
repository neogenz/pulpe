import SwiftUI

/// Pulpe brand icon - lime slice matching the landing page
struct PulpeIcon: View {
    let size: CGFloat

    init(size: CGFloat = 40) {
        self.size = size
    }

    var body: some View {
        Image("PulpeIcon")
            .resizable()
            .scaledToFit()
            .frame(width: size, height: size)
            .accessibilityLabel("Logo Pulpe")
    }
}

#Preview {
    VStack(spacing: 20) {
        PulpeIcon(size: 40)
        PulpeIcon(size: 60)
        PulpeIcon(size: 100)
    }
    .padding()
}
