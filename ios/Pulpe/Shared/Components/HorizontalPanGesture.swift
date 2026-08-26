import SwiftUI
import UIKit

/// A `UIPanGestureRecognizer` bridged into SwiftUI that only ever begins for a horizontal
/// pull, so an enclosing `ScrollView` keeps every vertical one — including the fast flick
/// whose finger is already moving the instant it lands.
///
/// This exists because a `DragGesture` cannot do it. Its `minimumDistance` is radial, so a
/// finger already travelling downward crosses it inside the first delivered touch event and
/// the drag claims the pull before any axis test in `onChanged` runs. No SwiftUI gesture
/// priority repairs that: `gesture`, `highPriorityGesture` and `simultaneousGesture` only
/// order a view's own SwiftUI gestures against each other, never against the scroll view's
/// UIKit pan. All three shipped on `LeadingSwipeAction` and all three killed the scroll —
/// `highPriorityGesture` in e03ba3661, `simultaneousGesture` in 1e9709ad0, plain `gesture`
/// in 090cf95b8. Only a UIKit recognizer can decline the touch, which is what
/// `gestureRecognizerShouldBegin` does here.
///
/// Translation is read in window space: the rows this drives carry an
/// `.offset` that moves their own coordinate space mid-gesture, which would otherwise feed
/// back into the translation.
struct HorizontalPanGesture: UIGestureRecognizerRepresentable {
    /// Mirrored onto the recognizer, so a disabled row neither reveals anything nor swallows a pan.
    let isEnabled: Bool
    /// Horizontal translation while the finger moves.
    let onChange: (CGFloat) -> Void
    /// The finger lifted.
    let onEnd: () -> Void
    /// The gesture was taken away — by a system gesture, or by the recognizer failing.
    let onCancel: () -> Void

    func makeCoordinator(converter: CoordinateSpaceConverter) -> Coordinator {
        Coordinator()
    }

    func makeUIGestureRecognizer(context: Context) -> UIPanGestureRecognizer {
        let recognizer = UIPanGestureRecognizer()
        recognizer.maximumNumberOfTouches = 1
        recognizer.delegate = context.coordinator
        recognizer.isEnabled = isEnabled
        return recognizer
    }

    func updateUIGestureRecognizer(_ recognizer: UIPanGestureRecognizer, context: Context) {
        recognizer.isEnabled = isEnabled
    }

    func handleUIGestureRecognizerAction(_ recognizer: UIPanGestureRecognizer, context: Context) {
        switch recognizer.state {
        case .changed:
            onChange(recognizer.translation(in: nil).x)
        case .ended:
            onEnd()
        case .cancelled, .failed:
            onCancel()
        default:
            break
        }
    }

    /// Decides the axis once, at the first touch, from the pan's own velocity — the canonical
    /// UIKit test for a horizontal pan living inside a vertical scroll view. Deciding once
    /// also means a drag that curves downward keeps the row it already picked up.
    @MainActor
    final class Coordinator: NSObject, UIGestureRecognizerDelegate {
        func gestureRecognizerShouldBegin(_ gestureRecognizer: UIGestureRecognizer) -> Bool {
            guard let pan = gestureRecognizer as? UIPanGestureRecognizer else { return true }
            let velocity = pan.velocity(in: nil)
            return abs(velocity.x) > abs(velocity.y)
        }
    }
}
