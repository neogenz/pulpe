import SwiftUI

struct VerifyRecoveryKeySheet: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var recoveryKey = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @State private var submitSuccessTrigger = false
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
            .font(PulpeTypography.bodyLarge)
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

            if let errorMessage {
                ErrorBanner(message: errorMessage)
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
            .primaryButtonStyle(isEnabled: canSubmit)
            .disabled(!canSubmit)
        }
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
    }

    private var canSubmit: Bool {
        let stripped = RecoveryKeyFormatter.strip(recoveryKey)
        return stripped.count == RecoveryKeyFormatter.strippedKeyCharacterCount && !isVerifying
    }

    private func verify() async {
        isVerifying = true
        errorMessage = nil
        let stripped = RecoveryKeyFormatter.strip(recoveryKey)
        guard stripped.count == RecoveryKeyFormatter.strippedKeyCharacterCount else {
            isVerifying = false
            return
        }

        do {
            try await EncryptionAPI.shared.verifyRecoveryKey(stripped)
            submitSuccessTrigger.toggle()
            appState.toastManager.show("Cette clé est valide pour ton compte.", type: .success)
            dismiss()
        } catch {
            errorMessage = error.localizedDescription
        }

        isVerifying = false
    }
}

#Preview {
    VerifyRecoveryKeySheet()
        .environment(AppState())
}
