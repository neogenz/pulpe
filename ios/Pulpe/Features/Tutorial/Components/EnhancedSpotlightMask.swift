import SwiftUI

/// Enhanced spotlight mask with pulsing glow effect
struct EnhancedSpotlightMask: View {
    let targetFrame: CGRect
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        ZStack {
            // Dark overlay with cutout
            SpotlightShape(targetFrame: targetFrame)
                .fill(Color.tutorialOverlay)
                .ignoresSafeArea()

            // Glow ring around spotlight
            if targetFrame != .zero {
                RoundedRectangle(cornerRadius: 16)
                    .stroke(Color.tutorialSpotlightGlow, lineWidth: 3)
                    .frame(
                        width: targetFrame.width + 20,
                        height: targetFrame.height + 20
                    )
                    .position(
                        x: targetFrame.midX,
                        y: targetFrame.midY
                    )
                    .scaleEffect(pulseScale)
                    .animation(
                        .easeInOut(duration: 1.5).repeatForever(autoreverses: true),
                        value: pulseScale
                    )
                    .onAppear {
                        pulseScale = 1.05
                    }
            }
        }
        .allowsHitTesting(false)
    }
}

/// Shape that creates a spotlight hole in a solid overlay
struct SpotlightShape: Shape {
    let targetFrame: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()

        // Full rectangle
        path.addRect(rect)

        // Subtract spotlight hole
        if targetFrame != .zero {
            let spotlightRect = targetFrame.insetBy(dx: -10, dy: -10)
            path.addRoundedRect(
                in: spotlightRect,
                cornerSize: CGSize(width: 16, height: 16)
            )
        }

        return path
    }
}

#Preview {
    ZStack {
        Color.blue.opacity(0.3)
            .ignoresSafeArea()

        EnhancedSpotlightMask(
            targetFrame: CGRect(x: 100, y: 300, width: 200, height: 80)
        )
    }
}
