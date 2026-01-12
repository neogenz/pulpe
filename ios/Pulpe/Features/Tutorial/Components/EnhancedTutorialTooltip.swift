import SwiftUI

/// Redesigned tutorial tooltip with dark gradient background
struct EnhancedTutorialTooltip: View {
    let step: TutorialStep
    let currentIndex: Int
    let totalSteps: Int
    let targetFrame: CGRect
    let containerSize: CGSize
    let onNext: () -> Void
    let onSkip: () -> Void

    @State private var cardOpacity: Double = 0
    @State private var cardOffset: CGFloat = 30

    private var isAboveTarget: Bool {
        let tooltipHeight: CGFloat = 220
        return targetFrame.maxY + tooltipHeight + 40 > containerSize.height
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 0) {
            // Arrow pointing to target (below card if card is above target)
            if !isAboveTarget {
                arrowIndicator
                    .rotationEffect(.degrees(180))
            }

            // Card content
            VStack(alignment: .leading, spacing: 16) {
                // Header with dots and skip
                HStack {
                    // Step dots
                    HStack(spacing: 6) {
                        ForEach(0..<totalSteps, id: \.self) { index in
                            Circle()
                                .fill(index == currentIndex ? Color.pulpePrimary : Color.white.opacity(0.3))
                                .frame(width: 8, height: 8)
                        }
                    }

                    Spacer()

                    Button {
                        onSkip()
                    } label: {
                        Text("Passer")
                            .font(.system(size: 13, weight: .medium))
                            .foregroundStyle(.white.opacity(0.7))
                    }
                }

                // Title with icon
                HStack(spacing: 10) {
                    Image(systemName: step.iconName)
                        .font(.system(size: 22, weight: .medium))
                        .foregroundStyle(Color.pulpePrimary)

                    Text(step.title)
                        .font(PulpeTypography.tutorialTitle)
                        .foregroundStyle(.white)
                }

                // Description
                Text(step.description)
                    .font(PulpeTypography.tutorialBody)
                    .foregroundStyle(.white.opacity(0.85))
                    .lineSpacing(4)
                    .fixedSize(horizontal: false, vertical: true)

                // Action button
                Button(action: onNext) {
                    HStack(spacing: 8) {
                        Text(currentIndex == totalSteps - 1 ? "Terminer" : "Suivant")
                            .font(.system(size: 15, weight: .semibold))

                        Image(systemName: currentIndex == totalSteps - 1 ? "checkmark" : "arrow.right")
                            .font(.system(size: 12, weight: .bold))
                    }
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .frame(maxWidth: .infinity)
                    .frame(height: 48)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 12))
                }
            }
            .padding(20)
            .background(
                RoundedRectangle(cornerRadius: 20)
                    .fill(
                        LinearGradient(
                            colors: [Color(hex: 0x1E1E1E), Color(hex: 0x2A2A2A)],
                            startPoint: .top,
                            endPoint: .bottom
                        )
                    )
                    .shadow(color: .black.opacity(0.4), radius: 20, y: 10)
            )

            // Arrow pointing to target (above card if card is below target)
            if isAboveTarget {
                arrowIndicator
            }
        }
        .frame(maxWidth: 340)
        .position(tooltipPosition)
        .opacity(cardOpacity)
        .offset(y: cardOffset)
        .onAppear {
            withAnimation(PulpeAnimations.defaultSpring) {
                cardOpacity = 1
                cardOffset = 0
            }
        }
    }

    private var arrowIndicator: some View {
        Triangle()
            .fill(Color(hex: 0x2A2A2A))
            .frame(width: 20, height: 12)
            .offset(x: calculateArrowOffset())
    }

    private var tooltipPosition: CGPoint {
        let padding: CGFloat = 24
        let tooltipHeight: CGFloat = 220

        let y: CGFloat
        if isAboveTarget {
            y = targetFrame.minY - padding - tooltipHeight / 2
        } else {
            y = targetFrame.maxY + padding + tooltipHeight / 2
        }

        return CGPoint(x: containerSize.width / 2, y: y)
    }

    private func calculateArrowOffset() -> CGFloat {
        let cardCenterX = containerSize.width / 2
        let targetCenterX = targetFrame.midX
        return targetCenterX - cardCenterX
    }
}

/// Triangle shape for arrow indicator
struct Triangle: Shape {
    func path(in rect: CGRect) -> Path {
        var path = Path()
        path.move(to: CGPoint(x: rect.midX, y: rect.maxY))
        path.addLine(to: CGPoint(x: rect.minX, y: rect.minY))
        path.addLine(to: CGPoint(x: rect.maxX, y: rect.minY))
        path.closeSubpath()
        return path
    }
}

#Preview {
    ZStack {
        Color.black.opacity(0.8)
            .ignoresSafeArea()

        EnhancedTutorialTooltip(
            step: .progressBar,
            currentIndex: 0,
            totalSteps: 4,
            targetFrame: CGRect(x: 20, y: 120, width: 350, height: 80),
            containerSize: CGSize(width: 393, height: 852),
            onNext: {},
            onSkip: {}
        )
    }
}
