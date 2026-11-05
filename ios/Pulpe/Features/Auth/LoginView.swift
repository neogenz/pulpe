import Accessibility
import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = LoginViewModel()
    @State private var isAppeared = false
    @State private var forgotPasswordPresentation: ForgotPasswordPresentation?
    @FocusState private var focusedField: Field?
    @State private var submitSuccessTrigger = false

    var isPresented: Binding<Bool>?
    /// Email carried over from another screen; wins over the last used one.
    var initialEmail: String?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        NavigationStack {
            VStack(spacing: DesignTokens.Spacing.none) {
                zone
                    .background { EntryZoneBackground() }
                    .environment(\.colorScheme, .dark)

                ScrollViewReader { scrollProxy in
                    ScrollView {
                        VStack(spacing: DesignTokens.Spacing.xl) {
                            formSection
                            createAccountSection
                            termsFooter
                        }
                        .padding(.horizontal, DesignTokens.Spacing.xl)
                        .padding(.vertical, DesignTokens.Spacing.xl)
                    }
                    .scrollBounceBehavior(.basedOnSize)
                    .scrollDismissesKeyboard(.interactively)
                    // The card's fill runs under the home indicator and the side insets (the open
                    // iPhone Duo's status column); a clip on the view would stop it at the safe area
                    // and leave a forest strip with the zone's hard bottom edge showing.
                    .background {
                        UnevenRoundedRectangle(
                            topLeadingRadius: DesignTokens.Entry.cardRadius,
                            topTrailingRadius: DesignTokens.Entry.cardRadius
                        )
                        .fill(Color.appBackground)
                        .ignoresSafeArea(edges: [.bottom, .horizontal])
                    }
                    .padding(.top, -DesignTokens.Entry.cardRadius)
                    .onChange(of: viewModel.errorMessage) { _, newValue in
                        guard newValue != nil else { return }
                        withAnimation {
                            scrollProxy.scrollTo("loginError", anchor: .center)
                        }
                    }
                }
            }
            .background(Color.heroSurface.ignoresSafeArea())
            .toolbar(.hidden, for: .navigationBar)
            .trackScreen("Login")
            .sensoryFeedback(.success, trigger: submitSuccessTrigger)
            .keyboardFieldNavigation(focus: $focusedField, order: [.email, .password])
            .dismissKeyboardOnTap()
            .sheet(item: $forgotPasswordPresentation) { _ in
                ForgotPasswordSheet(initialEmail: viewModel.email) {
                    forgotPasswordPresentation = nil
                }
            }
            .task {
                await viewModel.loadLastUsedEmail()
                if let initialEmail, !initialEmail.isEmpty { viewModel.email = initialEmail }
                if !reduceMotion {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                withAnimation(DesignTokens.Animation.entranceSpring) {
                    isAppeared = true
                }
            }
        }
    }
}

// MARK: - Computed Properties

extension LoginView {
    /// Forest zone: back disc when presented over the welcome, the leaf, the title and what the screen is for.
    private var zone: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.md) {
            if let isPresented {
                Button {
                    isPresented.wrappedValue = false
                } label: {
                    Image(systemName: "chevron.left")
                        .font(PulpeTypography.labelLarge)
                        .foregroundStyle(Color.heroInk)
                        .frame(width: DesignTokens.TapTarget.minimum, height: DesignTokens.TapTarget.minimum)
                        .background(Color.heroTile, in: Circle())
                }
                .plainPressedButtonStyle()
                .accessibilityLabel("Retour")
            }
            PulpeIcon(size: DesignTokens.IconSize.heroBadge)
                .accessibilityHidden(true)
            VStack(alignment: .leading, spacing: DesignTokens.Spacing.xs) {
                Text("Content de te revoir")
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.heroInk)
                    .accessibilityAddTraits(.isHeader)
                Text("Connecte-toi pour retrouver ton budget.")
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.heroInkSecondary)
            }
        }
        .frame(maxWidth: .infinity, alignment: .leading)
        .padding(.horizontal, DesignTokens.Spacing.xl)
        .padding(.bottom, DesignTokens.Entry.cardRadius + DesignTokens.Spacing.lg)
        .opacity(isAppeared ? 1 : 0)
        .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring, value: isAppeared)
    }

    private var formSection: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            emailField
            passwordField
            forgotPasswordButton
            loginButton
            SocialLoginDivider()
            SocialLoginSection {
                appState.biometricError = nil
                isPresented?.wrappedValue = false
            }
        }
        .opacity(isAppeared ? 1 : 0)
        .offset(y: isAppeared ? 0 : 20)
        .animation(reduceMotion ? nil : DesignTokens.Animation.entranceSpring.delay(0.2), value: isAppeared)
    }

    private var loginError: String? { viewModel.errorMessage ?? appState.biometricError }

    private var emailField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("E-mail")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textPrimary)

            AuthTextField(
                prompt: AppLocale.string("Adresse e-mail"),
                text: $viewModel.email,
                isFilled: viewModel.isEmailValid,
                focusBinding: $focusedField,
                focusField: .email
            )
            .textContentType(.emailAddress)
            .keyboardType(.emailAddress)
            .textInputAutocapitalization(.never)
            .autocorrectionDisabled()
            .accessibilityIdentifier("email")
            .accessibilityLabel("Adresse e-mail")
            .accessibilityHint("Saisis ton adresse e-mail")
            .submitLabel(.next)
            .onSubmit { focusedField = .password }
        }
    }

    private var passwordField: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Text("Mot de passe")
                .font(PulpeTypography.inputLabel)
                .foregroundStyle(Color.textPrimary)

            AuthSecureField(
                prompt: AppLocale.string("Ton mot de passe"),
                text: $viewModel.password,
                isVisible: $viewModel.showPassword,
                hasError: loginError != nil,
                fieldAccessibilityIdentifier: "password",
                focusBinding: $focusedField,
                focusField: .password
            )
            .textContentType(.password)
            .accessibilityLabel("Mot de passe")
            .accessibilityHint(!viewModel.password.isEmpty && !viewModel.isPasswordValid
                ? "8 caractères minimum"
                : "Saisis ton mot de passe")
            .submitLabel(.go)
            .onSubmit {
                guard viewModel.canSubmit else { return }
                Task { await login() }
            }

            if let loginError {
                Label(loginError, systemImage: "exclamationmark.circle.fill")
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(Color.errorPrimary)
                    .fixedSize(horizontal: false, vertical: true)
                    .id("loginError")
            } else if !viewModel.password.isEmpty && !viewModel.isPasswordValid {
                Text("8 caractères minimum")
                    .font(PulpeTypography.inputHelper)
                    .foregroundStyle(Color.textTertiary)
                    .padding(.leading, DesignTokens.Spacing.lg)
                    .accessibilityHidden(true)
            }
        }
    }

    private var forgotPasswordButton: some View {
        HStack {
            Spacer()
            Button("Mot de passe oublié ?") {
                forgotPasswordPresentation = ForgotPasswordPresentation()
            }
            .font(PulpeTypography.labelMedium)
            .foregroundStyle(Color.pulpePrimary)
            .textLinkButtonStyle()
            .accessibilityIdentifier("forgotPasswordButton")
        }
    }

    private var loginButton: some View {
        Button {
            Task { await login() }
        } label: {
            if viewModel.isLoading {
                ProgressView()
                    .tint(.white)
                    .accessibilityLabel("Connexion en cours")
            } else {
                Text("Se connecter")
            }
        }
        .primaryButtonStyle(isEnabled: viewModel.canSubmit)
        .disabled(!viewModel.canSubmit)
        .animation(.easeInOut(duration: DesignTokens.Animation.fast), value: viewModel.canSubmit)
        .accessibilityIdentifier("loginButton")
        .padding(.top, DesignTokens.Spacing.sm)
    }

    private var termsFooter: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Link("CGU", destination: AppURLs.terms)
                .underline()
            Text("et")
            Link("Politique de confidentialité", destination: AppURLs.privacy)
                .underline()
        }
        .font(PulpeTypography.labelMedium)
        .foregroundStyle(Color.textSecondary)
        .frame(minHeight: DesignTokens.TapTarget.minimum)
    }

    private var createAccountSection: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            Text("Nouveau sur Pulpe ?")
                .font(PulpeTypography.subheadline)
                .foregroundStyle(Color.textSecondary)

            Button {
                if let isPresented {
                    isPresented.wrappedValue = false
                } else {
                    appState.enterSignupFlow()
                }
            } label: {
                Text("Créer un compte")
                    .font(PulpeTypography.subheadline.weight(.semibold))
                    .foregroundStyle(Color.pulpePrimary)
            }
            .textLinkButtonStyle()
        }
        .padding(.top, DesignTokens.Spacing.md)
        .opacity(isAppeared ? 1 : 0)
        .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.35), value: isAppeared)
    }

    private func login() async {
        focusedField = nil
        viewModel.isLoading = true
        viewModel.errorMessage = nil

        do {
            try await appState.login(email: viewModel.email, password: viewModel.password)
            AnalyticsService.shared.capture(.loginCompleted, properties: ["method": "email"])
            appState.biometricError = nil
            submitSuccessTrigger.toggle()
            isPresented?.wrappedValue = false
        } catch {
            AnalyticsService.shared.captureAuthError(.loginFailed, error: error, method: "email")
            let message = AuthErrorLocalizer.localize(error)
            viewModel.errorMessage = message
            viewModel.isLoading = false
            AccessibilityNotification.Announcement(message).post()
        }
    }
}

struct ForgotPasswordPresentation: Identifiable {
    let id = UUID()
}

// MARK: - ViewModel

@Observable @MainActor
final class LoginViewModel {
    var email = ""
    var password = ""
    var showPassword = false
    var isLoading = false
    var errorMessage: String?

    private let keychainManager: KeychainManager

    init(keychainManager: KeychainManager = .shared) {
        self.keychainManager = keychainManager
    }

    func loadLastUsedEmail() async {
        email = await keychainManager.getLastUsedEmail() ?? ""
    }

    var isEmailValid: Bool {
        email.isValidEmail
    }

    var isPasswordValid: Bool {
        password.count >= 8
    }

    var canSubmit: Bool {
        isEmailValid && isPasswordValid && !isLoading
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
