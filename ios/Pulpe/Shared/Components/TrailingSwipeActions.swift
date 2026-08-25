import SwiftUI

// ponytail: no full-swipe commit; add when asked.

/// List-style trailing swipe on a row that lives outside a `List`: dragging the row to the
/// left slides it off its buttons, which stay revealed once the flick's projected resting
/// point passes half their width. One row per group is open at a time, through the shared
/// `openId`. The row tracks the finger 1:1, resists past either end of its travel, and
/// springs only on release.
///
/// Off under VoiceOver and Switch Control, where the caller exposes the same actions as
/// accessibility actions. A vertical pan keeps scrolling because the pull runs on
/// `HorizontalPanGesture`, which declines the touch outright when the finger is going
/// vertically — see that type for why no `DragGesture` priority can do the same.
struct TrailingSwipeActions<Actions: View>: ViewModifier {
    let id: AnyHashable
    @Binding var openId: AnyHashable?
    let actions: Actions

    @State private var dragOffset: CGFloat = 0
    @State private var width: CGFloat = 0
    @Environment(\.accessibilityVoiceOverEnabled) private var voiceOver
    @Environment(\.accessibilitySwitchControlEnabled) private var switchControl
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var isOpen: Bool { openId == id }
    /// Where the row starts the gesture, and where it returns once `dragOffset` clears.
    private var restingStart: CGFloat { isOpen ? -width : 0 }
    private var offset: CGFloat { restingStart + dragOffset }

    func body(content: Content) -> some View {
        content
            .offset(x: offset)
            // A row that is open closes on a tap, the way a `List` row does; a closed one
            // carries no tap recognizer to compete with whatever the row holds.
            .gesture(TapGesture().onEnded { openId = nil }, including: isOpen ? .all : .none)
            .background(alignment: .trailing) {
                HStack(spacing: 0) { actions }
                    .onGeometryChange(for: CGFloat.self, of: { $0.size.width }, action: { width = $0 })
                    .offset(x: width + offset)
                    .accessibilityHidden(true)
            }
            .clipped()
            .gesture(
                HorizontalPanGesture(
                    isEnabled: !voiceOver && !switchControl,
                    onChange: track,
                    onEnd: settle,
                    onCancel: { withAnimation(spring) { dragOffset = 0 } }
                )
            )
    }

    /// The row follows the finger, resisting past either end of its travel so it never
    /// slides off screen.
    private func track(_ dx: CGFloat) {
        // Before the buttons are measured every translation would clamp to zero, which
        // would swallow the first swipe of a freshly laid-out row.
        guard width > 0 else { return }
        let reached = restingStart + dx
        let withinTravel = min(0, max(-width, reached))
        let overshoot = reached - withinTravel
        dragOffset = withinTravel + overshoot / 4 - restingStart
    }

    private func settle(_ dx: CGFloat, _ velocity: CGFloat) {
        let rests = Self.restingOffset(translation: dx, velocity: velocity, wasOpen: isOpen, width: width)
        withAnimation(spring) {
            dragOffset = 0
            // Any pull that ends closed also closes whichever row of the group was open.
            openId = rests < 0 ? id : nil
        }
    }

    private var spring: SwiftUI.Animation? {
        reduceMotion ? nil : DesignTokens.Animation.gentleSpring
    }

    /// Where the row settles once the finger lifts: open past half the buttons' width,
    /// closed before it, measured from where the row started. The point compared is the one
    /// the flick is *heading* for — WWDC18 *Designing Fluid Interfaces* projects it from the
    /// release velocity and the platform's deceleration rate — so a short fast flick opens
    /// the row the way a `List` row does. At zero velocity this is the raw translation.
    static func restingOffset(
        translation: CGFloat,
        velocity: CGFloat,
        wasOpen: Bool,
        width: CGFloat
    ) -> CGFloat {
        let start: CGFloat = wasOpen ? -width : 0
        let rate = DesignTokens.Animation.swipeDecelerationRate
        let projected = translation + (velocity / 1000) * rate / (1 - rate)
        return start + projected < -width / 2 ? -width : 0
    }
}

extension View {
    /// Trailing swipe revealing `actions`; `openId` keeps one row of the group open at a time.
    func trailingSwipeActions(
        id: some Hashable,
        openId: Binding<AnyHashable?>,
        @ViewBuilder actions: () -> some View
    ) -> some View {
        modifier(TrailingSwipeActions(id: AnyHashable(id), openId: openId, actions: actions()))
    }
}
