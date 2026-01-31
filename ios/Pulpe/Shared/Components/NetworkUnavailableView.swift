import SwiftUI

/// Full-screen view shown when the backend server is unreachable at startup
struct NetworkUnavailableView: View {
    let onRetry: () async -> Void
    @State private var isRetrying = false

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            Spacer()

            Image(systemName: "wifi.exclamationmark")
                .font(.system(size: 56))
                .foregroundStyle(.secondary)

            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Connexion impossible")
                    .font(.title2)
                    .fontWeight(.bold)

                Text("Impossible de joindre le serveur — vérifie ta connexion internet et réessaie.")
                    .font(.body)
                    .foregroundStyle(.secondary)
                    .multilineTextAlignment(.center)
                    .padding(.horizontal, DesignTokens.Spacing.xxl)
            }

            Button {
                Task {
                    isRetrying = true
                    defer { isRetrying = false }
                    await onRetry()
                }
            } label: {
                if isRetrying {
                    ProgressView()
                } else {
                    Label("Réessayer", systemImage: "arrow.clockwise")
                }
            }
            .buttonStyle(.borderedProminent)
            .disabled(isRetrying)

            Spacer()
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .pulpeBackground()
    }
}

#Preview {
    NetworkUnavailableView {
        try? await Task.sleep(for: .seconds(1))
    }
}
