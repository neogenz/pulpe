import SwiftUI

struct VerifyRecoveryKeySheet: View {
    @State private var recoveryKey = ""
    @State private var isVerifying = false
    @State private var resultMessage: String?
    @State private var isSuccess = false
    @FocusState private var isKeyFieldFocused: Bool

    var body: some View {
        SheetFormContainer(
            title: "Vérifier ma clé",
            isLoading: isVerifying,
            autoFocus: $isKeyFieldFocused
        ) {
            Text(
                "Saisis ta clé telle que tu l'as notée (tirets optionnels). " +
                    "Elle sert uniquement à cette vérification et n'est pas enregistrée."
            )
            .font(PulpeTypography.bodyMedium)
            .foregroundStyle(Color.textSecondaryOnboarding)
            .multilineTextAlignment(.center)

            FormTextField(
                hint: "XXXX-XXXX-…",
                text: $recoveryKey,
                label: "Clé de récupération",
                accessibilityLabel: "Clé de récupération",
                focusBinding: $isKeyFieldFocused
            )
            .onChange(of: recoveryKey) { _, newValue in
                let stripped = RecoveryKeyFormatter.strip(newValue)
                let formatted = RecoveryKeyFormatter.format(stripped)
                if formatted != newValue {
                    recoveryKey = formatted
                }
            }

            if let resultMessage {
                Text(resultMessage)
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(isSuccess ? Color.primary : Color.errorPrimary)
                    .frame(maxWidth: .infinity, alignment: .leading)
            }

            Button {
                Task { await verify() }
            } label: {
                if isVerifying {
                    ProgressView()
                        .tint(.white)
                        .accessibilityLabel("Vérification en cours")
                } else {
                    Text("Vérifier")
                }
            }
            .primaryButtonStyle(
                isEnabled: canSubmit
            )
            .disabled(!canSubmit)
        }
    }

    private var canSubmit: Bool {
        let trimmed = recoveryKey.trimmingCharacters(in: .whitespacesAndNewlines)
        return !trimmed.isEmpty && !isVerifying &&
            !RecoveryKeyFormatter.containsInvalidCharacters(recoveryKey)
    }

    private func verify() async {
        isVerifying = true
        resultMessage = nil
        let trimmed = recoveryKey.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty else {
            isVerifying = false
            return
        }

        do {
            try await EncryptionAPI.shared.verifyRecoveryKey(trimmed)
            isSuccess = true
            resultMessage = "Cette clé est valide pour ton compte."
        } catch let error as APIError {
            isSuccess = false
            resultMessage = error.localizedDescription
        } catch {
            isSuccess = false
            resultMessage = error.localizedDescription
        }

        isVerifying = false
    }
}

#Preview {
    VerifyRecoveryKeySheet()
}
