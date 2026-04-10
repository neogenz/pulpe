import SwiftUI

/// A gradient fade overlay for scroll edges.
/// Fades content into the background color — clean on both light and dark themes.
struct ProgressiveBlurEdge: View {
    enum Edge { case top, bottom }

    let edge: Edge
    let height: CGFloat
    let tintColor: Color

    var body: some View {
        LinearGradient(
            colors: edge == .bottom
                ? [tintColor.opacity(0), tintColor]
                : [tintColor, tintColor.opacity(0)],
            startPoint: .top,
            endPoint: .bottom
        )
        .frame(height: height)
        .allowsHitTesting(false)
    }
}

#Preview {
    ZStack {
        ScrollView {
            VStack(spacing: 0) {
                ForEach(0..<20, id: \.self) { i in
                    Text("Row \(i)")
                        .frame(maxWidth: .infinity)
                        .padding()
                        .background(Color(hue: Double(i) / 20, saturation: 0.3, brightness: 0.9))
                }
            }
        }

        VStack {
            ProgressiveBlurEdge(edge: .top, height: DesignTokens.Blur.topFadeHeight, tintColor: .white)
            Spacer()
            ProgressiveBlurEdge(edge: .bottom, height: DesignTokens.Blur.bottomFadeHeight, tintColor: .white)
        }
    }
}
