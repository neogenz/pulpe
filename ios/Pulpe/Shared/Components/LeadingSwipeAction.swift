import SwiftUI

/// Mail-style leading swipe on a row that lives outside a `List`: dragging the row to the
/// right reveals a tinted band with a glyph, and crossing `swipeCommitDistance` commits the
/// action on release with a haptic. The row snaps back either way; it never stays open.
///
/// Off under VoiceOver and Switch Control, where the row's own button carries the action.
/// A vertical pan keeps scrolling because the pull runs on `HorizontalPanGesture`, which
/// declines the touch outright when the finger is going vertically — see that type for why
/// no `DragGesture` priority can do the same. The band tracks the finger 1:1 and springs
/// only on release.
struct LeadingSwipeAction: ViewModifier {
    let systemImage: String
    let tint: Color
    let isEnabled: () -> Bool
    let action: () -> Void

    @State private var offset: CGFloat = 0
    @State private var commitCount = 0
    @State private var isTracking = false
    @State private var gestureWasEnabled = false
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
            .sensoryFeedback(.success, trigger: commitCount)
            .gesture(
                HorizontalPanGesture(
                    isEnabled: isEnabled() && !voiceOver && !switchControl,
                    onChange: track,
                    onEnd: commitIfArmed,
                    onCancel: settle
                )
            )
    }

    /// The band follows the finger, resisting past the commit point so the row never flies off.
    private func track(_ dx: CGFloat) {
        if !isTracking {
            isTracking = true
            gestureWasEnabled = isEnabled()
        }
        guard gestureWasEnabled else { return }
        // A leftward pull reveals nothing; the axis itself is the recognizer's call.
        guard dx > 0 else { offset = 0; return }
        let over = max(0, dx - DesignTokens.Animation.swipeCommitDistance)
        offset = min(dx, DesignTokens.Animation.swipeCommitDistance) + over / 4
    }

    private func commitIfArmed() {
        if gestureWasEnabled, isEnabled(), isArmed {
            commitCount += 1
            action()
        }
        settle()
    }

    private func settle() {
        isTracking = false
        gestureWasEnabled = false
        withAnimation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring) { offset = 0 }
    }
}

extension View {
    /// Leading swipe that runs `action` once the row is pulled past the commit distance.
    func leadingSwipeAction(
        systemImage: String,
        tint: Color,
        isEnabled: @escaping () -> Bool = { true },
        action: @escaping () -> Void
    ) -> some View {
        modifier(LeadingSwipeAction(systemImage: systemImage, tint: tint, isEnabled: isEnabled, action: action))
    }
}
