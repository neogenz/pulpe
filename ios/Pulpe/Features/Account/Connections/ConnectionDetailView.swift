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
        ScrollView {
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                PageHeader(
                    title: connection.clientName,
                    subtitle: AppLocale.string(
                        "\(connection.mode.label) · autorisé le \(connection.authorizedAt.abbreviatedDateFormatted)"
                    )
                )
                VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxl) {
                    if connection.mode == .readWrite {
                        activitySection
                    }
                    revokeSection
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.top, DesignTokens.Spacing.sm)
            .padding(.bottom, DesignTokens.Spacing.xxl)
        }
        .background { Color.appBackground.ignoresSafeArea() }
        .localizedNavigationTitle("Connexion")
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
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
    private var activitySection: some View {
        SettingsGroup(header: AppLocale.string("Dernières actions")) {
            if let activity {
                if activity.isEmpty {
                    Text("Aucune action pour l'instant.")
                        .font(PulpeTypography.body)
                        .foregroundStyle(Color.textSecondary)
                        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
                } else {
                    ForEach(activity) { entry in
                        if entry.id != activity.first?.id {
                            FormRowDivider()
                        }
                        activityRow(entry)
                    }
                }
            } else if activityFailed {
                Text("Impossible de charger les dernières actions.")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.textSecondary)
                    .frame(minHeight: DesignTokens.ListRow.formRowHeight)
            } else {
                ProgressView()
                    .frame(maxWidth: .infinity, minHeight: DesignTokens.ListRow.formRowHeight)
            }
        }
    }

    private func activityRow(_ entry: MCPActivity) -> some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Text(Self.name(for: entry))
                .font(PulpeTypography.rowTitleRegular)
                .foregroundStyle(Color.textPrimary)
            Spacer(minLength: DesignTokens.Spacing.sm)
            if entry.outcome == .error {
                Text("Échec")
                    .font(PulpeTypography.caption.weight(.bold))
                    .foregroundStyle(Color.financialOverBudget)
                    .padding(.horizontal, DesignTokens.Spacing.compactGap)
                    .padding(.vertical, DesignTokens.Spacing.xs)
                    .background(Color.overWash, in: Capsule())
            }
            Text(Self.timestamp(entry.createdAt))
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textSecondary)
        }
        .frame(minHeight: DesignTokens.ListRow.formRowHeight)
        .accessibilityElement(children: .combine)
    }

    private var revokeSection: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            if let revokeError {
                ErrorBanner(message: DomainErrorLocalizer.localize(revokeError))
            }
            FormCard {
                Button {
                    showRevokeConfirmation = true
                } label: {
                    HStack {
                        Spacer()
                        Text("Couper l'accès")
                            .font(PulpeTypography.rowTitleRegular.weight(.semibold))
                            .foregroundStyle(Color.errorPrimary)
                        if isRevoking {
                            ProgressView()
                        }
                        Spacer()
                    }
                    .frame(minHeight: DesignTokens.ListRow.formRowHeight)
                    .contentShape(Rectangle())
                }
                .plainPressedButtonStyle()
                .disabled(isRevoking)
            }
            Text("""
                \(connection.clientName) ne pourra plus lire ni modifier ton budget. \
                Pour le rebrancher, il faudra l'autoriser à nouveau avec ton code.
                """)
                .font(PulpeTypography.bannerText)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.lg)
                .fixedSize(horizontal: false, vertical: true)
        }
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

    /// Every write tool of the agent connector, in plain words. A table rather than
    /// a switch: one case per tool would exceed the cyclomatic complexity ceiling.
    private static let toolLabels: [String: String.LocalizationValue] = [
        "add_movement": "Mouvement ajouté",
        "update_movement": "Mouvement modifié",
        "delete_movement": "Mouvement supprimé",
        "add_forecast": "Prévision ajoutée",
        "update_forecast": "Prévision modifiée",
        "spread_expense": "Dépense lissée",
        "create_month_from_template": "Budget mensuel créé",
        "delete_month": "Mois supprimé",
        "toggle_check": "Pointage modifié",
        "create_tag": "Tag créé",
        "rename_tag": "Tag renommé",
        "delete_tag": "Tag supprimé",
        "tag_items": "Tags modifiés",
        "create_template": "Modèle créé",
        "update_template": "Modèle modifié",
        "delete_template": "Modèle supprimé",
        "duplicate_template": "Modèle dupliqué",
        "edit_template_lines": "Prévisions du modèle modifiées",
        "adjust_over_months": "Ajusté sur plusieurs mois"
    ]

    /// The tool name in plain words. An unknown tool falls back to its raw name
    /// rather than a vague "Action": a wrong reassurance is worse than a slug.
    static func label(for entry: MCPActivity, locale: Locale = AppLocale.currentUILocale) -> String {
        let name = name(for: entry, locale: locale)
        return entry.outcome == .error ? AppLocale.string("\(name) (échec)", locale: locale) : name
    }

    /// The tool in plain words, without the failure suffix: the row shows a status pill instead.
    private static func name(for entry: MCPActivity, locale: Locale = AppLocale.currentUILocale) -> String {
        toolLabels[entry.tool].map { AppLocale.string($0, locale: locale) } ?? entry.tool
    }

    private static func timestamp(_ date: Date) -> String {
        let time = date.formatted(
            Date.FormatStyle(date: .omitted, time: .shortened)
                .locale(AppLocale.currentUILocale)
        )
        return "\(date.relativeFormatted) \(time)"
    }
}
