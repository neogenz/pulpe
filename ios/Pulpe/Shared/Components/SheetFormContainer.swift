import SwiftUI

/// Reusable container that wraps sheet form content with the standard
/// NavigationStack + ScrollView boilerplate shared across all form sheets.
///
/// Provides: surface background, inline title, close button, loading overlay,
/// keyboard dismiss, and optional auto-focus after a short delay.
struct SheetFormContainer<Content: View>: View {
    let title: String
    let isLoading: Bool
    var autoFocus: FocusState<Bool>.Binding?
    @ViewBuilder let content: Content

    @State private var keyboardHeight: CGFloat = 0

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    content
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.xl)
            }
            .safeAreaInset(edge: .bottom, spacing: 0) {
                Color.clear.frame(height: keyboardHeight)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.sheetBackground)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
                if let autoFocus {
                    ToolbarItemGroup(placement: .keyboard) {
                        Spacer()
                        Button("OK") {
                            autoFocus.wrappedValue = false
                            UIApplication.shared.sendAction(
                                #selector(UIResponder.resignFirstResponder),
                                to: nil, from: nil, for: nil
                            )
                        }
                    }
                }
            }
            .loadingOverlay(isLoading)
            .dismissKeyboardOnTap()
            .task {
                guard autoFocus != nil else { return }
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                autoFocus?.wrappedValue = true
            }
        }
        .ignoresSafeArea(.keyboard)
        .standardSheetPresentation()
        .onReceive(
            NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)
        ) { notification in
            if let frame = notification.userInfo?[UIResponder.keyboardFrameEndUserInfoKey] as? CGRect {
                keyboardHeight = frame.height
            }
        }
        .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
            keyboardHeight = 0
        }
    }
}
