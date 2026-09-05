import SwiftUI

/// The nature disc that opens a ledger row, and the control that points it.
///
/// Unpointed: the kind's glyph on a wash of its tint (`RowIcon`) inside a ring of the tint,
/// which is what says "to tick" before the first tap. Pointed: a full disc in the tint with
/// a checkmark. 44×44 hit area around a 36pt disc; the parent owns the state.
/// Uses `Button` so the tap is visible to VoiceOver independently of the row's own target.
struct PointCircle: View {
    let kind: TransactionKind
    let isPointed: Bool
    let color: Color
    let isSyncing: Bool
    var onPrepareToggle: () -> Bool = { true }
    var onCompletionStateChange: (Bool) -> Void = { _ in }
    let onToggle: () -> Void

    /// Debounced sync state — only flips true if the toggle takes >300 ms,
    /// so fast optimistic updates don't trigger a green-dot flash.
    @State private var displayedSyncing = false
    @State private var sheenTrigger = 0
    @State private var isCompleting = false
    @State private var successFeedbackTrigger = 0
    @State private var selectionFeedbackTrigger = 0
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    private var displayedIsPointed: Bool { isPointed || isCompleting }

    /// The unpointed ring, broken into short segments: the row is a draft until the tap
    /// closes it, and a solid outline said nothing about that. Pointed, the disc fills and
    /// the ring goes with it, so there is no dashed state left to contradict the check.
    ///
    /// Derived from the stroked circle's own circumference — `strokeBorder` insets by half
    /// the line width — so the segments meet where they started. A dash measured in points
    /// leaves a short one at the seam on any disc size that does not divide by it.
    private static let ringStrokeStyle: StrokeStyle = {
        let circumference = CGFloat.pi * (DesignTokens.IconSize.badge - DesignTokens.Checkbox.ringWidth)
        let period = circumference / DesignTokens.Checkbox.ringDashSegments
        let dash = period * DesignTokens.Checkbox.ringDashFill
        return StrokeStyle(lineWidth: DesignTokens.Checkbox.ringWidth, dash: [dash, period - dash])
    }()

    private var fillAnimation: Animation {
        .easeOut(duration: reduceMotion ? DesignTokens.Animation.microFadeIn : DesignTokens.Animation.normal)
    }

    private var checkAnimation: Animation {
        reduceMotion
            ? fillAnimation
            : .spring(response: DesignTokens.Animation.quickSnap, dampingFraction: 0.9)
                .delay(DesignTokens.Animation.microFadeOut)
    }

    private var completionAnimation: Animation {
        .easeOut(
            duration: reduceMotion
                ? DesignTokens.Animation.microFadeIn
                : DesignTokens.Checkbox.completionHold
        )
    }

    var body: some View {
        Button(action: handleToggle) {
            ZStack {
                RowIcon(systemName: kind.icon, tint: color)
                    .overlay {
                        Circle().strokeBorder(color, style: Self.ringStrokeStyle)
                    }
                    .overlay {
                        Circle()
                            .strokeBorder(
                                AngularGradient(
                                    colors: [
                                        .clear,
                                        .clear,
                                        .clear,
                                        .white.opacity(DesignTokens.Checkbox.sheenOpacity),
                                        .clear,
                                        .clear,
                                        .clear,
                                    ],
                                    center: .center
                                ),
                                // Same broken pattern as the ring it lights: solid, the
                                // sweep would paint a highlight across the gaps.
                                style: Self.ringStrokeStyle
                            )
                            .keyframeAnimator(
                                initialValue: PointCircleSheenValues(),
                                trigger: sheenTrigger
                            ) { content, value in
                                content
                                    .rotationEffect(.degrees(value.angle))
                                    .opacity(value.opacity)
                            } keyframes: { _ in
                                KeyframeTrack(\.angle) {
                                    LinearKeyframe(
                                        DesignTokens.Checkbox.sheenStartAngle,
                                        duration: DesignTokens.Checkbox.sheenDelay
                                    )
                                    CubicKeyframe(
                                        DesignTokens.Checkbox.sheenEndAngle,
                                        duration: DesignTokens.Checkbox.sheenDuration
                                    )
                                }
                                KeyframeTrack(\.opacity) {
                                    LinearKeyframe(0, duration: DesignTokens.Checkbox.sheenDelay)
                                    CubicKeyframe(
                                        DesignTokens.Checkbox.sheenOpacity,
                                        duration: DesignTokens.Animation.fast
                                    )
                                    CubicKeyframe(
                                        0,
                                        duration: DesignTokens.Checkbox.sheenDuration
                                            - DesignTokens.Animation.fast
                                    )
                                }
                            }
                            .allowsHitTesting(false)
                            .accessibilityHidden(true)
                    }
                    .scaleEffect(displayedIsPointed && !reduceMotion ? DesignTokens.Animation.settleScale : 1)
                    .opacity(displayedIsPointed ? 0 : 1)
                    .animation(fillAnimation, value: displayedIsPointed)

                Circle()
                    .fill(color)
                    .frame(width: DesignTokens.IconSize.badge, height: DesignTokens.IconSize.badge)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Checkbox.fillStartScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(fillAnimation, value: displayedIsPointed)

                Image(systemName: "checkmark")
                    .font(PulpeTypography.metricLabelBold)
                    .foregroundStyle(Color.textOnPrimary)
                    .scaleEffect(
                        reduceMotion || displayedIsPointed ? 1 : DesignTokens.Animation.settleScale
                    )
                    .opacity(displayedIsPointed ? 1 : 0)
                    .animation(checkAnimation, value: displayedIsPointed)

                if displayedSyncing {
                    SyncIndicator(isSyncing: true)
                        .offset(
                            x: DesignTokens.IconSize.badge / 2 - DesignTokens.Checkbox.syncBadgeInset,
                            y: -DesignTokens.IconSize.badge / 2 + DesignTokens.Checkbox.syncBadgeInset
                        )
                }
            }
            .frame(
                width: DesignTokens.TapTarget.minimum,
                height: DesignTokens.TapTarget.minimum
            )
            .contentShape(Circle())
        }
        .buttonStyle(PointCirclePressStyle(reduceMotion: reduceMotion))
        .disabled(isCompleting || isSyncing)
        .sensoryFeedback(.success, trigger: successFeedbackTrigger)
        .sensoryFeedback(.selection, trigger: selectionFeedbackTrigger)
        .rampSyncIndicator(isSyncing: isSyncing, displayed: $displayedSyncing)
        .task(id: displayedIsPointed) {
            guard !reduceMotion, !displayedIsPointed else { return }
            sheenTrigger += 1
        }
        .onChange(of: isPointed) {
            if isPointed { finishCompletion() }
        }
        .accessibilityLabel(displayedIsPointed ? "Pointé" : "À pointer")
        .accessibilityAddTraits(displayedIsPointed ? [.isButton, .isSelected] : .isButton)
    }

    private func handleToggle() {
        guard !isCompleting else { return }
        guard onPrepareToggle() else { return }
        guard !isPointed else {
            selectionFeedbackTrigger += 1
            onToggle()
            return
        }

        successFeedbackTrigger += 1
        withAnimation(completionAnimation) {
            isCompleting = true
            onCompletionStateChange(true)
        } completion: {
            onToggle()
        }
    }

    private func finishCompletion() {
        guard isCompleting else { return }
        isCompleting = false
        onCompletionStateChange(false)
    }
}

@MainActor
final class PointCompletionGate {
    var isPending = false
}

private struct PointCircleSheenValues {
    var angle = DesignTokens.Checkbox.sheenStartAngle
    var opacity = 0.0
}

/// A flick under the finger: the disc dips while pressed and springs back, faster out than
/// in. Nothing moves under Reduce Motion.
private struct PointCirclePressStyle: ButtonStyle {
    let reduceMotion: Bool

    func makeBody(configuration: Configuration) -> some View {
        configuration.label
            .scaleEffect(configuration.isPressed && !reduceMotion ? DesignTokens.Checkbox.pressedScale : 1)
            .animation(
                reduceMotion ? nil : .spring(response: 0.2, dampingFraction: 0.8),
                value: configuration.isPressed
            )
    }
}
