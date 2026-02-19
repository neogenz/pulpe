import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var biometricToggle = false
    @State private var showDeleteConfirmation = false
    @State private var showChangePassword = false
    @State private var securityViewModel = AccountSecurityViewModel()
    @State private var isDebugVisible = false

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("E-mail", value: appState.currentUser?.email ?? "Non connecté(e)")
                } header: {
                    Text("INFORMATIONS PERSONNELLES")
                        .font(PulpeTypography.labelLarge)
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    LabeledContent("Code PIN") {
                        Image(systemName: "checkmark.circle.fill")
                            .foregroundStyle(.green)
                    }

                    if BiometricService.shared.canUseBiometrics() {
                        Toggle(
                            BiometricService.shared.biometryDisplayName,
                            isOn: $biometricToggle
                        )
                        .onChange(of: biometricToggle) { _, newValue in
                            guard newValue != appState.biometricEnabled else { return }
                            Task {
                                let displayName = BiometricService.shared.biometryDisplayName
                                if newValue {
                                    let success = await appState.enableBiometric()
                                    if success {
                                        appState.toastManager.show("\(displayName) activé", type: .success)
                                    } else {
                                        appState.toastManager.show("Impossible d'activer \(displayName)", type: .error)
                                    }
                                } else {
                                    await appState.disableBiometric()
                                    appState.toastManager.show("\(displayName) désactivé", type: .success)
                                }
                                biometricToggle = appState.biometricEnabled
                            }
                        }
                    }

                    LabeledContent("Mot de passe") {
                        Button("Changer") {
                            showChangePassword = true
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .tint(.pulpePrimary)
                    }

                    LabeledContent("Clé de secours") {
                        Button("Régénérer") {
                            securityViewModel.showConfirmPassword = true
                        }
                        .buttonStyle(.bordered)
                        .buttonBorderShape(.capsule)
                        .tint(.pulpePrimary)
                        .disabled(securityViewModel.isRegenerating)
                    }
                } header: {
                    Text("SÉCURITÉ")
                        .font(PulpeTypography.labelLarge)
                }
                .listRowBackground(Color.surfaceCard)

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
                        .font(PulpeTypography.labelLarge)
                        .onLongPressGesture(minimumDuration: 5) {
                            UIImpactFeedbackGenerator(style: .medium).impactOccurred()
                            withAnimation(.easeInOut(duration: 0.3)) { isDebugVisible.toggle() }
                        }
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    Button {
                        showDeleteConfirmation = true
                    } label: {
                        Text("Supprimer mon compte")
                            .foregroundStyle(Color.errorPrimary)
                    }
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    Button {
                        Task {
                            await appState.logout()
                            dismiss()
                        }
                    } label: {
                        Text("Déconnexion")
                            .foregroundStyle(Color.errorPrimary)
                    }
                }
                .listRowBackground(Color.surfaceCard)
            }
            .onAppear {
                biometricToggle = appState.biometricEnabled
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
                Text("Votre compte sera définitivement supprimé après un délai de 3 jours. Cette action est irréversible.")
            }
            .listStyle(.insetGrouped)
            .scrollContentBackground(.hidden)
            .background(Color.surfacePrimary)
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
}
