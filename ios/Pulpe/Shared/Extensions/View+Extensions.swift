import SwiftUI

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
            meshOrFallbackBackground.ignoresSafeArea()
        }
    }

    @ViewBuilder
    private var meshOrFallbackBackground: some View {
        if #available(iOS 18.0, *) {
            MeshGradient(
                width: 3, height: 3,
                points: Color.meshPoints,
                colors: colorScheme == .dark ? Color.darkMeshColors : Color.lightMeshColors
            )
        } else {
            Color.appFallbackBackground
        }
    }
}

private struct PulpeStatusBackgroundModifier: ViewModifier {
    let isDeficit: Bool

    func body(content: Content) -> some View {
        content.background {
            if isDeficit {
                Color.appNegativeBackground.ignoresSafeArea()
            } else {
                Color.appPositiveBackground.ignoresSafeArea()
            }
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
