import SwiftUI

extension View {
    /// Conditionally apply a modifier
    @ViewBuilder
    func `if`<Content: View>(_ condition: Bool, transform: (Self) -> Content) -> some View {
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

    /// DA-compliant card styling: surfaceCard background, lg corner radius
    func pulpeCard() -> some View {
        self
            .padding(DesignTokens.Spacing.lg)
            .background(Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.lg))
    }

    /// DA-compliant section header styling
    func pulpeSectionHeader() -> some View {
        self
            .font(.headline)
            .foregroundStyle(Color.textPrimary)
            .frame(maxWidth: .infinity, alignment: .leading)
    }

    /// Unified app background with subtle brand gradient
    func pulpeBackground() -> some View {
        self.background(Color.appBackgroundGradient)
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

// MARK: - Scroll Edge Effect

extension View {
    @ViewBuilder
    func applyScrollEdgeEffect() -> some View {
        // scrollEdgeEffectStyle is a future iOS API - this is a no-op placeholder
        // When the API becomes available, update the availability check
        self
    }
}

// MARK: - Glass Effect Modifiers (iOS 26+)

extension View {
    /// Hero card styling: surfaceCard background, xl corner radius (for hero/showcase cards)
    func pulpeHeroCard() -> some View {
        self
            .background(Color.surfaceCard)
            .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xl))
    }

    /// Glass effect for hero/showcase cards with fallback
    @ViewBuilder
    func pulpeHeroGlass() -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular, in: .rect(cornerRadius: DesignTokens.CornerRadius.xl))
        } else {
            pulpeHeroCard()
        }
        #else
        pulpeHeroCard()
        #endif
    }

    /// Glass effect for floating elements (toasts, overlays)
    @ViewBuilder
    func pulpeFloatingGlass(cornerRadius: CGFloat = DesignTokens.CornerRadius.md) -> some View {
        #if compiler(>=6.2)
        if #available(iOS 26.0, *) {
            self.glassEffect(.regular, in: .rect(cornerRadius: cornerRadius))
        } else {
            self.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
        }
        #else
        self.background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: cornerRadius))
        #endif
    }
}
