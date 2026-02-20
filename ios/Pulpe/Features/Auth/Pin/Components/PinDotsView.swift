import SwiftUI

struct PinDotsView: View {
    let enteredCount: Int
    let maxDigits: Int
    let isError: Bool

    @State private var shakeOffset: CGFloat = 0

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.lg) {
            ForEach(0..<maxDigits, id: \.self) { index in
                Circle()
                    .fill(dotColor(at: index))
                    .frame(width: 14, height: 14)
                    .scaleEffect(index < enteredCount ? 1.0 : 0.7)
                    .animation(.spring(response: 0.2, dampingFraction: 0.7), value: enteredCount)
            }
        }
        .offset(x: shakeOffset)
        .onChange(of: isError) { _, newValue in
            guard newValue else { return }
            withAnimation(.easeInOut(duration: 0.08).repeatCount(5, autoreverses: true)) {
                shakeOffset = 10
            } completion: {
                shakeOffset = 0
            }
        }
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
        Color.pinBackground.ignoresSafeArea()
        VStack(spacing: 40) {
            PinDotsView(enteredCount: 0, maxDigits: 6, isError: false)
            PinDotsView(enteredCount: 3, maxDigits: 6, isError: false)
            PinDotsView(enteredCount: 6, maxDigits: 6, isError: false)
            PinDotsView(enteredCount: 4, maxDigits: 6, isError: true)
        }
    }
}
