import SwiftUI

struct AccountView: View {
    @Environment(\.dismiss) private var dismiss
    @Environment(AppState.self) private var appState
    @State private var showLogoutConfirmation = false
    @State private var isDebugVisible = false
    @State private var debugToggleTrigger = false
    @State private var showEditFirstName = false
    @State private var showFeedback = false
    private let feedbackPromptPreferences = FeedbackPromptPreferences()

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
            .localizedNavigationTitle("Compte")
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Fermer") { dismiss() }
                }
            }
            .sheet(isPresented: $showEditFirstName) {
                EditFirstNameSheet(initialFirstName: appState.currentUser?.firstName)
            }
            .sheet(isPresented: $showFeedback) {
                FeedbackSheet {
                    guard let userID = appState.currentUser?.id else { return }
                    feedbackPromptPreferences.markAutomaticPromptHandled(for: userID)
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
                // Decorative: the email right below already carries the identity, so
                // VoiceOver has no reason to announce a lone initial or the photo.
                ProfileAvatar(
                    firstName: appState.currentUser?.firstName,
                    email: appState.currentUser?.email,
                    avatarUrl: appState.currentUser?.avatarUrl,
                    diameter: DesignTokens.IconSize.heroBadge,
                    background: .pulpePrimary,
                    foreground: .textOnPrimary,
                    font: PulpeTypography.amountXL
                )
                .accessibilityHidden(true)

                if let firstName = FirstNameResolver.normalized(appState.currentUser?.firstName) {
                    Text(firstName)
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textPrimary)
                    Text(email.isEmpty ? AppLocale.string("Non connecté(e)") : email)
                        .font(PulpeTypography.bodyLarge)
                    firstNameActionButton(
                        title: AppLocale.string("Modifier"),
                        identifier: "editFirstNameButton"
                    )
                } else {
                    firstNameActionButton(
                        title: AppLocale.string("Ajouter un prénom"),
                        identifier: "addFirstNameButton"
                    )
                    Text(email.isEmpty ? AppLocale.string("Non connecté(e)") : email)
                        .font(PulpeTypography.bodyLarge)
                }
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
                title: AppLocale.string("Sécurité"),
                subtitle: AppLocale.string("Code PIN, Mot de passe, Biométrie")
            ) {
                SecuritySettingsView()
            }

            settingsNavigationRow(
                icon: "gearshape",
                iconColor: Color.textSecondary,
                title: AppLocale.string("Préférences"),
                subtitle: AppLocale.string("Jour de paie et devise")
            ) {
                PreferencesView()
            }

            settingsNavigationRow(
                icon: "tag",
                iconColor: Color.textSecondary,
                title: AppLocale.string("Mes tags"),
                subtitle: AppLocale.string("Tes tags personnels")
            ) {
                TagsSettingsView()
            }
        } header: {
            Text("PARAMÈTRES DE L'APPLICATION")
        }
        .listRowSettingsBackground()
    }

    private var supportSection: some View {
        Section {
            iconChevronLink(
                icon: "questionmark.circle",
                iconColor: Color.financialIncome,
                title: AppLocale.string("FAQ et support"),
                subtitle: AppLocale.string("Aide et questions fréquentes"),
                url: AppURLs.support
            )

            iconChevronButton(
                icon: "bubble.left.and.bubble.right",
                iconColor: Color.pulpePrimary,
                title: AppLocale.string("Donner mon avis"),
                subtitle: AppLocale.string("Partage une impression en 30 secondes")
            ) {
                showFeedback = true
            }

            iconChevronLink(
                icon: "sparkles",
                iconColor: Color.pulpePrimary,
                title: AppLocale.string("Nouveautés"),
                subtitle: AppLocale.string("Dernières mises à jour"),
                url: AppURLs.changelog
            )
        } header: {
            Text("SUPPORT")
        }
        .listRowSettingsBackground()
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
        .listRowSettingsBackground()
    }

    private var legalSection: some View {
        Section {
            iconChevronLink(
                icon: "doc.text",
                iconColor: Color.textSecondary,
                title: AppLocale.string("Conditions générales"),
                subtitle: AppLocale.string("Conditions d'utilisation de Pulpe"),
                url: AppURLs.terms
            )

            iconChevronLink(
                icon: "hand.raised",
                iconColor: Color.textSecondary,
                title: AppLocale.string("Avis de confidentialité"),
                subtitle: AppLocale.string("Protection de tes données"),
                url: AppURLs.privacy
            )
        } header: {
            Text("LÉGAL")
        }
        .listRowSettingsBackground()
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
    /// Text link in the profile stack: expand the hit area to 44pt without
    /// growing the `VStack` (pad → shape → negative pad, same as `SectionHeader`).
    private func firstNameActionButton(title: String, identifier: String) -> some View {
        Button(title) { showEditFirstName = true }
            .font(PulpeTypography.buttonSecondary)
            .foregroundStyle(Color.pulpePrimary)
            .padding(.vertical, DesignTokens.TapTarget.minimum / 2)
            .contentShape(Rectangle())
            .padding(.vertical, -DesignTokens.TapTarget.minimum / 2)
            .textLinkButtonStyle()
            .accessibilityIdentifier(identifier)
    }

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

    private func iconChevronButton(
        icon: String,
        iconColor: Color,
        title: String,
        subtitle: String,
        action: @escaping () -> Void
    ) -> some View {
        Button(action: action) {
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
                Image(systemName: "chevron.right")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
            }
        }
        .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum, alignment: .leading)
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityLabel(title)
        .accessibilityHint(subtitle)
        .accessibilityIdentifier("openFeedback")
    }
}

#Preview {
    AccountView()
        .environment(AppState())
        .environment(UserSettingsStore())
}
