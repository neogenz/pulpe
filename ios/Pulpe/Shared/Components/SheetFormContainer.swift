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
            .background(Color.surface)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
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
        .standardSheetPresentation()
    }
}
