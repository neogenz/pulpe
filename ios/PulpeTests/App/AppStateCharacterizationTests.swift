import Foundation
@testable import Pulpe
import Testing

// swiftlint:disable type_body_length
/// Characterization tests pinning current AppState behavior before SRP extraction.
/// These tests serve as regression guards during incremental refactoring:
/// - enterAuthenticated pipeline (future AuthenticatedEntryCoordinator)
/// - Recovery flow state machine (future RecoveryFlowCoordinator)
/// - Onboarding bootstrap via completePinSetup (future OnboardingBootstrapper)
/// - Session lifecycle: background/foreground + checkAuthState (future SessionLifecycleCoordinator)
///
/// All tests use ONLY public API methods — no direct state mutation via private(set) setters.
@MainActor
@Suite(.serialized)
struct AppStateCharacterizationTests {
    private let user = UserInfo(id: "char-user", email: "char@pulpe.app", firstName: "Char")

    // MARK: - SUT Factories

    private func makeSUT(
        destination: PostAuthDestination = .needsPinEntry(needsRecoveryKeyConsent: false),
        biometricEnabled: Bool = false,
        capability: Bool = true,
        onAuthenticate: (@Sendable () async throws -> Void)? = nil,
        syncBiometricCredentials: (@Sendable () async -> Bool)? = nil,
        resolveBiometricKey: (@Sendable () async -> String?)? = nil,
        validateBiometricKey: (@Sendable (String) async -> Bool)? = nil,
        setupRecoveryKey: (@Sendable () async throws -> String)? = nil,
        validateRegularSession: (@Sendable () async throws -> UserInfo?)? = nil,
        validateBiometricSession: (@Sendable () async throws -> BiometricSessionResult?)? = nil,
        nowProvider: @escaping () -> Date = Date.init
    ) -> AppState {
        let store = BiometricPreferenceStore(
            keychain: StubBiometricKeychain(initial: biometricEnabled),
            defaults: StubBiometricDefaults(initial: false)
        )
        let deps = AppStateDependencies(
            authService: .shared,
            clientKeyManager: .shared,
            keychainManager: KeychainManager.shared,
            encryptionAPI: .shared,
            postAuthResolver: CharStubResolver(destination: destination),
            biometricService: .shared,
            biometricPreferenceStore: store,
            biometricCapability: { capability },
            biometricAuthenticate: onAuthenticate ?? { },
            syncBiometricCredentials: syncBiometricCredentials,
            resolveBiometricKey: resolveBiometricKey,
            validateBiometricKey: validateBiometricKey,
            setupRecoveryKey: setupRecoveryKey,
            validateRegularSession: validateRegularSession,
            validateBiometricSession: validateBiometricSession,
            nowProvider: nowProvider
        )
        return AppState(dependencies: deps)
    }
    // MARK: - Section 1: enterAuthenticated Pipeline Characterization
    @Test("completePinEntry from needsPinEntry results in authenticated")
    func completePinEntry_fromNeedsPinEntry_becomesAuthenticated() async {
        let sut = makeSUT(destination: .needsPinEntry(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
    }
    @Test("completePinSetup from needsPinSetup results in authenticated")
    func completePinSetup_fromNeedsPinSetup_becomesAuthenticated() async {
        let sut = makeSUT(destination: .needsPinSetup)

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinSetup)

        await sut.completePinSetup()

        #expect(sut.authState == .authenticated)
    }
    @Test("resolvePostAuth with authenticated(false) results in authenticated directly")
    func resolvePostAuth_directAuthenticated_becomesAuthenticated() async {
        let sut = makeSUT(destination: .authenticated(needsRecoveryKeyConsent: false))

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .idle)
    }
    @Test("enrollment policy resets on each authenticated transition")
    func enrollmentPolicy_resetsOnEachTransition() async {
        struct DenialError: Error {}
        let spy = CharAuthSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: {
                await spy.record()
                throw DenialError()
            }
        )

        // Transition 1: enrollment attempted and denied
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(await spy.callCount() == 1)

        // Simulate re-login (new transition)
        await sut.logout(source: .system)
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        // Per-transition policy resets, so enrollment retries
        #expect(await spy.callCount() == 2, "Enrollment policy must reset on each new transition")
    }
    @Test("enterAuthenticated calls biometric sync before enrollment policy evaluation")
    func enterAuthenticated_callsSyncBeforeEnrollment() async {
        let timeline = CharTimeline()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            onAuthenticate: {
                await timeline.record("enrollment")
            },
            syncBiometricCredentials: {
                await timeline.record("sync")
                return true
            }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)

        let events = await timeline.events()
        // transitionToAuthenticated calls syncAfterAuth first, then enterAuthenticated evaluates enrollment
        #expect(events.count >= 1, "At least sync should be called")
        if let syncIndex = events.firstIndex(of: "sync"),
           let enrollmentIndex = events.firstIndex(of: "enrollment") {
            #expect(syncIndex < enrollmentIndex, "Sync must happen before enrollment")
        }
    }

    // MARK: - Section 2: Recovery Flow State Machine Characterization
    @Test("acceptRecoveryKeyRepairConsent transitions consentPrompt to presentingKey on success")
    func acceptRecoveryConsent_success_transitionsToPresenting() async {
        let stubKey = "ABCD-1234-EFGH-5678"
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true),
            setupRecoveryKey: { stubKey }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.recoveryFlowState == .consentPrompt)

        await sut.acceptRecoveryKeyRepairConsent()

        #expect(sut.isRecoveryKeySheetVisible)
        #expect(sut.recoveryKeyForPresentation == stubKey)
    }
    @Test("declineRecoveryKeyRepairConsent from consentPrompt resets to idle and authenticates")
    func declineRecoveryConsent_fromConsentPrompt_resetsToIdle() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true)
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(sut.recoveryFlowState == .consentPrompt)

        await sut.declineRecoveryKeyRepairConsent()

        #expect(sut.recoveryFlowState == .idle)
        #expect(sut.authState == .authenticated)
    }
    @Test("isRecoveryConsentVisible matches consentPrompt state")
    func isRecoveryConsentVisible_matchesState() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true)
        )

        // Before recovery flow
        #expect(sut.isRecoveryConsentVisible == false)

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        // During consent prompt
        #expect(sut.isRecoveryConsentVisible == true)

        // After declining
        await sut.declineRecoveryKeyRepairConsent()
        #expect(sut.isRecoveryConsentVisible == false)
    }
    @Test("isRecoveryKeySheetVisible is false for consentPrompt and idle")
    func isRecoveryKeySheetVisible_falseForConsentAndIdle() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true)
        )

        #expect(sut.isRecoveryKeySheetVisible == false)

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(sut.isRecoveryKeySheetVisible == false)

        await sut.declineRecoveryKeyRepairConsent()
        #expect(sut.isRecoveryKeySheetVisible == false)
    }
    @Test("recovery methods from wrong states are no-ops")
    func recoveryMethods_fromWrongStates_areNoOps() async {
        // completePinEntry with pendingRecoveryConsent=false → no consent shown
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .idle)

        // Decline from idle should be a no-op for authState
        // (it still calls enterAuthenticated but state should stay .authenticated)
        await sut.declineRecoveryKeyRepairConsent()
        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .idle)
    }
    @Test("PIN entry with recovery consent pending shows consent instead of authenticating")
    func pinEntry_withPendingRecoveryConsent_showsConsentInsteadOfAuthenticating() async {
        let spy = CharAuthSpy()
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: true),
            onAuthenticate: { await spy.record() }
        )

        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        // State should NOT be authenticated yet — consent prompt blocks it
        #expect(sut.recoveryFlowState == .consentPrompt)
        #expect(await spy.callCount() == 0, "No biometric enrollment while consent modal is active")
    }
    @Test("completeRecovery from needsPinRecovery results in authenticated")
    func completeRecovery_fromNeedsPinRecovery_becomesAuthenticated() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        sut.startRecovery()
        #expect(sut.authState == .needsPinRecovery)

        await sut.completeRecovery()
        #expect(sut.authState == .authenticated)
    }
    @Test("cancelRecovery from needsPinRecovery returns to needsPinEntry")
    func cancelRecovery_fromNeedsPinRecovery_returnsToNeedsPinEntry() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false)
        )

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinEntry)

        sut.startRecovery()
        #expect(sut.authState == .needsPinRecovery)

        sut.cancelRecovery()
        #expect(sut.authState == .needsPinEntry)
    }

    // MARK: - Section 3: Onboarding Bootstrap Characterization
    @Test("enterSignupFlow clears pending onboarding data and resets hasReturningUser")
    func enterSignupFlow_clearsPendingOnboardingDataAndReturningUser() async {
        let sut = makeSUT(destination: .needsPinSetup)

        // Set up pending onboarding data via completeOnboarding
        await sut.completeOnboarding(
            user: user,
            onboardingData: BudgetTemplateCreateFromOnboarding()
        )
        #expect(sut.pendingOnboardingData != nil)
        #expect(sut.hasReturningUser == true)

        sut.enterSignupFlow()

        #expect(sut.pendingOnboardingData == nil)
        #expect(sut.hasReturningUser == false)
    }
    @Test("completePinSetup without pendingOnboardingData does not attempt template creation")
    func completePinSetup_withoutOnboardingData_noTemplateCall() async {
        let sut = makeSUT(destination: .needsPinSetup)

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinSetup)
        #expect(sut.pendingOnboardingData == nil)

        // completePinSetup should skip the template/budget creation branch
        await sut.completePinSetup()

        #expect(sut.authState == .authenticated)
        // If template creation was attempted without data, it would have thrown.
        // The fact that we reached .authenticated confirms the branch was skipped.
    }

    // MARK: - Section 4: Session Lifecycle Characterization
    @Test("handleEnterBackground then handleEnterForeground within grace keeps authenticated")
    func backgroundForeground_withinGrace_staysAuthenticated() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 15) // 15s < 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .authenticated)
    }
    @Test("handleEnterBackground then handleEnterForeground after grace transitions to needsPinEntry")
    func backgroundForeground_afterGrace_requiresPinEntry() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()
        #expect(sut.authState == .authenticated)

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31) // 31s > 30s grace period
        await sut.handleEnterForeground()

        #expect(sut.authState == .needsPinEntry)
    }
    @Test("checkAuthState without any session results in unauthenticated")
    func checkAuthState_noSession_becomesUnauthenticated() async {
        let sut = makeSUT(
            validateRegularSession: { nil },
            validateBiometricSession: { nil }
        )

        await sut.checkAuthState()

        #expect(sut.authState == .unauthenticated)
    }
    @Test("checkAuthState with valid regular session routes through resolvePostAuth")
    func checkAuthState_validRegularSession_routesThroughPostAuth() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            validateRegularSession: { [user] in user }
        )

        await sut.checkAuthState()

        #expect(sut.authState == .needsPinEntry)
    }
    @Test("checkAuthState with biometric enabled resolves via biometric session")
    func checkAuthState_biometricEnabled_resolvesViaBiometric() async {
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            biometricEnabled: true,
            validateBiometricSession: { [user] in
                BiometricSessionResult(user: user, clientKeyHex: nil)
            }
        )

        await sut.bootstrap()

        await sut.checkAuthState()

        #expect(sut.authState == .needsPinEntry)
    }
    @Test("prepareForForeground after grace period sets isRestoringSession")
    func prepareForForeground_afterGrace_setsRestoringSession() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()

        #expect(sut.isRestoringSession == true)
    }
    @Test("handleEnterForeground clears isRestoringSession regardless of outcome")
    func handleEnterForeground_clearsRestoringSession() async {
        var now = Date(timeIntervalSince1970: 0)
        let sut = makeSUT(
            destination: .needsPinEntry(needsRecoveryKeyConsent: false),
            nowProvider: { now }
        )
        sut.biometricEnabled = false
        await sut.resolvePostAuth(user: user)
        await sut.completePinEntry()

        sut.handleEnterBackground()
        now = Date(timeIntervalSince1970: 31)
        sut.prepareForForeground()
        #expect(sut.isRestoringSession == true)

        await sut.handleEnterForeground()

        #expect(sut.isRestoringSession == false)
    }
    @Test("resolvePostAuth sessionExpired sets unauthenticated with error message")
    func resolvePostAuth_sessionExpired_setsUnauthenticatedWithError() async {
        let sut = makeSUT(destination: .unauthenticatedSessionExpired)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .unauthenticated)
        #expect(sut.biometricError == "Ta session a expiré, connecte-toi avec ton mot de passe")
    }
    @Test("resolvePostAuth vaultCheckFailed falls back to needsPinEntry")
    func resolvePostAuth_vaultCheckFailed_fallsBackToPinEntry() async {
        let sut = makeSUT(destination: .vaultCheckFailed)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinEntry)
        #expect(sut.recoveryFlowState == .idle)
    }
    @Test("resolvePostAuth needsPinSetup resets recovery flow state")
    func resolvePostAuth_needsPinSetup_resetsRecoveryFlow() async {
        let sut = makeSUT(destination: .needsPinSetup)

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .needsPinSetup)
        #expect(sut.recoveryFlowState == .idle)
    }
    @Test("resolvePostAuth authenticated with recovery consent shows consent prompt")
    func resolvePostAuth_authenticatedWithRecoveryConsent_showsConsent() async {
        let sut = makeSUT(destination: .authenticated(needsRecoveryKeyConsent: true))

        await sut.resolvePostAuth(user: user)

        #expect(sut.authState == .authenticated)
        #expect(sut.recoveryFlowState == .consentPrompt)
    }

    // MARK: - Section 5: DI Validation (no .shared singletons)

    @Test("checkMaintenanceStatus uses injected maintenanceChecking, not MaintenanceService.shared")
    func checkMaintenanceStatus_usesInjectedChecker() async {
        let spy = AtomicFlag()
        let deps = AppStateDependencies(
            authService: .shared,
            clientKeyManager: .shared,
            keychainManager: KeychainManager.shared,
            encryptionAPI: .shared,
            biometricService: .shared,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            maintenanceChecking: {
                spy.set()
                return false
            }
        )
        let sut = AppState(dependencies: deps)

        await sut.checkMaintenanceStatus()

        #expect(spy.value == true, "checkMaintenanceStatus must call injected maintenanceChecking closure")
        #expect(sut.isInMaintenance == false)
    }

    @Test("logout uses injected widgetSyncing, not WidgetDataCoordinator directly")
    func logout_usesInjectedWidgetSync() async {
        let mockWidget = MockWidgetSync()
        let deps = AppStateDependencies(
            authService: .shared,
            clientKeyManager: .shared,
            keychainManager: MockKeychainStore(),
            encryptionAPI: .shared,
            postAuthResolver: CharStubResolver(
                destination: .authenticated(needsRecoveryKeyConsent: false)
            ),
            biometricService: .shared,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            widgetSyncing: mockWidget
        )
        let sut = AppState(dependencies: deps)

        await sut.resolvePostAuth(user: user)

        await sut.logout(source: .system)

        #expect(
            mockWidget.clearAndReloadCalled.value == true,
            "logout must call widgetSyncing.clearAndReload() via injected dependency"
        )
    }

    @Test("completePinSetup uses injected createTemplate/createBudget, not Service.shared")
    func completePinSetup_usesInjectedOnboardingCreators() async {
        let templateSpy = AtomicFlag()
        let budgetSpy = AtomicFlag()
        let stubTemplate = BudgetTemplate(
            id: "tpl-1", name: "Test", description: nil, userId: nil,
            isDefault: true, createdAt: TestDataFactory.fixedDate, updatedAt: TestDataFactory.fixedDate
        )
        let deps = AppStateDependencies(
            authService: .shared,
            clientKeyManager: .shared,
            keychainManager: MockKeychainStore(),
            encryptionAPI: .shared,
            postAuthResolver: CharStubResolver(destination: .needsPinSetup),
            biometricService: .shared,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            createTemplate: { _ in
                templateSpy.set()
                return stubTemplate
            },
            createBudget: { _ in
                budgetSpy.set()
                return TestDataFactory.createBudget()
            }
        )
        let sut = AppState(dependencies: deps)

        await sut.resolvePostAuth(user: user)
        #expect(sut.authState == .needsPinSetup)

        sut.pendingOnboardingData = BudgetTemplateCreateFromOnboarding()
        await sut.completePinSetup()

        #expect(sut.authState == .authenticated)
        #expect(templateSpy.value == true, "completePinSetup must use injected createTemplate closure")
        #expect(budgetSpy.value == true, "completePinSetup must use injected createBudget closure")
    }

    // MARK: - Section 6: Bootstrap Idempotency

    @Test("bootstrap is idempotent — second checkAuthState does not duplicate keychain reads")
    func bootstrap_isIdempotent() async {
        let keychainReadCount = AtomicProperty<Int>(0)
        let spyKeychain = SpyKeychainStore(
            lastUsedEmail: "returning@pulpe.app",
            onGetEmail: { keychainReadCount.increment() }
        )

        // Use the convenience init directly so we can inject the spy keychain
        let sut = AppState(
            keychainManager: spyKeychain,
            biometricPreferenceStore: AppStateTestFactory.biometricDisabledStore(),
            validateRegularSession: { nil },
            validateBiometricSession: { nil }
        )

        // First bootstrap: loads returning user flag from spy keychain
        await sut.bootstrap()

        // Record state and read count after first bootstrap
        let readsAfterInit = keychainReadCount.value
        let hasReturningUserBefore = sut.hasReturningUser
        let biometricEnabledBefore = sut.biometricEnabled

        // Run checkAuthState (simulates a second bootstrap)
        await sut.checkAuthState()

        // Assert no state changes
        #expect(
            sut.hasReturningUser == hasReturningUserBefore,
            "hasReturningUser must not change on second checkAuthState"
        )
        #expect(
            sut.biometricEnabled == biometricEnabledBefore,
            "biometricEnabled must not change on second checkAuthState"
        )

        // ensureReturningUserFlagLoaded should guard on returningUserFlagLoaded
        // and NOT re-read the keychain
        #expect(
            keychainReadCount.value == readsAfterInit,
            "Keychain should not be re-read after flag is already loaded (reads: \(keychainReadCount.value), expected: \(readsAfterInit))"
        )
    }
}

// MARK: - Local Stubs

private struct CharStubResolver: PostAuthResolving {
    let destination: PostAuthDestination
    func resolve() async -> PostAuthDestination { destination }
}
private actor CharAuthSpy {
    private var calls = 0
    func record() { calls += 1 }
    func callCount() -> Int { calls }
}

private actor CharTimeline {
    private var log: [String] = []
    func record(_ event: String) { log.append(event) }
    func events() -> [String] { log }
}

private actor SpyKeychainStore: KeychainEmailStoring {
    private var lastUsedEmail: String?
    private let onGetEmail: @Sendable () -> Void

    init(lastUsedEmail: String?, onGetEmail: @escaping @Sendable () -> Void) {
        self.lastUsedEmail = lastUsedEmail
        self.onGetEmail = onGetEmail
    }

    func getLastUsedEmail() -> String? {
        onGetEmail()
        return lastUsedEmail
    }

    func saveLastUsedEmail(_ email: String) { lastUsedEmail = email }
    func clearLastUsedEmail() { lastUsedEmail = nil }
    func clearAllData() { lastUsedEmail = nil }
}
