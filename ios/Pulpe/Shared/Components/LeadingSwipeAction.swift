import SwiftUI

/// Mail-style leading swipe on a row that lives outside a `List`: dragging the row to the
/// right reveals a tinted band with a glyph, and crossing `swipeCommitDistance` commits the
/// action on release with a haptic. The row snaps back either way; it never stays open.
///
/// Off under VoiceOver and Switch Control, where the row's own button carries the action.
/// A vertical pan keeps scrolling: the drag is attached at the lowest priority (`gesture`,
/// never `highPriorityGesture` or `simultaneousGesture`, both of which let its radial
/// `minimumDistance` claim a downward pan and leave the finger scrolling nothing), so the
/// scroll view takes the vertical pulls and hands over only the horizontal ones it refuses.
struct LeadingSwipeAction: ViewModifier {
    let systemImage: String
    let tint: Color
    let isEnabled: Bool
    let action: () -> Void

    @State private var offset: CGFloat = 0
    @State private var commitCount = 0
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @Environment(\.accessibilitySwitchControlEnabled) private var switchControl
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isArmed: Bool { offset >= DesignTokens.Animation.swipeCommitDistance }

    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            .background(alignment: .leading) {
                if offset > 0 {
                    Rectangle()
                        .fill(tint.opacity(isArmed ? 1 : DesignTokens.Opacity.accent))
                        .frame(width: offset)
                        .overlay(alignment: .leading) {
                            Image(systemName: systemImage)
                                .font(PulpeTypography.metricLabelBold)
                                .foregroundStyle(isArmed ? Color.textOnPrimary : tint)
                                .frame(width: DesignTokens.TapTarget.minimum)
                        }
                        .accessibilityHidden(true)
                }
            }
            .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: offset)
            .sensoryFeedback(.success, trigger: commitCount)
            .gesture(drag, including: isEnabled && !voiceOver && !switchControl ? .all : .none)
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: DesignTokens.Spacing.xl)
            .onChanged { value in
                let dx = value.translation.width
                // Only a clearly horizontal, rightward pull reveals the action.
                guard dx > 0, dx > abs(value.translation.height) else { offset = 0; return }
                // Resists past the commit point so the row never flies off.
                let over = max(0, dx - DesignTokens.Animation.swipeCommitDistance)
                offset = min(dx, DesignTokens.Animation.swipeCommitDistance) + over / 4
            }
            .onEnded { _ in
                if isArmed {
                    commitCount += 1
                    action()
                }
                offset = 0
            }
    }
}

extension View {
    /// Leading swipe that runs `action` once the row is pulled past the commit distance.
    func leadingSwipeAction(
        systemImage: String,
        tint: Color,
        isEnabled: Bool = true,
        action: @escaping () -> Void
    ) -> some View {
        modifier(LeadingSwipeAction(systemImage: systemImage, tint: tint, isEnabled: isEnabled, action: action))
    }
}
