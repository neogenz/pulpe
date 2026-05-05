import SwiftUI

struct ConfirmPasswordSheet: View {
    private enum FormField: Hashable {
        case password
    }

    @Environment(\.dismiss) private var dismiss

    @State private var password = ""
    @State private var showPassword = false
    @State private var isVerifying = false
    @State private var errorMessage: String?
    @State private var verifyTask: Task<Void, Never>?
    @State private var submitSuccessTrigger = false
    @FocusState private var focusedField: FormField?

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
                    AuthSecureField(
                        prompt: "Mot de passe",
                        text: $password,
                        isVisible: $showPassword,
                        systemImage: "lock",
                        hasError: errorMessage != nil,
                        focusBinding: $focusedField,
                        focusField: .password
                    )
                    .accessibilityIdentifier("confirmPasswordInput")
                    .accessibilityLabel("Mot de passe")
                    .accessibilityHint("Saisis ton mot de passe pour confirmer")
                    .textContentType(.password)

                    if let error = errorMessage {
                        Text(error)
                            .font(PulpeTypography.labelMedium)
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
                            .accessibilityLabel("Vérification en cours")
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
                    SheetCloseButton()
                }
            }
            .background(Color.sheetBackground)
            .keyboardFieldNavigation(focus: $focusedField, order: [.password])
            .dismissKeyboardOnTap()
            .interactiveDismissDisabled(isVerifying)
            .onDisappear { verifyTask?.cancel() }
        }
        .standardSheetPresentation()
        .sensoryFeedback(.success, trigger: submitSuccessTrigger)
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
        submitSuccessTrigger.toggle()
        dismiss()
    }
}

#Preview {
    ConfirmPasswordSheet(onVerify: { _ in nil })
}
