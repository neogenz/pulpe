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
    @FocusState private var isKeyFocused: Bool

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Vérifier ma clé"),
            isLoading: isVerifying,
            focus: $focusedField,
            focusOrder: []
        ) {
            Text("""
                Tape ta clé telle que tu l'as notée pour t'assurer qu'elle marche, \
                avant d'en avoir besoin.
                """)
            .font(PulpeTypography.subheadline)
            .foregroundStyle(Color.textSecondary)
            .frame(maxWidth: .infinity, alignment: .leading)

            keyField
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

    private var keyField: some View {
        let count = RecoveryKeyFormatter.strip(recoveryKey).count
        let total = RecoveryKeyFormatter.strippedKeyCharacterCount
        return VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Clé de récupération")
                    .font(PulpeTypography.labelLarge)
                    .foregroundStyle(Color.textSecondary)
                RecoveryKeyInputField(text: $recoveryKey, isFocused: $isKeyFocused, showsCounter: false)
                Text("Tirets facultatifs. Elle sert seulement à cette vérification : je ne l'enregistre pas.")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            }
            if count == total {
                InfoBanner(
                    .ok,
                    systemImage: "checkmark",
                    text: AppLocale.string("\(count) caractères sur \(total), tu peux vérifier.")
                )
            } else if count > 0 {
                InfoBanner(
                    .neutral,
                    systemImage: "ellipsis",
                    text: AppLocale.string("\(count) caractères sur \(total)")
                )
            }
        }
        .task {
            try? await Task.sleep(for: .milliseconds(200))
            guard !Task.isCancelled else { return }
            isKeyFocused = true
        }
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
