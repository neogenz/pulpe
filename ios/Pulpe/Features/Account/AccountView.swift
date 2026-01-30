import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var biometricToggle = false

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

                if BiometricService.shared.canUseBiometrics() {
                    Section {
                        Toggle(
                            BiometricService.shared.biometryDisplayName,
                            isOn: $biometricToggle
                        )
                        .onChange(of: biometricToggle) { _, newValue in
                            Task {
                                if newValue {
                                    await appState.enableBiometric()
                                } else {
                                    await appState.disableBiometric()
                                }
                                biometricToggle = appState.biometricEnabled
                            }
                        }
                    } header: {
                        Text("SÉCURITÉ")
                            .font(PulpeTypography.labelLarge)
                    }
                    .listRowBackground(Color.surfaceCard)
                }

                Section {
                    LabeledContent("Version", value: AppConfiguration.appVersion)
                    LabeledContent("Build", value: AppConfiguration.buildNumber)
                } header: {
                    Text("APPLICATION")
                        .font(PulpeTypography.labelLarge)
                }
                .listRowBackground(Color.surfaceCard)

                Section {
                    Button("Déconnexion", role: .destructive) {
                        Task { await appState.logout() }
                        dismiss()
                    }
                }
                .listRowBackground(Color.surfaceCard)
            }
            .onAppear {
                biometricToggle = appState.biometricEnabled
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
