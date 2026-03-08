import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var showLogoutConfirmation = false
    @State private var isDebugVisible = false
    @State private var debugToggleTrigger = false

    var body: some View {
        NavigationStack {
            List {
                personalInfoSection
                appSettingsSection
                supportSection
                logoutSection
                legalFooterSection
            }
            .alert("Déconnexion", isPresented: $showLogoutConfirmation) {
                Button("Annuler", role: .cancel) { }
                Button("Déconnecter", role: .destructive) {
                    Task {
                        await appState.logout()
                        dismiss()
                    }
                }
            } message: {
                Text("Tu devras te reconnecter avec ton email et mot de passe.")
            }
            .sensoryFeedback(.impact, trigger: debugToggleTrigger)
            .listStyle(.insetGrouped)
            .trackScreen("Account")
            .navigationTitle("Compte")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
        }
    }
}

// MARK: - Sections

extension AccountView {
    private var personalInfoSection: some View {
        Section {
            LabeledContent("E-mail", value: appState.currentUser?.email ?? "Non connecté(e)")
        } header: {
            Text("INFORMATIONS PERSONNELLES")
        }
    }

    private var appSettingsSection: some View {
        Section {
            settingsNavigationRow(
                icon: "lock.shield",
                title: "Sécurité",
                subtitle: "Code PIN, Mot de passe, Biométrie"
            ) {
                SecuritySettingsView()
            }

            settingsNavigationRow(
                icon: "gearshape",
                title: "Préférences",
                subtitle: "Jour de paie"
            ) {
                PreferencesView()
            }
        } header: {
            Text("PARAMÈTRES DE L'APPLICATION")
        }
    }

    private var supportSection: some View {
        Section {
            iconChevronLink(
                icon: "questionmark.circle",
                title: "FAQ et support",
                subtitle: "Aide et questions fréquentes",
                url: AppURLs.support
            )

            iconChevronLink(
                icon: "sparkles",
                title: "Nouveautés",
                subtitle: "Dernières mises à jour",
                url: AppURLs.changelog
            )
        } header: {
            Text("SUPPORT")
        }
    }

    private var logoutSection: some View {
        Section {
            Button {
                showLogoutConfirmation = true
            } label: {
                Text("Déconnexion")
                    .foregroundStyle(Color.errorPrimary)
            }
            .buttonStyle(.plain)
        }
    }

    private static let legalText: AttributedString = {
        (try? AttributedString(
            markdown: "Les [Conditions générales](\(AppURLs.terms)) et " +
                "l'[Avis de confidentialité](\(AppURLs.privacy)) de Pulpe s'appliquent."
        )) ?? AttributedString(
            "Les Conditions générales et l'Avis de confidentialité de Pulpe s'appliquent."
        )
    }()

    private var legalFooterSection: some View {
        Section {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text(Self.legalText)
                .font(PulpeTypography.caption)
                .foregroundStyle(.secondary)
                .multilineTextAlignment(.center)
                .tint(Color.pulpePrimary)

                Text("Version \(AppConfiguration.appVersion) - \(AppConfiguration.buildNumber)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.tertiary)
                    .padding(.top, DesignTokens.Spacing.xs)
                    .onLongPressGesture(minimumDuration: 5) {
                        debugToggleTrigger.toggle()
                        withAnimation(.easeInOut(duration: DesignTokens.Animation.normal)) {
                            isDebugVisible.toggle()
                        }
                    }

                Text("iOS \(Self.iOSVersion)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(.tertiary)

                if isDebugVisible {
                    Group {
                        LabeledContent("Env", value: AppConfiguration.environment.rawValue)
                        LabeledContent("API") {
                            Text(AppConfiguration.apiBaseURL.host() ?? AppConfiguration.apiBaseURL.absoluteString)
                                .font(.footnote.monospaced())
                        }
                        LabeledContent("Supabase") {
                            Text(AppConfiguration.supabaseURL.host() ?? AppConfiguration.supabaseURL.absoluteString)
                                .font(.footnote.monospaced())
                        }
                        LabeledContent("Anon Key") {
                            Text(AppConfiguration.supabaseAnonKey)
                                .font(.caption2.monospaced())
                                .lineLimit(1)
                                .truncationMode(.middle)
                        }
                    }
                    .font(PulpeTypography.caption)
                    .transition(.opacity.combined(with: .move(edge: .top)))
                }
            }
            .frame(maxWidth: .infinity)
        }
        .listRowBackground(Color.clear)
    }

    private static let iOSVersion = UIDevice.current.systemVersion
}

// MARK: - Row Helpers

extension AccountView {
    private func settingsNavigationRow<Destination: View>(
        icon: String,
        title: String,
        subtitle: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
                    .frame(
                        width: DesignTokens.IconSize.compact,
                        height: DesignTokens.IconSize.compact
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                }
            }
        }
    }

    private func iconChevronLink(
        icon: String,
        title: String,
        subtitle: String,
        url: URL
    ) -> some View {
        Link(destination: url) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(.system(size: 16))
                    .foregroundStyle(.secondary)
                    .frame(
                        width: DesignTokens.IconSize.compact,
                        height: DesignTokens.IconSize.compact
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(.secondary)
                }
                Spacer()
                Image(systemName: "chevron.right")
                    .font(.caption)
                    .foregroundStyle(.tertiary)
            }
        }
        .tint(.primary)
    }
}

#Preview {
    AccountView()
        .environment(AppState())
        .environment(UserSettingsStore())
}
