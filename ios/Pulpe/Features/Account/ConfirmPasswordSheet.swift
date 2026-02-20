import SwiftUI

struct ConfirmPasswordSheet: View {
    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?

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
                        .background(Color.surfaceCard)
                        .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md))
                        .overlay(
                            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                                .stroke(errorMessage != nil ? Color.errorPrimary : Color.primary.opacity(0.1), lineWidth: 1)
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
                    verifyPassword()
                } label: {
                    HStack {
                        if isVerifying {
                            ProgressView()
                                .tint(.white)
                                .padding(.trailing, 8)
                        }
                        Text("Confirmer")
                            .font(PulpeTypography.buttonPrimary)
                    }
                    .frame(maxWidth: .infinity)
                    .padding()
                    .background(Color.onboardingGradient)
                    .foregroundStyle(.white)
                    .clipShape(RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.button))
                }
                .disabled(password.isEmpty || isVerifying)
                .padding()
            }
            .navigationTitle("Vérification")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Annuler") { dismiss() }
                }
            }
            .background(Color.surfacePrimary)
        }
    }

    private func verifyPassword() {
        isVerifying = true
        errorMessage = nil

        Task {
            let error = await onVerify(password)
            if let error {
                isVerifying = false
                errorMessage = error
                return
            }

            isVerifying = false
            dismiss()
        }
    }
}

#Preview {
    ConfirmPasswordSheet(onVerify: { _ in nil })
}
