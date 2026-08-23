import SwiftUI

/// Compte > Connexions: the visible side of the promise made on the consent page.
struct ConnectionsView: View {
    @State private var store: ConnectionsStore

    init(service: any MCPConnectionsServicing = MCPConnectionsService.shared) {
        _store = State(initialValue: ConnectionsStore(service: service))
    }

    var body: some View {
        Group {
            if store.isLoading {
                LoadingView(message: AppLocale.string("Chargement de tes connexions..."))
            } else if let error = store.error {
                ErrorView(error: error) {
                    await store.load()
                }
            } else if store.connections.isEmpty {
                EmptyStateView(
                    title: AppLocale.string("Aucun assistant branché"),
                    description: AppLocale.string(
                        """
                        Tu peux brancher Pulpe dans ChatGPT ou Claude pour gérer ton budget \
                        en parlant. Rien n'est partagé tant que tu n'as rien autorisé.
                        """
                    ),
                    systemImage: "link"
                )
            } else {
                connectionsList
            }
        }
        .localizedNavigationTitle("Connexions")
        .navigationBarTitleDisplayMode(.inline)
        .task {
            await store.load()
        }
    }

    private var connectionsList: some View {
        List {
            Section {
                ForEach(store.connections) { connection in
                    NavigationLink {
                        ConnectionDetailView(connection: connection, store: store)
                    } label: {
                        row(for: connection)
                    }
                }
            } footer: {
                Text("Les assistants que tu as autorisés à accéder à ton budget.")
                    .font(PulpeTypography.caption)
            }
            .listRowSettingsBackground()
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
    }

    private func row(for connection: MCPConnection) -> some View {
        VStack(alignment: .leading, spacing: 2) {
            Text(connection.clientName)
                .font(PulpeTypography.bodyLarge)
            Text(connection.mode.label)
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
            Text(AppLocale.string("depuis le \(connection.authorizedAt.abbreviatedDateFormatted)"))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
        }
        .accessibilityElement(children: .combine)
    }
}
