import SwiftUI

// ponytail: no rubber-band past the buttons, no full-swipe commit; add when asked.

/// List-style trailing swipe on a row that lives outside a `List`: dragging the row to the
/// left slides it off its buttons, which stay revealed once the pull passes half their
/// width. One row per group is open at a time, through the shared `openId`.
///
/// Off under VoiceOver and Switch Control, where the caller exposes the same actions as
/// accessibility actions. A vertical pan keeps scrolling: the drag sits at the lowest priority,
/// so the scroll view takes it and hands over only the horizontal pulls it refuses.
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
    private var offset: CGFloat { (isOpen ? -width : 0) + dragOffset }

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
            .animation(reduceMotion ? nil : DesignTokens.Animation.gentleSpring, value: offset)
            .gesture(drag, including: voiceOver || switchControl ? .none : .all)
    }

    private var drag: some Gesture {
        DragGesture(minimumDistance: DesignTokens.Spacing.xl)
            .onChanged { value in
                let dx = value.translation.width
                // Only a clearly horizontal pull moves the row; a vertical one is the scroll's.
                guard abs(dx) > abs(value.translation.height) else { dragOffset = 0; return }
                dragOffset = min(max(dx, isOpen ? 0 : -width), isOpen ? width : 0)
            }
            .onEnded { value in
                let rests = Self.restingOffset(translation: value.translation.width, wasOpen: isOpen, width: width)
                dragOffset = 0
                // Any pull that ends closed also closes whichever row of the group was open.
                openId = rests < 0 ? id : nil
            }
    }

    /// Where the row settles once the finger lifts: open past half the buttons' width,
    /// closed before it, measured from where the row started.
    static func restingOffset(translation: CGFloat, wasOpen: Bool, width: CGFloat) -> CGFloat {
        let start: CGFloat = wasOpen ? -width : 0
        return start + translation < -width / 2 ? -width : 0
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
