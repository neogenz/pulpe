import Lottie
import SwiftUI

struct MaintenanceView: View {
    @Environment(AppState.self) private var appState
    @State private var isChecking = false
    @State private var errorMessage: String?

    var body: some View {
        VStack(spacing: 24) {
            LottieView(animation: .named("maintenance-animation"))
                .playing(loopMode: .loop)
                .resizable()
                .scaledToFit()
                .frame(width: 200, height: 200)

            Text("Maintenance en cours")
                .font(.title)
                .fontWeight(.bold)

            Text("On améliore Pulpe pour toi — tes données sont bien au chaud, pas d'inquiétude. Réessaie dans quelques instants.")
                .font(.body)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .padding(.horizontal)

            if let error = errorMessage {
                Text(error)
                    .font(.footnote)
                    .foregroundStyle(.red)
            }

            Button {
                Task { await checkAndRetry() }
            } label: {
                if isChecking {
                    ProgressView()
                } else {
                    Label("Réessayer", systemImage: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isChecking)
        }
        .padding()
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }

    private func checkAndRetry() async {
        isChecking = true
        errorMessage = nil

        do {
            let stillInMaintenance = try await MaintenanceService.shared.checkStatus()
            if !stillInMaintenance {
                appState.setMaintenanceMode(false)
            } else {
                errorMessage = "Toujours en maintenance — réessaie dans un instant"
            }
        } catch {
            errorMessage = "Connexion difficile — réessaie dans un instant"
        }

        isChecking = false
    }
}

#Preview {
    MaintenanceView()
        .environment(AppState())
}
