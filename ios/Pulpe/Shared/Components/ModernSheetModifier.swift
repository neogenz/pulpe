import SwiftUI

/// Modern sheet presentation style with drag handle
/// Replaces the traditional navigation bar with a cleaner design
struct ModernSheetModifier: ViewModifier {
    let title: String
    let showDismissButton: Bool
    @Environment(\.dismiss) private var dismiss
    
    init(title: String, showDismissButton: Bool = true) {
        self.title = title
        self.showDismissButton = showDismissButton
    }
    
    func body(content: Content) -> some View {
        VStack(spacing: 0) {
            // MARK: - Header with drag handle
            VStack(spacing: DesignTokens.Spacing.md) {
                // Drag handle
                RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.xs)
                    .fill(Color.textTertiary.opacity(DesignTokens.Opacity.secondary))
                    .frame(width: 36, height: 4)
                    .padding(.top, DesignTokens.Spacing.md)
                
                // Title and dismiss button
                HStack {
                    Text(title)
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textPrimary)
                    
                    Spacer()
                    
                    if showDismissButton {
                        Button {
                            dismiss()
                        } label: {
                            Image(systemName: "xmark.circle.fill")
                                .font(.system(size: 24))
                                .foregroundStyle(Color.textTertiary)
                                .symbolRenderingMode(.hierarchical)
                        }
                        .buttonStyle(.plain)
                        .accessibilityLabel("Fermer")
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.bottom, DesignTokens.Spacing.sm)
            }
            .background(Color.surfacePrimary)
            
            Divider()
                .opacity(0.1)
            
            // MARK: - Content
            content
        }
        .presentationDetents([.large])
        .presentationDragIndicator(.hidden) // We use our custom handle
        .presentationCornerRadius(DesignTokens.CornerRadius.xl)
        .presentationBackground(Color.surfacePrimary)
    }
}

extension View {
    /// Apply modern sheet presentation style with drag handle
    /// - Parameters:
    ///   - title: Sheet title
    ///   - showDismissButton: Whether to show the dismiss (×) button
    func modernSheet(title: String, showDismissButton: Bool = true) -> some View {
        modifier(ModernSheetModifier(title: title, showDismissButton: showDismissButton))
    }
}

// MARK: - Preview

#Preview("Modern Sheet Style") {
    Text("Aperçu du design de sheet")
        .sheet(isPresented: .constant(true)) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xl) {
                    Text("Voici le contenu de la sheet avec le nouveau design moderne.")
                        .font(PulpeTypography.bodyLarge)
                        .padding()
                    
                    Button("Action principale") {}
                        .font(PulpeTypography.buttonPrimary)
                        .foregroundStyle(Color.textOnPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.FrameHeight.button)
                        .background(Color.pulpePrimary)
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                }
                .padding(.top, DesignTokens.Spacing.lg)
            }
            .modernSheet(title: "Exemple de sheet moderne")
        }
}
