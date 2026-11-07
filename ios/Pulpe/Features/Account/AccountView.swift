import SwiftUI

/// Compte (V2): a page pushed on the accueil's stack, so the tab bar stays and « Accueil » is
/// the way back.
struct AccountView: View {
    @Environment(AppState.self) private var appState
    @Environment(TagStore.self) private var tagStore
    @Environment(\.openURL) private var openURL
    @State private var showLogoutConfirmation = false
    @State private var isDebugVisible = false
    @State private var debugToggleTrigger = false
    @State private var showEditFirstName = false
    @State private var showFeedback = false
    @State private var whatsNew: WhatsNewPresentation?
    @State private var connectionCount: Int?
    private let feedbackPromptPreferences = FeedbackPromptPreferences()
    private let biometricDisplayName = BiometricService.shared.biometryDisplayName

    var body: some View {
        ScrollView {
            VStack(spacing: DesignTokens.Spacing.xxl) {
                PageHeader(title: AppLocale.string("Compte"))
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    profileCard
                    settingsGroup
                    helpGroup
                    legalGroup
                    logoutButton
                    versionFooter
                }
                .padding(.horizontal, DesignTokens.Spacing.lg)
            }
            .padding(.top, DesignTokens.Spacing.sm)
        }
        .pulpeRootBottomInset()
        .background { Color.appBackground.ignoresSafeArea() }
        .navigationTitle(Tab.currentMonth.title)
        .navigationBarTitleDisplayMode(.inline)
        .toolbar(removing: .title)
        .alert("Déconnexion", isPresented: $showLogoutConfirmation) {
            Button("Annuler", role: .cancel) { }
            Button("Se déconnecter") {
                Task { await appState.logout() }
            }
        } message: {
            Text("Tu devras te reconnecter avec ton email et ton mot de passe.")
        }
        .sensoryFeedback(.impact, trigger: debugToggleTrigger)
        .trackScreen("Account")
        .task {
            await tagStore.loadIfNeeded()
            connectionCount = try? await MCPConnectionsService.shared.getAll().count
        }
        .sheet(isPresented: $showEditFirstName) {
            EditFirstNameSheet(initialFirstName: appState.currentUser?.firstName)
        }
        .sheet(isPresented: $showFeedback) {
            FeedbackSheet(source: .settings) {
                guard let userID = appState.currentUser?.id else { return }
                feedbackPromptPreferences.markSubmitted(for: userID)
            }
        }
        .sheet(item: $whatsNew) { presentation in
            WhatsNewSheet(
                currentVersion: AppConfiguration.appVersion,
                entries: [presentation.entry],
                onDismiss: { whatsNew = nil }
            )
            .standardSheetPresentation()
        }
    }
}

/// The release note opened from Compte, on demand.
struct WhatsNewPresentation: Identifiable {
    let entry: WhatsNewEntry
    var id: String { entry.id }
}

// MARK: - Profile

extension AccountView {
    private var profileCard: some View {
        let user = appState.currentUser
        let email = (user?.email).flatMap { $0.isEmpty ? nil : $0 } ?? AppLocale.string("Non connecté(e)")
        let firstName = FirstNameResolver.normalized(user?.firstName)
        return HStack(spacing: DesignTokens.Spacing.lg) {
            // Decorative: the name and email beside it carry the identity.
            ProfileAvatar(
                firstName: user?.firstName,
                email: user?.email,
                avatarUrl: user?.avatarUrl,
                diameter: DesignTokens.IconSize.statusDisc,
                background: .accentWash,
                foreground: .accentInk,
                font: PulpeTypography.amountXL
            )
            .accessibilityHidden(true)

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xxs) {
                if let firstName {
                    Text(firstName)
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textPrimary)
                }
                Text(email)
                    .font(PulpeTypography.bannerText)
                    .foregroundStyle(Color.textSecondary)
                    .lineLimit(1)
                    .truncationMode(.middle)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            Button {
                showEditFirstName = true
            } label: {
                Text(firstName == nil ? "Ajouter" : "Modifier")
                    .font(PulpeTypography.buttonSecondary)
                    .lineLimit(1)
                    .fixedSize()
                    .foregroundStyle(Color.accentInk)
                    .padding(.horizontal, DesignTokens.Spacing.md)
                    .padding(.vertical, DesignTokens.Spacing.sm)
                    .background(Color.accentWash, in: Capsule())
            }
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Capsule())
            .plainPressedButtonStyle()
            .accessibilityLabel(Text(firstName == nil ? "Ajouter un prénom" : "Modifier"))
            .accessibilityIdentifier(firstName == nil ? "addFirstNameButton" : "editFirstNameButton")
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity)
        .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.surface)
        .overlay {
            RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.surface)
                .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
        }
    }
}

// MARK: - Groups

extension AccountView {
    private var settingsGroup: some View {
        SettingsGroup(header: AppLocale.string("Réglages")) {
            NavigationLink { SecuritySettingsView() } label: {
                SettingsRow(
                    systemImage: "lock",
                    title: AppLocale.string("Sécurité"),
                    subtitle: AppLocale.string("Code PIN, mot de passe, \(biometricDisplayName)")
                )
            }
            .buttonStyle(.plain)
            FormRowDivider()
            NavigationLink { PreferencesView() } label: {
                SettingsRow(
                    systemImage: "slider.horizontal.3",
                    title: AppLocale.string("Préférences"),
                    subtitle: AppLocale.string("Devise, langue, jour de paie, rappels")
                )
            }
            .buttonStyle(.plain)
            FormRowDivider()
            NavigationLink { TagsSettingsView() } label: {
                SettingsRow(
                    systemImage: "tag",
                    title: AppLocale.string("Mes tags"),
                    subtitle: tagStore.hasLoadedOnce
                        ? AppLocale.string("\(tagStore.tags.count) tags")
                        : AppLocale.string("Tes tags personnels")
                )
            }
            .buttonStyle(.plain)
            FormRowDivider()
            NavigationLink { ConnectionsView() } label: {
                SettingsRow(
                    systemImage: "link",
                    title: AppLocale.string("Connexions"),
                    subtitle: connectionCount.map { AppLocale.string("\($0) assistants IA autorisés") }
                        ?? AppLocale.string("Assistants IA autorisés")
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var helpGroup: some View {
        SettingsGroup(header: AppLocale.string("Aide")) {
            Link(destination: AppURLs.support) {
                SettingsRow(
                    systemImage: "questionmark.circle",
                    title: AppLocale.string("FAQ et support"),
                    subtitle: AppLocale.string("S'ouvre sur pulpe.app"),
                    isExternal: true
                )
            }
            .tint(.primary)
            FormRowDivider()
            Button { showFeedback = true } label: {
                SettingsRow(
                    systemImage: "bubble.left",
                    title: AppLocale.string("Donner mon avis"),
                    subtitle: AppLocale.string("Une impression en 30 secondes")
                )
            }
            .buttonStyle(.plain)
            .accessibilityIdentifier("openFeedback")
            FormRowDivider()
            Button { Task { await openWhatsNew() } } label: {
                SettingsRow(
                    systemImage: "sparkles",
                    title: AppLocale.string("Nouveautés"),
                    subtitle: AppLocale.string("Ce qui a changé dans la \(Self.shortVersion)")
                )
            }
            .buttonStyle(.plain)
        }
    }

    private var legalGroup: some View {
        SettingsGroup(header: AppLocale.string("Légal")) {
            Link(destination: AppURLs.terms) {
                SettingsRow(
                    systemImage: "doc.text",
                    title: AppLocale.string("Conditions générales"),
                    isExternal: true
                )
            }
            .tint(.primary)
            FormRowDivider()
            Link(destination: AppURLs.privacy) {
                SettingsRow(
                    systemImage: "checkmark.shield",
                    title: AppLocale.string("Avis de confidentialité"),
                    isExternal: true
                )
            }
            .tint(.primary)
        }
    }

    private var logoutButton: some View {
        Button { showLogoutConfirmation = true } label: {
            Text("Se déconnecter")
                .font(PulpeTypography.buttonSecondary)
                .foregroundStyle(Color.accentInk)
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
                .padding(.vertical, DesignTokens.Spacing.sm)
                .pulpeCardBackground(cornerRadius: DesignTokens.CornerRadius.card)
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.card)
                        .strokeBorder(Color.outlineVariant, lineWidth: DesignTokens.BorderWidth.thin)
                }
        }
        .contentShape(Rectangle())
        .plainPressedButtonStyle()
        .accessibilityIdentifier("logoutButton")
    }

    private var versionFooter: some View {
        VStack(spacing: DesignTokens.Spacing.sm) {
            Text("Pulpe \(AppConfiguration.appVersion) · iOS \(Self.iOSVersion)")
                .font(PulpeTypography.caption)
                .foregroundStyle(Color.textTertiary)
                .onLongPressGesture(minimumDuration: 5) {
                    debugToggleTrigger.toggle()
                    withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                        isDebugVisible.toggle()
                    }
                }

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

    /// « 0.59 » from « 0.59.0 ».
    private static var shortVersion: String {
        AppConfiguration.appVersion.split(separator: ".").prefix(2).joined(separator: ".")
    }

    private static let iOSVersion = UIDevice.current.systemVersion

    private func openWhatsNew() async {
        if let entry = await WhatsNewStore.latestEntry() {
            whatsNew = WhatsNewPresentation(entry: entry)
        } else {
            openURL(AppURLs.changelog)
        }
    }
}

#Preview {
    NavigationStack {
        AccountView()
    }
    .environment(AppState())
    .environment(UserSettingsStore())
    .environment(TagStore())
}
