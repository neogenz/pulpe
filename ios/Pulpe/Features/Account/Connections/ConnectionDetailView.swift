import SwiftUI

/// One connection: what was granted, what the agent actually did, and the cut.
struct ConnectionDetailView: View {
    let connection: MCPConnection
    let store: ConnectionsStore

    @Environment(\.dismiss) private var dismiss
    @State private var activity: [MCPActivity]?
    @State private var activityFailed = false
    @State private var showRevokeConfirmation = false
    @State private var isRevoking = false
    @State private var revokeError: Error?

    var body: some View {
        List {
            headerSection
            if connection.mode == .readWrite {
                activitySection
            }
            revokeSection
        }
        .scrollContentBackground(.hidden)
        .pulpeBackground()
        .listStyle(.insetGrouped)
        .localizedNavigationTitle("Connexion")
        .navigationBarTitleDisplayMode(.inline)
        .alert(Text("Couper l'accès ?"), isPresented: $showRevokeConfirmation) {
            Button("Annuler", role: .cancel) { }
            Button("Couper l'accès", role: .destructive) {
                Task { await revoke() }
            }
        } message: {
            Text(
                """
                \(connection.clientName) ne pourra plus lire ni modifier ton budget. \
                Pour le rebrancher, il faudra l'autoriser à nouveau avec ton code.
                """
            )
        }
        .task {
            guard connection.mode == .readWrite else { return }
            await loadActivity()
        }
    }
}

// MARK: - Sections

extension ConnectionDetailView {
    private var headerSection: some View {
        Section {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text(connection.clientName)
                    .font(PulpeTypography.title3)
                Text(connection.mode.label)
                    .font(PulpeTypography.bodyLarge)
                    .foregroundStyle(Color.textSecondary)
                Text(AppLocale.string("Autorisé le \(connection.authorizedAt.abbreviatedDateFormatted)"))
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
            .padding(.vertical, DesignTokens.Spacing.xs)
            .accessibilityElement(children: .combine)
        }
        .listRowSettingsBackground()
    }

    private var activitySection: some View {
        Section {
            if let activity {
                if activity.isEmpty {
                    Text("Aucune action pour l'instant.")
                        .font(PulpeTypography.body)
                        .foregroundStyle(Color.textSecondary)
                } else {
                    ForEach(activity) { entry in
                        activityRow(entry)
                    }
                }
            } else if activityFailed {
                Text("Impossible de charger les dernières actions.")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.textSecondary)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity)
            }
        } header: {
            Text("DERNIÈRES ACTIONS")
        }
        .listRowSettingsBackground()
    }

    private func activityRow(_ entry: MCPActivity) -> some View {
        HStack(alignment: .firstTextBaseline, spacing: DesignTokens.Spacing.md) {
            Text(Self.label(for: entry))
                .font(PulpeTypography.bodyLarge)
                .foregroundStyle(entry.outcome == .error ? Color.errorPrimary : .primary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            Text(Self.timestamp(entry.createdAt))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .accessibilityElement(children: .combine)
    }

    private var revokeSection: some View {
        Section {
            if let revokeError {
                ErrorBanner(message: DomainErrorLocalizer.localize(revokeError))
                    .listRowInsets(EdgeInsets())
                    .listRowBackground(Color.clear)
            }
            Button {
                showRevokeConfirmation = true
            } label: {
                HStack {
                    Text("Couper l'accès")
                        .foregroundStyle(Color.errorPrimary)
                    if isRevoking {
                        Spacer()
                        ProgressView()
                    }
                }
            }
            .plainPressedButtonStyle()
            .disabled(isRevoking)
        }
        .listRowSettingsBackground()
    }
}

// MARK: - Behaviour

extension ConnectionDetailView {
    private func loadActivity() async {
        activityFailed = false
        do {
            activity = try await store.activity(for: connection.id)
        } catch is CancellationError {
            return
        } catch {
            activityFailed = true
        }
    }

    private func revoke() async {
        isRevoking = true
        revokeError = nil
        defer { isRevoking = false }

        do {
            try await store.revoke(connectionId: connection.id)
            dismiss()
        } catch {
            revokeError = error
        }
    }

    /// The tool name in plain words. An unknown tool falls back to its raw name
    /// rather than a vague "Action": a wrong reassurance is worse than a slug.
    private static func label(for entry: MCPActivity) -> String {
        let name = switch entry.tool {
        case "add_movement": AppLocale.string("Mouvement ajouté")
        default: entry.tool
        }
        return entry.outcome == .error ? AppLocale.string("\(name) (échec)") : name
    }

    private static func timestamp(_ date: Date) -> String {
        let time = date.formatted(
            Date.FormatStyle(date: .omitted, time: .shortened)
                .locale(AppLocale.currentUILocale)
        )
        return "\(date.relativeFormatted) \(time)"
    }
}
