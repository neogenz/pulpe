import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var biometricToggle = false
    @State private var showDeleteConfirmation = false
    @State private var showLogoutConfirmation = false
    @State private var showDisableBiometricConfirmation = false
    @State private var showChangePassword = false
    @State private var securityViewModel = AccountSecurityViewModel()
    @State private var isDebugVisible = false
    @State private var debugToggleTrigger = false

    var body: some View {
        NavigationStack {
            List {
                personalInfoSection
                PayDaySettingView()
                securitySection
                settingsSection
                applicationSection
                supportSection
                logoutSection
                dangerZoneSection
                legalFooterSection
            }
            .onAppear {
                biometricToggle = appState.biometricEnabled
            }
            .alert("Déconnexion", isPresented: $showLogoutConfirmation) {
                Button("Annuler", role: .cancel) { }
                Button("Déconnecter", role: .destructive) {
                    Task {
                        await appState.logout()
                        dismiss()
                    }
                }
            } message: {
                Text("Tu devras te reconnecter avec ton email et mot de passe.")
            }
            .alert(
                "Désactiver \(BiometricService.shared.biometryDisplayName) ?",
                isPresented: $showDisableBiometricConfirmation
            ) {
                Button("Annuler", role: .cancel) { }
                Button("Désactiver", role: .destructive) {
                    Task {
                        await appState.disableBiometric()
                        biometricToggle = false
                        appState.toastManager.show(
                            "\(BiometricService.shared.biometryDisplayName) désactivé",
                            type: .success
                        )
                    }
                }
            } message: {
                Text("Tu devras utiliser ton code PIN pour te connecter.")
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
            .sensoryFeedback(.impact, trigger: debugToggleTrigger)
            .listStyle(.insetGrouped)
            .trackScreen("Account")
            .navigationTitle("Compte")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
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
        }
    }
}

// MARK: - Sections

extension AccountView {
    private var personalInfoSection: some View {
        Section {
            LabeledContent("E-mail", value: appState.currentUser?.email ?? "Non connecté(e)")
        } header: {
            Text("INFORMATIONS PERSONNELLES")
        }
    }

    private var securitySection: some View {
        Section {
            LabeledContent("Code PIN") {
                Image(systemName: "checkmark.circle.fill")
                    .foregroundStyle(Color.financialSavings)
            }

            chevronRow("Mot de passe", detail: "••••••••") {
                showChangePassword = true
            }

            chevronRow("Clé de secours", detail: "Régénérer") {
                securityViewModel.showConfirmPassword = true
            }
            .disabled(securityViewModel.isRegenerating)
        } header: {
            Text("SÉCURITÉ")
        }
    }

    @ViewBuilder
    private var settingsSection: some View {
        if BiometricService.shared.canUseBiometrics() {
            Section {
                Toggle(
                    BiometricService.shared.biometryDisplayName,
                    isOn: $biometricToggle
                )
                .onChange(of: biometricToggle) { _, newValue in
                    guard newValue != appState.biometricEnabled else { return }
                    if newValue {
                        Task {
                            let displayName = BiometricService.shared.biometryDisplayName
                            let success = await appState.enableBiometric()
                            if success {
                                appState.toastManager.show("\(displayName) activé", type: .success)
                            } else {
                                appState.toastManager.show("Impossible d'activer \(displayName)", type: .error)
                            }
                            biometricToggle = appState.biometricEnabled
                        }
                    } else {
                        biometricToggle = true
                        showDisableBiometricConfirmation = true
                    }
                }
            } header: {
                Text("PARAMÈTRES DE L'APPLICATION")
            }
        }
    }

    private var applicationSection: some View {
        Section {
            LabeledContent("Version", value: AppConfiguration.appVersion)
            LabeledContent("Build", value: AppConfiguration.buildNumber)

            if isDebugVisible {
                Group {
                    LabeledContent("Environnement", value: AppConfiguration.environment.rawValue)
                    LabeledContent("API") {
                        Text(AppConfiguration.apiBaseURL.host() ?? AppConfiguration.apiBaseURL.absoluteString)
                            .font(.footnote.monospaced())
                    }
                    LabeledContent("Supabase") {
                        Text(AppConfiguration.supabaseURL.host() ?? AppConfiguration.supabaseURL.absoluteString)
                            .font(.footnote.monospaced())
                    }
                    LabeledContent("Anon Key") {
                        Text(AppConfiguration.supabaseAnonKey)
                            .font(.caption2.monospaced())
                            .lineLimit(1)
                            .truncationMode(.middle)
                    }
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }
        } header: {
            Text("APPLICATION")
                .onLongPressGesture(minimumDuration: 5) {
                    debugToggleTrigger.toggle()
                    withAnimation(.easeInOut(duration: DesignTokens.Animation.normal)) { isDebugVisible.toggle() }
                }
        }
    }

    private var supportSection: some View {
        Section {
            iconChevronLink(
                icon: "questionmark.circle",
                title: "FAQ et support",
                subtitle: "Aide et questions fréquentes",
                url: AppURLs.support
            )

            iconChevronLink(
                icon: "sparkles",
                title: "Nouveautés",
                subtitle: "Dernières mises à jour",
                url: AppURLs.changelog
            )
        } header: {
            Text("SUPPORT")
        }
    }

    private var logoutSection: some View {
        Section {
            Button {
                showLogoutConfirmation = true
            } label: {
                Text("Déconnexion")
                    .foregroundStyle(Color.errorPrimary)
            }
            .buttonStyle(.plain)
        }
    }

    private var dangerZoneSection: some View {
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
            }
        } header: {
            Text("ZONE DE DANGER")
                .foregroundStyle(Color.destructivePrimary)
        }
        .listRowBackground(Color.destructiveBackground)
    }

    private var legalFooterSection: some View {
        Section {
            VStack(spacing: DesignTokens.Spacing.sm) {
                // swiftlint:disable:next force_try
                Text(try! AttributedString(
                    markdown: "Les [Conditions générales](\(AppURLs.terms)) et " +
                        "l'[Avis de confidentialité](\(AppURLs.privacy)) de Pulpe s'appliquent."
                ))
                .font(PulpeTypography.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .tint(Color.pulpePrimary)

                Text("Version \(AppConfiguration.appVersion) - \(AppConfiguration.buildNumber)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.top, DesignTokens.Spacing.xs)
            }
            .frame(maxWidth: .infinity)
        }
        .listRowBackground(Color.clear)
    }
}

// MARK: - Row Helpers

extension AccountView {
    private func chevronRow(
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

    private func iconChevronLink(
        icon: String,
        title: String,
        subtitle: String,
        url: URL
    ) -> some View {
        Link(destination: url) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(Color.pulpePrimary)
                    .frame(
                        width: DesignTokens.IconSize.compact,
                        height: DesignTokens.IconSize.compact
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
    }
}

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
    AccountView()
        .environment(AppState())
        .environment(UserSettingsStore())
}
