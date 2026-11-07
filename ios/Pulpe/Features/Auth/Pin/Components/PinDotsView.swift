import SwiftUI

struct PinDotsView: View {
    let enteredCount: Int
    let maxDigits: Int
    let isError: Bool
    var isValidating: Bool = false

    @State private var shakeOffset: CGFloat = 0
    @State private var pulseScale: CGFloat = 1.0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            ForEach(0..<maxDigits, id: \.self) { index in
                let isFilled = index < enteredCount
                Circle()
                    .fill(isFilled && !isError ? Color.textPrimary : Color.clear)
                    .overlay { Circle().strokeBorder(ringColor, lineWidth: DesignTokens.BorderWidth.thick) }
                    .frame(width: DesignTokens.Numpad.dotSize, height: DesignTokens.Numpad.dotSize)
                    .animation(.spring(response: 0.2, dampingFraction: 0.7), value: isFilled)
                    .scaleEffect(isValidating && isFilled ? pulseScale : 1.0)
            }
        }
        .offset(x: shakeOffset)
        .accessibilityHidden(true)
        .onChange(of: isValidating) { _, validating in
            guard !reduceMotion else { return }
            if validating {
                withAnimation(DesignTokens.Animation.pulse) {
                    pulseScale = 0.7
                }
            } else {
                withAnimation(.spring(response: 0.2, dampingFraction: 0.7)) {
                    pulseScale = 1.0
                }
            }
        }
        .onChange(of: isError) { _, newValue in
            guard newValue else { return }
            guard !reduceMotion else { return }
            withAnimation(.easeInOut(duration: 0.08).repeatCount(5, autoreverses: true)) {
                shakeOffset = 10
            } completion: {
                shakeOffset = 0
            }
        }
    }

    /// Every ring turns red on an error: the digits are cleared at that moment, so only rings are left to show it.
    private var ringColor: Color {
        isError ? Color.errorPrimary : Color.textPrimary
    }
}

#Preview {
    ZStack {
        Color.appBackground
        VStack(spacing: 40) {
            PinDotsView(enteredCount: 0, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 2, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 4, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 4, maxDigits: 4, isError: true)
        }
    }
}
