import SwiftUI

// Split out of `DesignTokens.swift` to keep that file under the 500-line lint ceiling.
extension DesignTokens {
    enum Animation {
        // MARK: - Duration

        static let fast: Double = 0.2
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
