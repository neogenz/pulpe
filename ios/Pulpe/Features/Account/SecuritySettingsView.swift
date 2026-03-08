import SwiftUI

struct SecuritySettingsView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.dismiss) private var dismiss
    @State private var biometricToggle = false
    @State private var showDisableBiometricConfirmation = false
    @State private var showChangePin = false
    @State private var showChangePassword = false
    @State private var showDeleteConfirmation = false
    @State private var securityViewModel = AccountSecurityViewModel()

    private let canUseBiometrics = BiometricService.shared.canUseBiometrics()
    private let biometricDisplayName = BiometricService.shared.biometryDisplayName

    var body: some View {
        List {
            Section {
                navigationRow("Code PIN", detail: "Modifier") {
                    showChangePin = true
                }

                actionRow("Mot de passe", detail: "••••••••") {
                    showChangePassword = true
                }

                actionRow("Clé de secours", detail: "Régénérer") {
                    securityViewModel.showConfirmPassword = true
                }
                .disabled(securityViewModel.isRegenerating)
            }

            if canUseBiometrics {
                Section {
                    Toggle(biometricDisplayName, isOn: $biometricToggle)
                        .onChange(of: biometricToggle) { _, newValue in
                            guard newValue != appState.biometricEnabled else { return }
                            if newValue {
                                Task {
                                    let success = await appState.enableBiometric()
                                    if success {
                                        appState.toastManager.show("\(biometricDisplayName) activé", type: .success)
                                    } else {
                                        appState.toastManager.show(
                                            "Impossible d'activer \(biometricDisplayName)",
                                            type: .error
                                        )
                                    }
                                    biometricToggle = appState.biometricEnabled
                                }
                            } else {
                                biometricToggle = true
                                showDisableBiometricConfirmation = true
                            }
                        }
                } header: {
                    Text("BIOMÉTRIE")
                }
            }
            Section {
                HStack(spacing: DesignTokens.Spacing.md) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                        Text("Supprimer mon compte")
                            .font(PulpeTypography.labelLarge)
                            .foregroundStyle(Color.destructivePrimary)
                        Text("Tes données seront supprimées définitivement après 3 jours.")
                            .font(PulpeTypography.labelMedium)
                            .foregroundStyle(.secondary)
                    }

                    Spacer(minLength: 0)

                    Button("Supprimer") {
                        showDeleteConfirmation = true
                    }
                    .buttonStyle(.borderedProminent)
                    .buttonBorderShape(.capsule)
                    .tint(.destructivePrimary)
                    .accessibilityLabel("Supprimer le compte")
                    .accessibilityHint("Demande la suppression définitive de ton compte Pulpe")
                }
            } header: {
                Text("ZONE DE DANGER")
                    .foregroundStyle(Color.destructivePrimary)
            }
            .listRowBackground(Color.destructiveBackground)
        }
        .onAppear {
            biometricToggle = appState.biometricEnabled
        }
        .alert(
            "Désactiver \(biometricDisplayName) ?",
            isPresented: $showDisableBiometricConfirmation
        ) {
            Button("Annuler", role: .cancel) { }
            Button("Désactiver", role: .destructive) {
                Task {
                    await appState.disableBiometric()
                    biometricToggle = false
                    appState.toastManager.show(
                        "\(biometricDisplayName) désactivé",
                        type: .success
                    )
                }
            }
        } message: {
            Text("Tu devras utiliser ton code PIN pour te connecter.")
        }
        .navigationDestination(isPresented: $showChangePin) {
            ChangePinView {
                showChangePin = false
                appState.toastManager.show("Code PIN modifié", type: .success)
            }
        }
        .sheet(isPresented: $showChangePassword) {
            ChangePasswordSheet {
                appState.toastManager.show("Mot de passe modifié", type: .success)
            }
        }
        .sheet(isPresented: $securityViewModel.showConfirmPassword) {
            ConfirmPasswordSheet { password in
                let error = await securityViewModel.verifyAndRegenerateRecoveryKey(
                    password: password,
                    email: appState.currentUser?.email
                )
                if error == nil {
                    appState.toastManager.show("Clé de secours régénérée", type: .success)
                }
                return error
            }
        }
        .sheet(isPresented: $securityViewModel.showRecoveryKeySheet) {
            if let recoveryKey = securityViewModel.generatedRecoveryKey {
                RecoveryKeySheet(recoveryKey: recoveryKey) {
                    securityViewModel.showRecoveryKeySheet = false
                }
            }
        }
        .overlay {
            if securityViewModel.isRegenerating {
                Color.black.opacity(0.4)
                    .ignoresSafeArea()
                VStack(spacing: DesignTokens.Spacing.md) {
                    ProgressView()
                        .tint(.white)
                    Text("Génération de la nouvelle clé...")
                        .foregroundStyle(.white)
                        .font(PulpeTypography.labelLarge)
                }
            }
        }
        .alert("Supprimer mon compte", isPresented: $showDeleteConfirmation) {
            Button("Annuler", role: .cancel) { }
            Button("Supprimer", role: .destructive) {
                Task {
                    await appState.deleteAccount()
                    dismiss()
                }
            }
        } message: {
            Text(
                "Ton compte sera définitivement supprimé " +
                "après un délai de 3 jours. Cette action est irréversible."
            )
        }
        .listStyle(.insetGrouped)
        .navigationTitle("Sécurité")
        .trackScreen("Security")
    }

    private func actionRow(
        _ title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Text(detail)
                    .foregroundStyle(.secondary)
            }
        }
        .buttonStyle(.plain)
    }

    private func navigationRow(
        _ title: String,
        detail: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
            HStack {
                Text(title)
                    .foregroundStyle(.primary)
                Spacer()
                Text(detail)
                    .foregroundStyle(.secondary)
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .buttonStyle(.plain)
    }
}

// MARK: - ViewModel

@Observable @MainActor
final class AccountSecurityViewModel {
    var showConfirmPassword = false
    var showRecoveryKeySheet = false
    var isRegenerating = false
    var generatedRecoveryKey: String?

    private let dependencies: AccountSecurityDependencies

    init(dependencies: AccountSecurityDependencies? = nil) {
        self.dependencies = dependencies ?? .live
    }

    func verifyAndRegenerateRecoveryKey(
        password: String,
        email: String?
    ) async -> String? {
        guard let email, !email.isEmpty else {
            return "Utilisateur non connecté"
        }

        isRegenerating = true
        defer { isRegenerating = false }

        do {
            try await dependencies.verifyPassword(email, password)
            let key = try await dependencies.setupRecoveryKey()
            generatedRecoveryKey = key
            showRecoveryKeySheet = true
            return nil
        } catch {
            if AuthErrorLocalizer.isInvalidCredentials(error) {
                return "Mot de passe incorrect"
            }
            if error is APIError {
                return "Erreur lors de la génération"
            }
            return AuthErrorLocalizer.localize(error)
        }
    }
}

struct AccountSecurityDependencies: Sendable {
    var verifyPassword: @Sendable (String, String) async throws -> Void
    var setupRecoveryKey: @Sendable () async throws -> String

    static var live: AccountSecurityDependencies {
        AccountSecurityDependencies(
        verifyPassword: { email, password in
            try await AuthService.shared.verifyPassword(email: email, password: password)
        },
        setupRecoveryKey: {
            try await EncryptionAPI.shared.regenerateRecoveryKey()
        }
        )
    }
}

#Preview {
    NavigationStack {
        SecuritySettingsView()
            .environment(AppState())
    }
}
