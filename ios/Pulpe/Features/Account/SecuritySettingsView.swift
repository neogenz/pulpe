import SwiftUI

struct SecuritySettingsView: View {
    @Environment(AppState.self) private var appState
    @State private var biometricToggle = false
    @State private var showDisableBiometricConfirmation = false
    @State private var showChangePin = false
    @State private var showChangePassword = false
    @State private var showDeleteConfirmation = false
    @State private var showVerifyRecoveryKey = false
    @State private var securityViewModel = AccountSecurityViewModel()

    private let canUseBiometrics = BiometricService.shared.canUseBiometrics()
    private let biometricDisplayName = BiometricService.shared.biometryDisplayName

    var body: some View {
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: AppLocale.string("Sécurité"))
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    InfoBanner(
                        .neutral,
                        systemImage: "lock",
                        text: AppLocale.string(
                            """
                            Tes montants sont protégés par ton code PIN. \
                            Sans lui, personne ne peut les lire.
                            """
                        )
                    )
                    unlockGroup
                    connectionGroup
                    recoveryGroup
                    dangerGroup
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.xxl)
        }
        .background { Color.appBackground.ignoresSafeArea() }
        .navigationBarTitleDisplayMode(.inline)
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
                        AppLocale.string("\(biometricDisplayName) désactivé"),
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
                appState.toastManager.show(AppLocale.string("Code PIN modifié"), type: .success)
            }
        }
        .sheet(isPresented: $showChangePassword) {
            ChangePasswordSheet {
                appState.toastManager.show(AppLocale.string("Mot de passe modifié"), type: .success)
            }
        }
        .sheet(isPresented: $securityViewModel.showConfirmPassword) {
            ConfirmPasswordSheet { password in
                let error = await securityViewModel.verifyAndRegenerateRecoveryKey(
                    password: password,
                    email: appState.currentUser?.email
                )
                if error == nil {
                    appState.toastManager.show(AppLocale.string("Clé de récupération régénérée"), type: .success)
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
        .sheet(isPresented: $showVerifyRecoveryKey) {
            VerifyRecoveryKeySheet {
                appState.toastManager.show(
                    AppLocale.string("Cette clé est valide pour ton compte."),
                    type: .success
                )
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
        .sensoryFeedback(.warning, trigger: showDeleteConfirmation, condition: { _, newValue in newValue })
        .alert("Supprimer ton compte ?", isPresented: $showDeleteConfirmation) {
            Button("Annuler", role: .cancel) { }
            Button("Supprimer mon compte", role: .destructive) {
                Task { await appState.deleteAccount() }
            }
        } message: {
            Text("""
                Tes budgets, objectifs, modèles et connexions seront effacés après 3 jours. \
                Cette action est irréversible.
                """)
        }
        .trackScreen("Security")
    }

    private var unlockGroup: some View {
        SettingsGroup(header: AppLocale.string("Déverrouillage")) {
            Button { showChangePin = true } label: {
                SettingsRow(
                    systemImage: "number",
                    title: AppLocale.string("Code PIN"),
                    subtitle: AppLocale.string("Le changer crée aussi une nouvelle clé")
                )
            }
            .buttonStyle(.plain)
            if canUseBiometrics {
                FormRowDivider()
                Toggle(isOn: $biometricToggle) {
                    VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                        Text(biometricDisplayName)
                            .font(PulpeTypography.rowTitleRegular)
                        Text("Ouvre Pulpe sans taper ton code")
                            .font(PulpeTypography.bannerText)
                            .foregroundStyle(Color.textSecondary)
                    }
                }
                .tint(Color.pulpePrimary)
                .frame(minHeight: DesignTokens.ListRow.minHeight)
                .onChange(of: biometricToggle) { _, newValue in toggleBiometric(newValue) }
            }
        }
    }

    private var connectionGroup: some View {
        SettingsGroup(header: AppLocale.string("Connexion")) {
            Button { showChangePassword = true } label: {
                SettingsRow(
                    systemImage: "key",
                    title: AppLocale.string("Mot de passe"),
                    subtitle: AppLocale.string("Pour te connecter avec \(appState.currentUser?.email ?? "")")
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var recoveryGroup: some View {
        SettingsGroup(
            header: AppLocale.string("Clé de récupération"),
            footer: AppLocale.string("Elle te permet de retrouver tes montants si tu oublies ton code PIN.")
        ) {
            Button { showVerifyRecoveryKey = true } label: {
                SettingsRow(systemImage: "checkmark.shield", title: AppLocale.string("Vérifier ma clé"))
            }
            .buttonStyle(.plain)
            FormRowDivider()
            Button { securityViewModel.showConfirmPassword = true } label: {
                SettingsRow(
                    systemImage: "arrow.triangle.2.circlepath",
                    title: AppLocale.string("Générer une nouvelle clé")
                )
            }
            .buttonStyle(.plain)
            .disabled(securityViewModel.isRegenerating)
        }
    }

    private var dangerGroup: some View {
        SettingsGroup(header: AppLocale.string("Zone de danger")) {
            HStack(spacing: DesignTokens.Spacing.md) {
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                    Text("Supprimer mon compte")
                        .font(PulpeTypography.rowTitleRegular)
                        .foregroundStyle(Color.textPrimary)
                    Text("Tout est effacé après 3 jours")
                        .font(PulpeTypography.bannerText)
                        .foregroundStyle(Color.textSecondary)
                }
                .frame(maxWidth: .infinity, alignment: .leading)

                Button { showDeleteConfirmation = true } label: {
                    Text("Supprimer")
                        .font(PulpeTypography.buttonSecondary)
                        .foregroundStyle(Color.destructivePrimary)
                        .padding(.horizontal, DesignTokens.Spacing.lg)
                        .padding(.vertical, DesignTokens.Spacing.sm)
                        .background(Color.destructiveBackground, in: Capsule())
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Capsule())
                .plainPressedButtonStyle()
                .accessibilityLabel("Supprimer le compte")
                .accessibilityHint("Demande la suppression définitive de ton compte Pulpe")
            }
            .frame(minHeight: DesignTokens.ListRow.minHeight)
        }
    }

    private func toggleBiometric(_ newValue: Bool) {
        guard newValue != appState.biometricEnabled else { return }
        if newValue {
            Task {
                let success = await appState.enableBiometric()
                appState.toastManager.show(
                    success
                        ? AppLocale.string("\(biometricDisplayName) activé")
                        : AppLocale.string("Impossible d'activer \(biometricDisplayName)"),
                    type: success ? .success : .error
                )
                biometricToggle = appState.biometricEnabled
            }
        } else {
            biometricToggle = true
            showDisableBiometricConfirmation = true
        }
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
            return AppLocale.string("Utilisateur non connecté")
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
                return AppLocale.string("Mot de passe incorrect")
            }
            if error is APIError {
                return AppLocale.string("Erreur lors de la génération")
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
