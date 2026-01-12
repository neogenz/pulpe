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
        .animation(.spring(duration: 0.3), value: manager.currentToast)
    }

    /// Standard card styling
    func cardStyle() -> some View {
        self
            .padding()
            .background(.background)
            .clipShape(RoundedRectangle(cornerRadius: 12))
            .shadow(color: .black.opacity(0.05), radius: 2, y: 1)
    }

    /// Section header styling
    func sectionHeader() -> some View {
        self
            .font(.headline)
            .foregroundStyle(.primary)
            .frame(maxWidth: .infinity, alignment: .leading)
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
