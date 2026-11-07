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
            ScrollViewReader { proxy in
                ScrollView {
                    VStack(spacing: DesignTokens.Spacing.xxl) {
                        content
                    }
                    .padding(.horizontal, DesignTokens.Spacing.xl)
                    .padding(.top, DesignTokens.Spacing.lg)
                    .padding(.bottom, DesignTokens.Spacing.xl)
                }
                // A field tagged `.id(field)` is brought back into view when the bottom inset grows:
                // the keyboard toolbar lands after the focus, and on a short screen a pinned bottom
                // button then covers the field being typed into.
                .onScrollGeometryChange(for: CGFloat.self) { $0.contentInsets.bottom } action: { old, new in
                    guard new > old, let field = focus.wrappedValue else { return }
                    // An explicit anchor: without one, a field under the button still counts as visible.
                    withAnimation(DesignTokens.Animation.smoothEaseInOut) { proxy.scrollTo(field, anchor: .center) }
                }
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
            // Focused as the sheet appears, so the keyboard rises with it in one movement. A
            // delayed focus raised it mid-slide and swept the bottom button across the form.
            .onAppear {
                if let first = focusOrder.first { focus.wrappedValue = first }
            }
        }
        .standardSheetPresentation()
    }
}
