import OSLog

// MARK: - Flow State Integration

extension AppState {
    /// Derives the high-level flow state from current AppState properties.
    /// This provides a bridge between the legacy AuthStatus and the new AppFlowState model.
    var flowState: AppFlowState {
        // Check transitional states first
        if isInMaintenance {
            return .maintenance
        }

        if isNetworkUnavailable {
            return .networkUnavailable(retryable: true)
        }

        // Map AuthStatus to AppFlowState
        switch authState {
        case .loading:
            return .initializing

        case .unauthenticated:
            return .unauthenticated

        case .needsPinSetup:
            // Check if we're in recovery key flow
            switch recoveryFlowState {
            case .consentPrompt:
                return .securitySetup(.recoveryKeyConsent)
            case .presentingKey(let key):
                return .securitySetup(.recoveryKeyPresentation(key: key))
            case .idle, .generatingKey:
                return .securitySetup(.pinSetup)
            }

        case .needsPinEntry:
            // Keep PIN entry route even when recovery overlays are visible.
            // The consent alert/sheet are layered modifiers and should not remap
            // a returning user to the PIN setup route.
            return .locked(lastLockReason)

        case .needsPinRecovery:
            return .recovering

        case .authenticated:
            // Check if recovery key flow is active even after authenticated
            if isRecoveryConsentVisible {
                return .securitySetup(.recoveryKeyConsent)
            }
            if isRecoveryKeySheetVisible, let key = recoveryKeyForPresentation {
                return .securitySetup(.recoveryKeyPresentation(key: key))
            }
            return .authenticated
        }
    }

    /// Derives the navigation route from current state.
    var currentRoute: AppRoute {
        AppRoute.from(flowState: flowState, biometricEnabled: biometricEnabled)
    }

    // MARK: - Event Dispatch (Future API)

    /// Sends an event to the state machine.
    /// This is the unified API for state transitions.
    ///
    /// Events are processed in three tiers:
    /// 1. Immediate events (synchronous, no side effects beyond state mutation)
    /// 2. Reducer events (pure state transitions via AppFlowReducer)
    /// 3. Async events (serialized via eventQueue to prevent race conditions)
    func send(event: AppFlowEvent) {
        authDebug("AUTH_FLOW_SEND", "event=\(event) currentAuth=\(authState) currentFlow=\(flowState)")
        // Bridge implementation: map events to existing methods
        // This allows gradual migration without breaking existing code
        if handleImmediateEvent(event) {
            authDebug("AUTH_FLOW_SEND", "handled=immediate event=\(event)")
            return
        }
        if applyReducerTransitionIfPossible(event) {
            authDebug("AUTH_FLOW_SEND", "handled=reducer event=\(event)")
            return
        }
        authDebug("AUTH_FLOW_SEND", "handled=async_queue event=\(event)")
        // Enqueue async events to ensure FIFO processing and prevent races
        eventQueue.enqueue(event)
    }

    /// Backward-compatible shorthand.
    func send(_ event: AppFlowEvent) {
        send(event: event)
    }

    private func applyReducerTransitionIfPossible(_ event: AppFlowEvent) -> Bool {
        // Reducer-driven events with no additional side-effects.
        switch event {
        case .maintenanceChecked,
             .networkBecameUnavailable,
             .startupTimedOut,
             .foregroundLockRequired,
             .foregroundNoLockNeeded,
             .biometricUnlockFailed:
            guard let nextState = AppFlowReducer.reduce(state: flowState, event: event) else {
                return false
            }
            authDebug("AUTH_FLOW_REDUCER", "event=\(event) before=\(flowState) after=\(nextState)")
            applyFlowState(nextState)
            return true
        default:
            return false
        }
    }

    private func applyFlowState(_ state: AppFlowState) {
        let oldAuth = authState
        switch state {
        case .initializing:
            isInMaintenance = false
            isNetworkUnavailable = false
            authState = .loading
        case .maintenance:
            isInMaintenance = true
            isNetworkUnavailable = false
            authState = .loading
        case .networkUnavailable:
            isInMaintenance = false
            isNetworkUnavailable = true
            authState = .loading
        case .unauthenticated:
            authState = .unauthenticated
            currentUser = nil
        case .securitySetup(.pinSetup):
            authState = .needsPinSetup
        case .securitySetup:
            // Recovery setup phases are represented by RecoveryFlowCoordinator overlays.
            break
        case .locked:
            authState = .needsPinEntry
        case .recovering:
            authState = .needsPinRecovery
        case .authenticated:
            authState = .authenticated
        }
        authDebug("AUTH_FLOW_APPLY", "flowState=\(state) authState: \(oldAuth) → \(authState)")
    }

    private func handleImmediateEvent(_ event: AppFlowEvent) -> Bool {
        switch event {
        case .recoveryInitiated:
            startRecovery()
            return true
        case .recoveryCancelled:
            cancelRecovery()
            return true
        default:
            return false
        }
    }

    func handleAsyncEvent(_ event: AppFlowEvent) async {
        authDebug("AUTH_FLOW_ASYNC", "begin event=\(event)")
        if await handleAuthLifecycleEvent(event) {
            authDebug("AUTH_FLOW_ASYNC", "handled=authLifecycle event=\(event)")
            return
        }
        if await handlePinEvent(event) {
            authDebug("AUTH_FLOW_ASYNC", "handled=pin event=\(event)")
            return
        }
        if await handleRecoveryEvent(event) {
            authDebug("AUTH_FLOW_ASYNC", "handled=recovery event=\(event)")
            return
        }
        authDebug("AUTH_FLOW_ASYNC", "handled=foregroundLifecycle event=\(event)")
        handleForegroundLifecycleEvent(event)
    }

    private func handleAuthLifecycleEvent(_ event: AppFlowEvent) async -> Bool {
        switch event {
        case .startupInitiated, .retryRequested:
            await checkAuthState()
            return true
        case .logoutRequested(let source):
            let mappedSource: LogoutSource = source == .userInitiated ? .userInitiated : .system
            await logout(source: mappedSource)
            return true
        case .sessionValidated(let result):
            await handleSessionValidated(result)
            return true
        case .sessionExpired:
            await handleSessionExpired()
            return true
        case .sessionRefreshFailed:
            await logout(source: .system)
            return true
        case .authenticationSucceeded(let user):
            await resolvePostAuth(user: user)
            return true
        case .logoutCompleted:
            resetSession(.systemLogout)
            return true
        default:
            return false
        }
    }

    private func handlePinEvent(_ event: AppFlowEvent) async -> Bool {
        switch event {
        case .pinEntrySucceeded, .biometricUnlockSucceeded:
            await completePinEntry()
            return true
        case .pinSetupCompleted:
            await completePinSetup()
            return true
        default:
            return false
        }
    }

    private func handleRecoveryEvent(_ event: AppFlowEvent) async -> Bool {
        switch event {
        case .recoveryCompleted:
            await completeRecovery()
            return true
        case .recoveryKeyConsentAccepted:
            await acceptRecoveryKeyRepairConsent()
            return true
        case .recoveryKeyConsentDeclined:
            await declineRecoveryKeyRepairConsent()
            return true
        case .recoveryKeyPresentationDismissed:
            await completePostAuthRecoveryKeyPresentation()
            return true
        case .recoverySessionExpired:
            await handleRecoverySessionExpired()
            return true
        case .recoveryKeyGenerated:
            // No-op bridge: key generation is owned by RecoveryFlowCoordinator.
            return true
        default:
            return false
        }
    }

    private func handleForegroundLifecycleEvent(_ event: AppFlowEvent) {
        if case .enteredBackground = event {
            handleEnterBackground()
        }
    }

    private func handleSessionValidated(_ result: AppFlowEvent.SessionValidationResult) async {
        switch result {
        case .authenticated(let user, let needsSetup, let needsRecoveryConsent):
            let destination: PostAuthDestination
            if needsSetup {
                destination = .needsPinSetup
            } else {
                destination = .needsPinEntry(needsRecoveryKeyConsent: needsRecoveryConsent)
            }
            await applyPostAuthDestination(destination, user: user)
        case .unauthenticated:
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        case .biometricSessionExpired:
            biometricError = "Ta session a expiré, connecte-toi avec ton mot de passe"
            await ensureReturningUserFlagLoaded()
            authState = .unauthenticated
        }
    }
}
