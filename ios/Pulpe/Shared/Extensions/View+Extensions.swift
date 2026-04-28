import SwiftUI

// MARK: - Amount Visibility Environment
// Single custom EnvironmentValues entry in Pulpe; `@Entry` replaces manual EnvironmentKey (Xcode 16+).

extension EnvironmentValues {
    @Entry var amountsHidden: Bool = false
}

// MARK: - Sensitive Amount Modifier

private struct SensitiveAmountModifier: ViewModifier {
    @Environment(\.amountsHidden) private var amountsHidden

    func body(content: Content) -> some View {
        content
            .blur(radius: amountsHidden ? 8 : 0)
            .accessibilityHidden(amountsHidden)
            .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: amountsHidden)
    }
}

extension View {
    /// Blur this view when amounts are hidden (shake-to-hide feature)
    func sensitiveAmount() -> some View {
        modifier(SensitiveAmountModifier())
    }
}

// MARK: - Shake Gesture Detection

/// Invisible UIViewControllerRepresentable that stays first responder to receive motion events.
/// Motion events (shake) are delivered to the first responder and forwarded up the responder chain.
/// Without an active first responder, UIKit silently drops shake events — this VC ensures one always exists.
/// It re-claims first responder after returning from background via UIScene.didActivateNotification.
private struct ShakeDetectorRepresentable: UIViewControllerRepresentable {
    let action: () -> Void

    func makeUIViewController(context: Context) -> ShakeDetectorViewController {
        ShakeDetectorViewController(action: action)
    }

    func updateUIViewController(_ uiViewController: ShakeDetectorViewController, context: Context) {
        uiViewController.action = action
    }
}

private class ShakeDetectorViewController: UIViewController {
    var action: () -> Void
    private var activationObserver: NSObjectProtocol?

    init(action: @escaping () -> Void) {
        self.action = action
        super.init(nibName: nil, bundle: nil)
    }

    @available(*, unavailable)
    required init?(coder: NSCoder) { fatalError() }

    override var canBecomeFirstResponder: Bool { true }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        claimFirstResponderIfNeeded()

        // Re-claim first responder when app returns from background —
        // UIKit may have dropped the first responder during the transition.
        activationObserver = NotificationCenter.default.addObserver(
            forName: UIScene.didActivateNotification,
            object: nil,
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated {
                self?.claimFirstResponderIfNeeded()
            }
        }
    }

    override func viewWillDisappear(_ animated: Bool) {
        super.viewWillDisappear(animated)
        if let observer = activationObserver {
            NotificationCenter.default.removeObserver(observer)
            activationObserver = nil
        }
    }

    override func motionEnded(_ motion: UIEvent.EventSubtype, with event: UIEvent?) {
        guard motion == .motionShake else {
            super.motionEnded(motion, with: event)
            return
        }
        action()
    }

    /// Only become first responder if nobody else holds it (avoids stealing keyboard focus)
    private func claimFirstResponderIfNeeded() {
        guard !isFirstResponder,
              view?.window?.findFirstResponder() == nil
        else { return }
        becomeFirstResponder()
    }
}

private extension UIView {
    /// Walk the view hierarchy to find the current first responder, if any
    func findFirstResponder() -> UIResponder? {
        if isFirstResponder { return self }
        for subview in subviews {
            if let responder = subview.findFirstResponder() {
                return responder
            }
        }
        return nil
    }
}

extension View {
    /// Detect device shake gesture
    func onShake(perform action: @escaping () -> Void) -> some View {
        background(ShakeDetectorRepresentable(action: action))
    }
}

extension View {
    /// Apply modifier if value is not nil
    @ViewBuilder
    func ifLet<T, Content: View>(_ value: T?, transform: (Self, T) -> Content) -> some View {
        if let value {
            transform(self, value)
        } else {
            self
        }
    }

    /// Apply loading overlay
    func loadingOverlay(_ isLoading: Bool, message: String? = nil) -> some View {
        overlay {
            LoadingOverlay(isLoading: isLoading, message: message)
        }
    }

    /// Standard content card styling: spacing + flat surface background.
    func pulpeCard() -> some View {
        self
            .padding(DesignTokens.Spacing.lg)
            .pulpeCardBackground()
    }

    /// DA-compliant section header styling
    func pulpeSectionHeader() -> some View {
        self
            .font(PulpeTypography.headline)
            .foregroundStyle(Color.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Unified app background: neutral system background to let glass cards and hero card stand out
    func pulpeBackground() -> some View {
        modifier(PulpeBackgroundModifier())
    }
}

// MARK: - Background Modifiers

private struct PulpeBackgroundModifier: ViewModifier {
    func body(content: Content) -> some View {
        content.background {
            Color.appBackground.ignoresSafeArea()
        }
    }
}

// MARK: - Keyboard Extensions

extension View {
    /// Dismiss keyboard when tapping outside text fields.
    /// Uses a UIKit gesture recognizer that does not cancel touches in the view,
    /// avoiding gesture disambiguation delays with TextFields.
    func dismissKeyboardOnTap() -> some View {
        background(KeyboardDismissView())
    }
}

private struct KeyboardDismissView: UIViewRepresentable {
    func makeUIView(context: Context) -> UIView {
        let view = UIView()
        view.backgroundColor = .clear
        let tap = UITapGestureRecognizer(target: context.coordinator, action: #selector(Coordinator.dismiss))
        tap.cancelsTouchesInView = false
        view.addGestureRecognizer(tap)
        return view
    }

    func updateUIView(_ uiView: UIView, context: Context) {}

    func makeCoordinator() -> Coordinator { Coordinator() }

    @MainActor final class Coordinator {
        @objc func dismiss() {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
    }
}

// MARK: - Sheet Presentation

extension View {
    /// Standard sheet presentation used across all form sheets
    func standardSheetPresentation(
        detents: Set<PresentationDetent> = [.large]
    ) -> some View {
        self
            .presentationDetents(detents)
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(DesignTokens.CornerRadius.xl)
            .presentationBackground(Color.sheetBackground)
    }

    /// Sheet auto-sized to its intrinsic content height. Use for short, single-purpose
    /// sheets (pickers, confirmations) where a fixed pixel detent leaves dead space.
    func intrinsicSheetPresentation() -> some View {
        modifier(IntrinsicSheetPresentationModifier())
    }
}

private struct IntrinsicSheetContentHeightKey: PreferenceKey {
    static let defaultValue: CGFloat = 0
    static func reduce(value: inout CGFloat, nextValue: () -> CGFloat) {
        value = max(value, nextValue())
    }
}

private struct IntrinsicSheetPresentationModifier: ViewModifier {
    @State private var contentHeight: CGFloat = 0

    func body(content: Content) -> some View {
        content
            .background(
                GeometryReader { proxy in
                    Color.clear.preference(
                        key: IntrinsicSheetContentHeightKey.self,
                        value: proxy.size.height
                    )
                }
            )
            .onPreferenceChange(IntrinsicSheetContentHeightKey.self) { contentHeight = $0 }
            // Fall back to a 1pt detent (effectively hidden) instead of `.medium`
            // so the first frame doesn't flash to half-screen before the geometry
            // preference resolves the intrinsic height.
            .presentationDetents(contentHeight > 0 ? [.height(contentHeight)] : [.height(1)])
            .presentationDragIndicator(.visible)
            .presentationCornerRadius(DesignTokens.CornerRadius.xl)
            .presentationBackground(Color.sheetBackground)
    }
}

// MARK: - List Row Styling

extension View {
    /// Modifier for self-styled cards in List context.
    /// Use this when a card applies its own glass/background and shouldn't get List section styling.
    func listRowCustomStyled(
        insets: EdgeInsets = EdgeInsets(top: 8, leading: 16, bottom: 16, trailing: 16)
    ) -> some View {
        self
            .listRowInsets(insets)
            .listRowBackground(Color.clear)
            .listRowSeparator(.hidden)
    }
}

// MARK: - Card Modifiers

/// Flat card surface — depth via color contrast, not shadows (Liquid Glass era)
private struct CardBackgroundModifier: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(Color.surfaceContainerLowest, in: .rect(cornerRadius: cornerRadius))
            .clipShape(.rect(cornerRadius: cornerRadius))
    }
}

/// Liquid Glass for navigation-layer elements (tab bar, floating buttons, toasts)
private struct GlassEffectModifier: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            content.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
        } else {
            content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        }
        #else
        content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        #endif
    }
}

extension View {
    /// Flat card background for content (white in light, dark gray in dark mode)
    func pulpeCardBackground(cornerRadius: CGFloat = DesignTokens.CornerRadius.lg) -> some View {
        modifier(CardBackgroundModifier(cornerRadius: cornerRadius))
    }

    /// Glass effect for floating navigation elements (toasts, overlays)
    func pulpeFloatingGlass(cornerRadius: CGFloat = DesignTokens.CornerRadius.md) -> some View {
        modifier(GlassEffectModifier(cornerRadius: cornerRadius))
    }
}

// MARK: - Shimmer Effect

extension View {
    /// Apply subtle opacity pulse animation for skeleton loading states.
    /// Mimics the standard iOS skeleton pattern (gentle fade in/out).
    @ViewBuilder
    func shimmering(active: Bool = true) -> some View {
        if active {
            self.modifier(ShimmerModifier())
        } else {
            self
        }
    }
}

private struct ShimmerModifier: ViewModifier {
    @State private var isAnimating = false
    @Environment(\.accessibilityReduceMotion) private var reduceMotion

    func body(content: Content) -> some View {
        content
            .animation(
                reduceMotion ? nil : .easeInOut(duration: 1.0).repeatForever(autoreverses: true)
            ) {
                $0.opacity(isAnimating ? 0.4 : 1.0)
            }
            .onAppear {
                guard !reduceMotion else { return }
                isAnimating = true
            }
            .onChange(of: reduceMotion) { _, reduced in
                if reduced { isAnimating = false }
            }
    }
}
