import OSLog

@MainActor
final class BiometricAutomaticEnrollmentPolicy {
    enum SkipReason: String, Equatable {
        case alreadyAttempted = "already_attempted"
        case inFlight = "in_flight"
        case capabilityUnavailable = "capability_unavailable"
        case alreadyEnabled = "already_enabled"
        case modalActive = "modal_active"
        case sourceNotEligible = "source_not_eligible"
        case notAuthenticated = "not_authenticated"
        case userExplicitlyDisabled = "user_explicitly_disabled"
    }

    enum Outcome: String, Equatable {
        case success = "success"
        case deniedOrFailed = "denied_or_failed"
    }

    enum PolicyDecision: Equatable {
        case proceed
        case skip(SkipReason)
    }

    private(set) var inFlight = false
    private(set) var lastDecision: PolicyDecision?
    private var attemptedThisTransition = false
    private(set) var userExplicitlyDisabled = false

    func resetForNewTransition() {
        attemptedThisTransition = false
        policyDebug("RESET", context: "new_transition")
    }

    /// Mark that the user explicitly opted out of biometric. Prevents auto-enrollment
    /// until the user manually re-enables biometric in settings.
    func markUserExplicitlyDisabled() {
        userExplicitlyDisabled = true
        policyDebug("EXPLICIT_DISABLE", context: "user_action")
    }

    /// Clear the explicit opt-out flag (called when user manually re-enables biometric).
    func clearUserExplicitlyDisabled() {
        userExplicitlyDisabled = false
        policyDebug("EXPLICIT_DISABLE_CLEARED", context: "user_action")
    }

    // swiftlint:disable:next function_parameter_count
    func shouldAttempt(
        biometricEnabled: Bool,
        biometricCapable: Bool,
        isAuthenticated: Bool,
        sourceEligible: Bool,
        hasActiveModal: Bool,
        context: String
    ) -> PolicyDecision {
        let decision: PolicyDecision
        if !isAuthenticated {
            decision = .skip(.notAuthenticated)
        } else if !sourceEligible {
            decision = .skip(.sourceNotEligible)
        } else if attemptedThisTransition {
            decision = .skip(.alreadyAttempted)
        } else if inFlight {
            // Reachable when a new transition calls resetForNewTransition() (clears attemptedThisTransition)
            // while a previous enrollment is still awaiting biometric.enable().
            decision = .skip(.inFlight)
        } else if !biometricCapable {
            decision = .skip(.capabilityUnavailable)
        } else if biometricEnabled {
            decision = .skip(.alreadyEnabled)
        } else if userExplicitlyDisabled {
            decision = .skip(.userExplicitlyDisabled)
        } else if hasActiveModal {
            decision = .skip(.modalActive)
        } else {
            decision = .proceed
        }

        lastDecision = decision

        if case .skip(let reason) = decision {
            policyDebug("SKIP", context: context, reason: reason.rawValue)
        }

        return decision
    }

    func markInFlight(context: String) {
        attemptedThisTransition = true
        inFlight = true
        policyDebug("START", context: context)
    }

    func markComplete(context: String, outcome: Outcome) {
        inFlight = false
        policyDebug("END", context: context, outcome: outcome.rawValue)
    }

    private func policyDebug(_ action: String, context: String, reason: String? = nil, outcome: String? = nil) {
        #if DEBUG
        var message = "[AUTH_BIO_POLICY] action=\(action) context=\(context)"
        if let reason { message += " reason=\(reason)" }
        if let outcome { message += " outcome=\(outcome)" }
        message += " inFlight=\(inFlight)"
        Logger.auth.debug("\(message, privacy: .public)")
        #endif
    }
}
