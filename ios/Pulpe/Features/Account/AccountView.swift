import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @Environment(FeatureFlagsStore.self) private var featureFlagsStore
    @State private var showLogoutConfirmation = false
    @State private var isDebugVisible = false
    @State private var debugToggleTrigger = false

    var body: some View {
        NavigationStack {
            List {
                profileHeaderSection
                appSettingsSection
                supportSection
                legalSection
                logoutSection
                versionFooterSection
            }
            .scrollContentBackground(.hidden)
            .pulpeBackground()
            .alert("Déconnexion", isPresented: $showLogoutConfirmation) {
                Button("Annuler", role: .cancel) { }
                Button("Déconnecter", role: .destructive) {
                    Task {
                        await appState.logout()
                        dismiss()
                    }
                }
            } message: {
                Text("Tu devras te reconnecter avec ton email et ton mot de passe.")
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
    private var profileHeaderSection: some View {
        Section {
            VStack(spacing: DesignTokens.Spacing.sm) {
                let email = appState.currentUser?.email ?? ""
                let initial = email.first.map { String($0).uppercased() } ?? "?"
                ZStack {
                    Circle()
                        .fill(Color.pulpePrimary)
                        .frame(width: 56, height: 56)
                    Text(initial)
                        .font(PulpeTypography.amountXL)
                        .foregroundStyle(Color.textOnPrimary)
                }
                Text(email.isEmpty ? "Non connecté(e)" : email)
                    .font(PulpeTypography.bodyLarge)
                Text("Pulpe")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textSecondary)
            }
            .frame(maxWidth: .infinity)
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
        .listRowBackground(Color.clear)
    }

    private var appSettingsSection: some View {
        Section {
            settingsNavigationRow(
                icon: "lock.shield",
                iconColor: Color.pulpePrimary,
                title: "Sécurité",
                subtitle: "Code PIN, Mot de passe, Biométrie"
            ) {
                SecuritySettingsView()
            }

            settingsNavigationRow(
                icon: "gearshape",
                iconColor: Color.textSecondary,
                title: "Préférences",
                subtitle: featureFlagsStore.isMultiCurrencyEnabled ? "Jour de paie et devise" : "Jour de paie"
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
                iconColor: Color.financialIncome,
                title: "FAQ et support",
                subtitle: "Aide et questions fréquentes",
                url: AppURLs.support
            )

            iconChevronLink(
                icon: "sparkles",
                iconColor: Color.pulpePrimary,
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
            .plainPressedButtonStyle()
        }
    }

    private var legalSection: some View {
        Section {
            iconChevronLink(
                icon: "doc.text",
                iconColor: Color.textSecondary,
                title: "Conditions générales",
                subtitle: "Conditions d'utilisation de Pulpe",
                url: AppURLs.terms
            )

            iconChevronLink(
                icon: "hand.raised",
                iconColor: Color.textSecondary,
                title: "Avis de confidentialité",
                subtitle: "Protection de tes données",
                url: AppURLs.privacy
            )
        } header: {
            Text("LÉGAL")
        }
    }

    private var versionFooterSection: some View {
        Section {
            VStack(spacing: DesignTokens.Spacing.sm) {
                Text("Version \(AppConfiguration.appVersion) - \(AppConfiguration.buildNumber)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .onLongPressGesture(minimumDuration: 5) {
                        debugToggleTrigger.toggle()
                        withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                            isDebugVisible.toggle()
                        }
                    }

                Text("iOS \(Self.iOSVersion)")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)

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
        iconColor: Color,
        title: String,
        subtitle: String,
        @ViewBuilder destination: () -> Destination
    ) -> some View {
        NavigationLink(destination: destination) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(iconColor)
                    .frame(
                        width: DesignTokens.IconSize.compact,
                        height: DesignTokens.IconSize.compact
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
        }
    }

    private func iconChevronLink(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        url: URL
    ) -> some View {
        Link(destination: url) {
            HStack(spacing: DesignTokens.Spacing.md) {
                Image(systemName: icon)
                    .font(PulpeTypography.listRowTitle)
                    .foregroundStyle(iconColor)
                    .frame(
                        width: DesignTokens.IconSize.compact,
                        height: DesignTokens.IconSize.compact
                    )
                VStack(alignment: .leading, spacing: 2) {
                    Text(title)
                        .foregroundStyle(.primary)
                    Text(subtitle)
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
                Spacer()
                Image(systemName: "arrow.up.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .tint(.primary)
    }
}

#Preview {
    AccountView()
        .environment(AppState())
        .environment(UserSettingsStore())
        .environment(FeatureFlagsStore())
}
