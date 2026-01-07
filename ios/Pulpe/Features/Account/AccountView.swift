import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState

    var body: some View {
        NavigationStack {
            List {
                Section {
                    LabeledContent("E-mail", value: appState.currentUser?.email ?? "Non connecté")
                } header: {
                    Text("INFORMATIONS PERSONNELLES")
                }

                Section {
                    LabeledContent("Version", value: AppConfiguration.appVersion)
                    LabeledContent("Build", value: AppConfiguration.buildNumber)
                } header: {
                    Text("APPLICATION")
                }

                Section {
                    Button("Déconnexion", role: .destructive) {
                        Task { await appState.logout() }
                        dismiss()
                    }
                }
            }
            .listStyle(.insetGrouped)
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
