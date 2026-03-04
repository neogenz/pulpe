import SwiftUI

struct ConfirmPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @State private var verifyTask: Task<Void, Never>?

    var onVerify: (String) async -> String?

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.xl) {
                Text("Pour ta sécurité, confirme ton mot de passe pour continuer.")
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal)

                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                    SecureField("Mot de passe", text: $password)
                        .textFieldStyle(.plain)
                        .padding()
                        .background(Color.surfaceContainerHigh)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                                .strokeBorder(
                                    errorMessage != nil ? Color.errorPrimary : Color.primary.opacity(0.1),
                                    lineWidth: 1
                                )
                        )

                    if let error = errorMessage {
                        Text(error)
                            .font(PulpeTypography.caption)
                            .foregroundStyle(Color.errorPrimary)
                            .padding(.leading, DesignTokens.Spacing.xs)
                    }
                }
                .padding(.horizontal)

                Spacer()

                Button {
                    verifyTask = Task { await verifyPassword() }
                } label: {
                    if isVerifying {
                        ProgressView()
                            .tint(.white)
                    } else {
                        Text("Confirmer")
                    }
                }
                .primaryButtonStyle(isEnabled: !password.isEmpty && !isVerifying)
                .disabled(password.isEmpty || isVerifying)
                .padding(.horizontal)
            }
            .navigationTitle("Vérification")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .background(Color.surface)
            .interactiveDismissDisabled(isVerifying)
            .onDisappear { verifyTask?.cancel() }
        }
    }

    private func verifyPassword() async {
        isVerifying = true
        errorMessage = nil

        let error = await onVerify(password)
        guard !Task.isCancelled else { return }

        if let error {
            isVerifying = false
            errorMessage = error
            return
        }

        isVerifying = false
        dismiss()
    }
}

#Preview {
    ConfirmPasswordSheet(onVerify: { _ in nil })
}
