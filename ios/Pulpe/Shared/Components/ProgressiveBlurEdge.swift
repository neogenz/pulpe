import SwiftUI
import VariableBlur

/// Progressive blur overlay for scroll edges.
/// Uses VariableBlurView (same private API Apple uses in Music/Photos)
/// for real gaussian blur that fades from max to zero — works on any background.
struct ProgressiveBlurEdge: View {
    enum Edge { case top, bottom }

    let edge: Edge
    let height: CGFloat
    var maxBlurRadius: CGFloat = 8

    var body: some View {
        VariableBlurView(
            maxBlurRadius: maxBlurRadius,
            direction: edge == .top ? .blurredTopClearBottom : .blurredBottomClearTop
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
            ProgressiveBlurEdge(edge: .top, height: DesignTokens.Blur.topFadeHeight)
            Spacer()
            ProgressiveBlurEdge(edge: .bottom, height: DesignTokens.Blur.bottomFadeHeight)
        }
    }
}
