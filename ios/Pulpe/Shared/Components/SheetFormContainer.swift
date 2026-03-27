import SwiftUI

/// Reusable container that wraps sheet form content with the standard
/// NavigationStack + ScrollView boilerplate shared across all form sheets.
///
/// Provides: surface background, inline title, close button, loading overlay,
/// keyboard dismiss, optional auto-focus, and keyboard toolbar with field navigation.
///
/// - `autoFocus`: When provided, auto-focuses this field on appear and shows a
///   keyboard toolbar with a checkmark (done) button.
/// - `descriptionFocus`: When also provided, the toolbar adds prev/next arrows
///   to navigate between amount and description fields.
struct SheetFormContainer<Content: View>: View {
    let title: String
    let isLoading: Bool
    var autoFocus: FocusState<Bool>.Binding?
    var descriptionFocus: FocusState<Bool>.Binding?
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
                if autoFocus != nil {
                    ToolbarItemGroup(placement: .keyboard) {
                        let amountFocused = autoFocus?.wrappedValue == true
                        let descriptionFocused = descriptionFocus?.wrappedValue == true

                        if amountFocused || descriptionFocused {
                            if descriptionFocus != nil {
                                if descriptionFocused {
                                    Button(action: goToPreviousField) {
                                        Image(systemName: "chevron.up")
                                    }
                                } else if amountFocused {
                                    Button(action: goToNextField) {
                                        Image(systemName: "chevron.down")
                                    }
                                }
                            }

                            Spacer()

                            Button(action: dismissKeyboard) {
                                Image(systemName: "checkmark")
                                    .fontWeight(.semibold)
                            }
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
        .standardSheetPresentation()
    }

    // MARK: - Field Navigation

    private func goToNextField() {
        guard let autoFocus, autoFocus.wrappedValue else { return }
        autoFocus.wrappedValue = false
        descriptionFocus?.wrappedValue = true
    }

    private func goToPreviousField() {
        guard let descriptionFocus, descriptionFocus.wrappedValue else { return }
        descriptionFocus.wrappedValue = false
        autoFocus?.wrappedValue = true
    }

    private func dismissKeyboard() {
        autoFocus?.wrappedValue = false
        descriptionFocus?.wrappedValue = false
    }
}
