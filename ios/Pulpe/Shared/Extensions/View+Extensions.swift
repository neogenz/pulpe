import SwiftUI

extension View {
    /// Conditionally apply a modifier.
    /// Use when a modifier should only be applied based on a compile-time or init-time condition.
    @ViewBuilder
    func `if`<TrueContent: View>(
        _ condition: Bool,
        @ViewBuilder transform: (Self) -> TrueContent
    ) -> some View {
        if condition {
            transform(self)
        } else {
            self
        }
    }

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

    /// Unified app background with premium multi-layered gradient for Liquid Glass
    func pulpeBackground() -> some View {
        self.background { Color.appPremiumBackground.ignoresSafeArea() }
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

// MARK: - Glass Effect Modifiers (iOS 26+)

private struct GlassEffectModifier: ViewModifier {
    let cornerRadius: CGFloat
    @Environment(\.colorScheme) private var colorScheme

    func body(content: Content) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            if colorScheme == .dark {
                content.glassEffect(
                    .regular.tint(Color.black.opacity(0.3)),
                    in: .rect(cornerRadius: cornerRadius)
                )
            } else {
                content.glassEffect(.regular.tint(Color.white.opacity(0.3)), in: .rect(cornerRadius: cornerRadius))
            }
        } else {
            content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        }
        #else
        content.background(.ultraThinMaterial, in: .rect(cornerRadius: cornerRadius))
        #endif
    }
}

extension View {
    /// Glass card background without padding (for cards with custom internal padding)
    func pulpeCardBackground(cornerRadius: CGFloat = DesignTokens.CornerRadius.lg) -> some View {
        modifier(GlassEffectModifier(cornerRadius: cornerRadius))
    }

    /// Glass effect for hero/showcase cards (xl corner radius)
    func pulpeHeroGlass() -> some View {
        modifier(GlassEffectModifier(cornerRadius: DesignTokens.CornerRadius.xl))
    }

    /// Glass effect for floating elements (toasts, overlays)
    func pulpeFloatingGlass(cornerRadius: CGFloat = DesignTokens.CornerRadius.md) -> some View {
        modifier(GlassEffectModifier(cornerRadius: cornerRadius))
    }

    /// Legacy hero card styling (opaque fallback, kept for compatibility)
    func pulpeHeroCard() -> some View {
        self
            .background(Color.surfaceCard)
            .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.xl))
    }
}
