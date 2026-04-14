import SwiftUI

struct VerifyRecoveryKeySheet: View {
    private enum FormField: Hashable {
        case recoveryKey
    }

    @Environment(\.dismiss) private var dismiss
    let onSuccess: () -> Void
    @State private var recoveryKey = ""
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: FormField?

    var body: some View {
        SheetFormContainer(
            title: "Vérifier ma clé",
            isLoading: isVerifying,
            focus: $focusedField,
            focusOrder: [.recoveryKey]
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
                focusBinding: $focusedField,
                field: .recoveryKey
            )
            .onChange(of: recoveryKey) { _, newValue in
                let stripped = String(
                    RecoveryKeyFormatter.strip(newValue)
                        .prefix(RecoveryKeyFormatter.strippedKeyCharacterCount)
                )
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
            dismiss()
            onSuccess()
        } catch {
            errorMessage = error.localizedDescription
        }

        isVerifying = false
    }
}

#Preview {
    VerifyRecoveryKeySheet(onSuccess: {})
        .environment(AppState())
}
