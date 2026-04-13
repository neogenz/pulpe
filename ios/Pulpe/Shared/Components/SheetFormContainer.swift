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

    @State private var isKeyboardVisible = false

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
            .safeAreaInset(edge: .bottom, spacing: 0) {
                keyboardToolbar
            }
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
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillShowNotification)) { _ in
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    isKeyboardVisible = true
                }
            }
            .onReceive(NotificationCenter.default.publisher(for: UIResponder.keyboardWillHideNotification)) { _ in
                withAnimation(DesignTokens.Animation.defaultSpring) {
                    isKeyboardVisible = false
                }
            }
            .task {
                guard autoFocus != nil else { return }
                try? await Task.sleep(for: .milliseconds(200))
                guard !Task.isCancelled else { return }
                autoFocus?.wrappedValue = true
            }
        }
        .standardSheetPresentation()
    }

    // MARK: - Keyboard Toolbar

    @ViewBuilder
    private var keyboardToolbar: some View {
        if isKeyboardVisible, autoFocus != nil {
            let amountFocused = autoFocus?.wrappedValue == true
            let descriptionFocused = descriptionFocus?.wrappedValue == true

            if amountFocused || descriptionFocused {
                HStack {
                    if descriptionFocus != nil {
                        if descriptionFocused {
                            Button(action: goToPreviousField) {
                                Image(systemName: "chevron.up")
                            }
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                        } else if amountFocused {
                            Button(action: goToNextField) {
                                Image(systemName: "chevron.down")
                            }
                            .frame(minWidth: 44, minHeight: 44)
                            .contentShape(Rectangle())
                        }
                    }

                    Spacer()

                    Button(action: dismissKeyboard) {
                        Image(systemName: "checkmark")
                            .fontWeight(.semibold)
                    }
                    .frame(minWidth: 44, minHeight: 44)
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .foregroundStyle(.primary)
                .padding(.horizontal, DesignTokens.Spacing.sm)
                .glassCapsuleBackground()
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .padding(.bottom, DesignTokens.Spacing.sm)
                .transition(.opacity.combined(with: .move(edge: .bottom)))
            }
        }
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
