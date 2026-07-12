import SwiftUI

/// Value-framed pre-permission sheet, shown once after the user's first real
/// "pointer". It sells the single concrete benefit before triggering the OS prompt —
/// iOS grants exactly one system prompt, so we never fire it cold: a user who taps
/// "Plus tard" simply never sees the OS dialog, keeping that one shot intact.
struct NotificationPrimeSheet: View {
    /// Called when the user taps "Activer" — the caller triggers the real OS prompt
    /// and schedules the reminder. The sheet dismisses itself either way.
    let onEnable: () -> Void

    @Environment(\.dismiss) private var dismiss

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Spacer(minLength: 0)

            Image(systemName: "bell.badge")
                .font(.largeTitle)
                .foregroundStyle(Color.pulpePrimary)

            Text("On te fait signe le jour de paie ?")
                .font(PulpeTypography.stepTitle)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)

            Text(
                "Un rappel par mois pour pointer tes dépenses et voir ton disponible. "
                    + "C'est tout — jamais de spam, et tu coupes quand tu veux."
            )
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(Color.textSecondary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            VStack(spacing: DesignTokens.Spacing.md) {
                Button("Activer les rappels") {
                    onEnable()
                    dismiss()
                }
                .primaryButtonStyle()

                Button("Plus tard") { dismiss() }
                    .textLinkButtonStyle()
            }
        }
        .padding(DesignTokens.Spacing.xxl)
        .presentationDetents([.medium, .large])
        .presentationBackground(Color.sheetBackground)
    }
}

#Preview {
    Color.clear
        .sheet(isPresented: .constant(true)) {
            NotificationPrimeSheet(onEnable: {})
        }
}
