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
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(
                    title: AppLocale.string("Connexions"),
                    subtitle: AppLocale.string("Les assistants IA qui ont accès à ton budget")
                )
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    SettingsGroup(
                        footer: AppLocale.string("Touche un assistant pour voir ce qu'il a fait ou lui couper l'accès.")
                    ) {
                        ForEach(store.connections) { connection in
                            if connection.id != store.connections.first?.id {
                                FormRowDivider()
                            }
                            NavigationLink {
                                ConnectionDetailView(connection: connection, store: store)
                            } label: {
                                row(for: connection)
                            }
                            .buttonStyle(.plain)
                        }
                    }
                    InfoBanner(
                        .neutral,
                        systemImage: "info.circle",
                        text: AppLocale.string("""
                            Pour brancher un nouvel assistant, ouvre Pulpe sur le web, dans Paramètres \
                            puis Connexions. Tu choisis ses droits et tu valides avec ton code PIN.
                            """)
                    )
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.xxl)
        }
        .background { Color.appBackground.ignoresSafeArea() }
        .toolbar(removing: .title)
    }

    private func row(for connection: MCPConnection) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                Text(connection.clientName)
                    .font(PulpeTypography.bodyLarge.weight(.semibold))
                    .foregroundStyle(Color.textPrimary)
                let since = connection.authorizedAt.abbreviatedDateFormatted
                Text(AppLocale.string("\(connection.mode.label) · depuis le \(since)"))
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            RowChevron()
        }
        .frame(minHeight: DesignTokens.ListRow.minHeight)
        .contentShape(Rectangle())
        .accessibilityElement(children: .combine)
    }
}
