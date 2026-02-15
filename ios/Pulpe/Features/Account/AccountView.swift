import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var biometricToggle = false
    @State private var showDeleteConfirmation = false

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
                } header: {
                    Text("SÉCURITÉ")
                        .font(PulpeTypography.labelLarge)
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    LabeledContent("Version", value: AppConfiguration.appVersion)
                    LabeledContent("Build", value: AppConfiguration.buildNumber)
                } header: {
                    Text("APPLICATION")
                        .font(PulpeTypography.labelLarge)
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    Button("Supprimer mon compte", role: .destructive) {
                        showDeleteConfirmation = true
                    }
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    Button("Déconnexion", role: .destructive) {
                        Task {
                            await appState.logout()
                            dismiss()
                        }
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
        }
    }
}

#Preview {
    AccountView()
        .environment(AppState())
}
