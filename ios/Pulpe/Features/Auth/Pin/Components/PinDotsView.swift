import SwiftUI

struct PinDotsView: View {
    let enteredCount: Int
    let maxDigits: Int
    let isError: Bool
    var isValidating: Bool = false

    @State private var shakeOffset: CGFloat = 0
    @State private var pulseScale: CGFloat = 1.0

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            ForEach(0..<maxDigits, id: \.self) { index in
                Circle()
                    .fill(dotColor(at: index))
                    .frame(width: DesignTokens.Numpad.dotSize, height: DesignTokens.Numpad.dotSize)
                    .scaleEffect(dotScale(at: index))
                    .animation(.spring(response: 0.2, dampingFraction: 0.7), value: enteredCount)
            }
        }
        .offset(x: shakeOffset)
        .accessibilityHidden(true)
        .onChange(of: isError) { _, newValue in
            guard newValue else { return }
            withAnimation(.easeInOut(duration: 0.08).repeatCount(5, autoreverses: true)) {
                shakeOffset = 10
            } completion: {
                shakeOffset = 0
            }
        }
        .onChange(of: isValidating) { _, validating in
            if validating {
                withAnimation(DesignTokens.Animation.pulse) {
                    pulseScale = 0.7
                }
            } else {
                // Kill the repeatForever animation by setting the value
                // without any animation context first, then spring to rest.
                var transaction = SwiftUI.Transaction()
                transaction.animation = nil
                withTransaction(transaction) {
                    pulseScale = 1.0
                }
            }
        }
    }

    private func dotScale(at index: Int) -> CGFloat {
        if isValidating && index < enteredCount {
            return pulseScale
        }
        return index < enteredCount ? 1.0 : 0.7
    }

    private func dotColor(at index: Int) -> Color {
        if isError && index < enteredCount {
            return .errorPrimary
        }
        return index < enteredCount ? Color.pinDotFilled : Color.pinDotEmpty
    }
}

#Preview {
    ZStack {
        Color.loginGradientBackground
        VStack(spacing: 40) {
            PinDotsView(enteredCount: 0, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 2, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 4, maxDigits: 4, isError: false)
            PinDotsView(enteredCount: 4, maxDigits: 4, isError: true)
        }
    }
}
