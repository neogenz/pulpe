import SwiftUI

/// Shared focus state for the standard amount + description form layout.
/// Most add/edit sheets reuse this instead of declaring a private enum per file.
enum AmountDescriptionField: Hashable {
    case amount
    case description
}

/// Reusable container that wraps sheet form content with the standard
/// NavigationStack + ScrollView boilerplate shared across all form sheets.
///
/// Provides: surface background, inline title, close button, loading overlay,
/// keyboard dismiss, optional auto-focus, and keyboard toolbar with field navigation.
struct SheetFormContainer<Field: Hashable, Content: View>: View {
    let title: String
    let isLoading: Bool
    var focus: FocusState<Field?>.Binding
    var focusOrder: [Field]
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
            .contentMargins(.bottom, DesignTokens.Spacing.xxl, for: .scrollContent)
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)
            .background(Color.sheetBackground)
            .navigationTitle(title)
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    SheetCloseButton()
                }
            }
            .loadingOverlay(isLoading)
            .dismissKeyboardOnTap()
            .keyboardFieldNavigation(focus: focus, order: focusOrder)
            .task {
                guard let first = focusOrder.first else { return }
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                focus.wrappedValue = first
            }
        }
        .standardSheetPresentation()
    }
}
