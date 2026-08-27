import SwiftUI

// Split out of `DesignTokens.swift` to keep that file under the 500-line lint ceiling.
extension DesignTokens {
    enum Animation {
        // MARK: - Duration

        static let fast: Double = 0.2
        /// Chrome that appears or retires (sticky bars, pills): in under a glance, out faster.
        static let microFadeIn: Double = 0.16
        static let microFadeOut: Double = 0.1
        /// Drag distance that commits a leading swipe action on a ledger row.
        static let swipeCommitDistance: CGFloat = 72
        /// `UIScrollView.DecelerationRate.normal` — the rate WWDC18 *Designing Fluid
        /// Interfaces* projects a flick's resting point with.
        static let swipeDecelerationRate: CGFloat = 0.998
        /// Settle of a row the finger just let go of. Direct manipulation, so it is short
        /// and lands without bounce — an overshoot would carry the revealed actions past
        /// their own trailing edge. `gentleSpring` is the wrong tool here: at a 0.6s
        /// response it leaves a released row drifting long after the finger has moved on.
        ///
        /// `interpolatingSpring` reads this as the spring's *period*, not as how long it
        /// takes to arrive: the settling time constant is `duration / 2π`, and the strip
        /// needs about five of those to land. At 0.32 that measured 59ms per constant and
        /// 390ms to come to rest — a finger crossing 80pt in 60ms was answered by a strip
        /// that took three times as long to cover half that, which is the stutter a fast
        /// flick showed. 0.18 measures 37ms per constant and 232ms to come to rest.
        static let swipeSettleDuration: Double = 0.18
        static let swipeSettleBounce: Double = 0
        /// Ceiling on the release velocity handed to that settle, counted in travels-worth
        /// of distance per second. Uncapped, a hard flick with a few points left to cover
        /// normalises to a number that crosses the whole travel inside one frame.
        static let swipeSettleMaxVelocity: CGFloat = 18
        static let quickSnap: Double = 0.25
        static let normal: Double = 0.3
        static let slow: Double = 0.5

        // MARK: - Stagger

        static let staggerStep: Double = 0.05

        // MARK: - Spring Configurations

        static let springResponse: Double = 0.5
        static let springDamping: Double = 0.8

        static var defaultSpring: SwiftUI.Animation {
            .spring(response: springResponse, dampingFraction: springDamping)
        }

        static var gentleSpring: SwiftUI.Animation {
            .spring(response: 0.6, dampingFraction: 0.85)
        }

        static var bouncySpring: SwiftUI.Animation {
            .spring(response: 0.4, dampingFraction: 0.65)
        }

        static var entranceSpring: SwiftUI.Animation {
            .spring(response: 0.6, dampingFraction: 0.8)
        }

        // MARK: - Easing

        /// Scale a confirmed element settles to as it resolves away (check-exit transition).
        static let settleScale: CGFloat = 0.94

        static var smoothEaseOut: SwiftUI.Animation {
            .easeOut(duration: normal)
        }

        static var smoothEaseInOut: SwiftUI.Animation {
            .easeInOut(duration: normal)
        }

        static var quickEaseInOut: SwiftUI.Animation {
            .easeInOut(duration: quickSnap)
        }

        // MARK: - Step Transitions

        static var stepTransition: SwiftUI.Animation {
            .spring(response: 0.5, dampingFraction: 0.85)
        }

        /// FAB ↔ full-width onboarding CTA — one continuous control (layout + content).
        static var onboardingCTAMorph: SwiftUI.Animation {
            .spring(response: 0.48, dampingFraction: 0.88)
        }

        static var iconEntrance: SwiftUI.Animation {
            .spring(response: 0.5, dampingFraction: 0.7)
        }

        // MARK: - Toast

        static var toastEntrance: SwiftUI.Animation {
            .spring(response: 0.4, dampingFraction: 0.7)
        }

        static var toastDismiss: SwiftUI.Animation {
            .easeOut(duration: fast)
        }

        /// Beat between the last PIN digit landing and the auto-submission that
        /// follows it. Without it the final dot fills and clears in the same
        /// frame, and the user never sees the code they just typed.
        static let pinAutoSubmitSettle: Duration = .milliseconds(180)

        static let pulseDuration: Double = 0.6

        static var pulse: SwiftUI.Animation {
            .easeInOut(duration: pulseDuration).repeatForever(autoreverses: true)
        }

        /// Slow breathing effect for brand heroes (glow/shadow opacity oscillation).
        /// Deliberately slow so it feels like ambient life, not a notification.
        static let heroBreathingDuration: Double = 3.5

        static var heroBreathing: SwiftUI.Animation {
            .easeInOut(duration: heroBreathingDuration).repeatForever(autoreverses: true)
        }

        // MARK: - Push transition timings (BudgetDetails feature pattern)

        /// Grace window after a pushed page detects its target model has
        /// disappeared, before auto-popping. Gives Observation the chance to
        /// settle on the first push frame so a transient lookup miss during
        /// reload races does not pop a freshly-pushed page.
        static let autoPopGraceMs: UInt64 = 150

        /// Delay between view appearance and programmatic focus on a form
        /// field, so the push transition completes before the keyboard rises.
        /// Matches `SheetFormContainer` autofocus behavior.
        static let pushAutofocusDelayMs: UInt64 = 200

        // MARK: - Skeleton

        /// Minimum skeleton display time to prevent jarring flash on fast loads
        static let skeletonMinimumDuration: Duration = .milliseconds(400)

        /// Waits until at least the minimum skeleton duration has elapsed since `start`.
        /// Call after an async fetch that was preceded by showing a skeleton.
        /// - Important: Throws `CancellationError` if the task is cancelled during the wait.
        static func ensureMinimumSkeletonTime(since start: ContinuousClock.Instant) async throws {
            let elapsed = ContinuousClock.now - start
            if elapsed < skeletonMinimumDuration {
                try await Task.sleep(for: skeletonMinimumDuration - elapsed)
            }
        }
    }
}
