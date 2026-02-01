import SwiftUI

// MARK: - Amount Visibility Environment

private struct AmountsHiddenKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    var amountsHidden: Bool {
        get { self[AmountsHiddenKey.self] }
        set { self[AmountsHiddenKey.self] = newValue }
    }
}

// MARK: - Sensitive Amount Modifier

private struct SensitiveAmountModifier: ViewModifier {
    @Environment(\.amountsHidden) private var amountsHidden

    func body(content: Content) -> some View {
        content
            .blur(radius: amountsHidden ? 8 : 0)
            .accessibilityLabel(amountsHidden ? "Montant masqué" : "")
            .accessibilityHidden(amountsHidden)
            .animation(.easeInOut(duration: 0.2), value: amountsHidden)
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
            self?.claimFirstResponderIfNeeded()
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

    /// Hide view conditionally
    @ViewBuilder
    func hidden(_ isHidden: Bool) -> some View {
        if isHidden {
            self.hidden()
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

    /// Apply toast overlay
    func toastOverlay(_ manager: ToastManager) -> some View {
        overlay(alignment: .top) {
            if let toast = manager.currentToast {
                ToastView(toast: toast) {
                    manager.dismiss()
                }
                .safeAreaPadding(.top)
                .padding(.top, 8)
                .transition(.move(edge: .top).combined(with: .opacity))
            }
        }
        .animation(DesignTokens.Animation.defaultSpring, value: manager.currentToast)
    }

    /// Glass card styling with padding and Liquid Glass effect (iOS 26+) or material fallback
    func pulpeCard() -> some View {
        self
            .padding(DesignTokens.Spacing.lg)
            .pulpeCardBackground()
    }

    /// DA-compliant section header styling
    func pulpeSectionHeader() -> some View {
        self
            .font(.headline)
            .foregroundStyle(Color.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Unified app background: neutral system background to let glass cards and hero card stand out
    func pulpeBackground() -> some View {
        modifier(PulpeBackgroundModifier())
    }

    /// Status-tinted background for budget details: green (positive) or amber (negative)
    func pulpeStatusBackground(isDeficit: Bool) -> some View {
        modifier(PulpeStatusBackgroundModifier(isDeficit: isDeficit))
    }
}

// MARK: - Background Modifiers

private struct PulpeBackgroundModifier: ViewModifier {
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.background {
            backgroundView.ignoresSafeArea()
        }
    }

    @ViewBuilder
    private var backgroundView: some View {
        if colorScheme == .dark {
            // Dark mode: use system background so elevated cards (#1C1C1E) stand out naturally
            Color(uiColor: .systemGroupedBackground)
        } else if #available(iOS 18.0, *) {
            MeshGradient(
                width: 3, height: 3,
                points: Color.meshPoints,
                colors: Color.lightMeshColors
            )
        } else {
            Color.appFallbackBackground
        }
    }
}

private struct PulpeStatusBackgroundModifier: ViewModifier {
    let isDeficit: Bool
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        content.background {
            statusBackground.ignoresSafeArea()
        }
    }

    @ViewBuilder
    private var statusBackground: some View {
        if colorScheme == .dark {
            // Dark mode: system background for consistent card contrast
            Color(uiColor: .systemGroupedBackground)
        } else if isDeficit {
            Color.appNegativeBackground
        } else {
            Color.appPositiveBackground
        }
    }
}

// MARK: - Alert Extensions

extension View {
    /// Show error alert
    func errorAlert(_ error: Binding<Error?>) -> some View {
        alert(
            "Erreur",
            isPresented: .init(
                get: { error.wrappedValue != nil },
                set: { if !$0 { error.wrappedValue = nil } }
            ),
            actions: {
                Button("OK", role: .cancel) {}
            },
            message: {
                if let err = error.wrappedValue {
                    Text(err.localizedDescription)
                }
            }
        )
    }
}

// MARK: - Keyboard Extensions

extension View {
    /// Dismiss keyboard on tap
    func dismissKeyboardOnTap() -> some View {
        onTapGesture {
            UIApplication.shared.sendAction(
                #selector(UIResponder.resignFirstResponder),
                to: nil,
                from: nil,
                for: nil
            )
        }
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

/// Card surface with subtle border for definition (no shadows — Liquid Glass era)
private struct CardBackgroundModifier: ViewModifier {
    let cornerRadius: CGFloat

    func body(content: Content) -> some View {
        content
            .background(
                RoundedRectangle(cornerRadius: cornerRadius)
                    .fill(Color.surfaceCard)
                    .overlay(
                        RoundedRectangle(cornerRadius: cornerRadius)
                            .strokeBorder(Color.primary.opacity(0.08), lineWidth: 0.5)
                    )
            )
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
