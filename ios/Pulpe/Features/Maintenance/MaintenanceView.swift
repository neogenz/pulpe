import SwiftUI

struct MaintenanceView: View {
    @Environment(AppState.self) private var appState
    @State private var isChecking = false

    var body: some View {
        StatusScreen(
            systemImage: "wrench.and.screwdriver",
            title: AppLocale.string("Maintenance en cours"),
            message: AppLocale.string(
                "J'améliore Pulpe. Tes données sont en sécurité, réessaie dans quelques instants."
            ),
            primary: .init(title: AppLocale.string("Réessayer")) {
                guard !isChecking else { return }
                Task { await checkAndRetry() }
            }
        )
    }

    private func checkAndRetry() async {
        isChecking = true
        defer { isChecking = false }

        do {
            let stillInMaintenance = try await MaintenanceService.shared.checkStatus()
            if stillInMaintenance {
                appState.toastManager.show(
                    AppLocale.string("Toujours en maintenance, réessaie dans un instant"),
                    type: .error
                )
            } else {
                appState.setMaintenanceMode(false)
            }
        } catch {
            appState.toastManager.show(
                AppLocale.string("Connexion difficile, réessaie dans un instant"),
                type: .error
            )
        }
    }
}

#Preview {
    MaintenanceView()
        .environment(AppState())
}
