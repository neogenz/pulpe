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
        .navigationBarTitleDisplayMode(.large)
        .task {
            await store.load()
        }
    }

    private var connectionsList: some View {
        List {
            Section {
                InfoBanner(
                    .neutral,
                    systemImage: "info.circle",
                    text: AppLocale.string("Pour brancher un assistant, ouvre pulpe.app depuis ChatGPT ou Claude.")
                )
                .listRowBackground(Color.clear)
                .listRowInsets(EdgeInsets())
            }
            Section {
                ForEach(store.connections) { connection in
                    NavigationLink {
                        ConnectionDetailView(connection: connection, store: store)
                    } label: {
                        row(for: connection)
                    }
                }
            } footer: {
                Text("Touche un assistant pour voir son activité ou couper l'accès.")
                    .font(PulpeTypography.caption)
            }
            .listRowSettingsBackground()
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
    }

    private func row(for connection: MCPConnection) -> some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
            Text(connection.clientName)
                .font(PulpeTypography.bodyLarge)
            let since = connection.authorizedAt.abbreviatedDateFormatted
            Text(AppLocale.string("\(connection.mode.label) · depuis le \(since)"))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }
}
