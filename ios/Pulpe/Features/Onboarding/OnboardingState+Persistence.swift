import Foundation
import OSLog

// MARK: - Persistence

extension OnboardingState {
    func saveToStorage() {
        let storedTx = customTransactions.map {
            OnboardingStorageData.StoredTransaction(
                id: $0.id,
                amount: $0.amount,
                type: $0.type.rawValue,
                name: $0.name,
                description: $0.description,
                expenseType: $0.expenseType.rawValue,
                isRecurring: $0.isRecurring
            )
        }
        let data = OnboardingStorageData(
            firstName: firstName,
            currency: currency,
            currentStep: currentStep.rawValue,
            customTransactions: storedTx.isEmpty ? nil : storedTx,
            monthlyIncome: monthlyIncome,
            housingCosts: housingCosts,
            healthInsurance: healthInsurance,
            phonePlan: phonePlan,
            transportCosts: transportCosts,
            leasingCredit: leasingCredit,
            isEmailRegistered: !isSocialAuth && isAuthenticated ? true : nil,
            hasCompletedPinSetup: hasCompletedPinSetup ? true : nil
        )

        do {
            let encoded = try JSONEncoder().encode(data)
            UserDefaults.standard.set(encoded, forKey: Self.storageKey)
        } catch {
            Logger.app.error("Onboarding draft save failed: \(error.localizedDescription, privacy: .public)")
        }
    }

    func loadFromStorage() {
        guard let data = UserDefaults.standard.data(forKey: Self.storageKey),
              let decoded = try? JSONDecoder().decode(OnboardingStorageData.self, from: data) else {
            return
        }

        firstName = decoded.firstName
        currency = decoded.currency ?? .chf

        if let step = OnboardingStep(rawValue: decoded.currentStep) {
            currentStep = step
        }

        monthlyIncome = decoded.monthlyIncome
        housingCosts = decoded.housingCosts
        healthInsurance = decoded.healthInsurance
        phonePlan = decoded.phonePlan
        transportCosts = decoded.transportCosts
        leasingCredit = decoded.leasingCredit
        wasEmailRegistered = decoded.isEmailRegistered ?? false
        hasCompletedPinSetup = decoded.hasCompletedPinSetup ?? false

        if let storedTx = decoded.customTransactions {
            customTransactions = storedTx.compactMap { stored in
                guard let type = TransactionKind(rawValue: stored.type),
                      let expenseType = TransactionRecurrence(rawValue: stored.expenseType) else {
                    return nil
                }
                // `id` is optional in `StoredTransaction` so legacy drafts saved before
                // the persistence-id fix still decode — they just get a fresh UUID once
                // and then stick with it on subsequent saves.
                return OnboardingTransaction(
                    id: stored.id ?? UUID(),
                    amount: stored.amount,
                    type: type,
                    name: stored.name,
                    description: stored.description,
                    expenseType: expenseType,
                    isRecurring: stored.isRecurring
                )
            }
        }
    }

    func clearStorage() {
        UserDefaults.standard.removeObject(forKey: Self.storageKey)
    }

    static func clearPersistedData() {
        UserDefaults.standard.removeObject(forKey: storageKey)
    }

    /// Reset every field that could carry over from a prior onboarding session.
    /// Called from `configureSocialUser` exclusively — the email recovery path
    /// relies on the persisted draft and must NOT reset.
    func resetDraftFields() {
        firstName = ""
        currency = .chf
        currentStep = .welcome
        monthlyIncome = nil
        housingCosts = nil
        healthInsurance = nil
        phonePlan = nil
        transportCosts = nil
        leasingCredit = nil
        customTransactions = []
        wasEmailRegistered = false
        hasCompletedPinSetup = false
        // Below: not persisted, but leaks across same-instance auth-path pivots.
        email = ""
        hasEmittedWelcomeViewed = false
        hasEmittedSignupStarted = false
        hasEmittedBudgetPreviewCompleted = false
        markFirstNamePersistFailed(false)
    }
}

// MARK: - Storage Data

// Draft onboarding values live in `UserDefaults.standard` as plaintext JSON.
// No `EncryptionService` wrap: the user has no PIN yet, so no DEK exists to derive a key from.
// The data window is bounded — cleared on completion, abandon, and session reset.
// Keys affected: `monthlyIncome`, `housingCosts`, `healthInsurance`, `phonePlan`,
// `transportCosts`, `leasingCredit`, and per-transaction `amount`.
// Threat model: physical device access + jailbreak can read self-reported draft estimates.
// If this window needs hardening later, migrate the blob to Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
//
// Adding a persisted field here requires updating 4 sites (no compiler
// enforcement): the `OnboardingStorageData` struct below, `saveToStorage()`,
// `loadFromStorage()`, and `resetDraftFields()`. The PUL-196 regression test
// (`configureSocialUser_wipesDraftLoadedFromStorage`) is the load-bearing
// guard — assert every new persisted field there.
private struct OnboardingStorageData: Codable {
    let firstName: String
    let currency: SupportedCurrency?
    let currentStep: String
    let customTransactions: [StoredTransaction]?
    let monthlyIncome: Decimal?
    let housingCosts: Decimal?
    let healthInsurance: Decimal?
    let phonePlan: Decimal?
    let transportCosts: Decimal?
    let leasingCredit: Decimal?
    let isEmailRegistered: Bool?
    // Optional for backwards compat with drafts saved before the mid-flow PIN step.
    let hasCompletedPinSetup: Bool?

    struct StoredTransaction: Codable {
        // Optional for backwards compat with drafts saved by versions that didn't
        // persist the id. `loadFromStorage` falls back to a fresh UUID in that case.
        let id: UUID?
        let amount: Decimal
        let type: String
        let name: String
        let description: String?
        let expenseType: String
        let isRecurring: Bool
    }
}

// MARK: - First name

extension OnboardingState {
    /// Applies a social signup and advances. Persist failures stay on `error` so the next
    /// step can show the existing banner — Welcome is already left after auth.
    func applySocialSignup(_ user: UserInfo, persistError: Error? = nil) {
        configureSocialUser(user)
        if let persistError {
            error = APIError.serverError(message: AuthErrorLocalizer.localize(persistError))
            markFirstNamePersistFailed(true)
        }
        nextStep()
    }

    /// Writes the in-memory first name to `user_metadata.firstName` when one exists.
    /// Skips the network when Auth already has the same name, unless a write failed
    /// earlier this session (last-chance retry).
    func persistFirstName(
        using persist: (String) async throws -> UserInfo
    ) async throws {
        guard let name = FirstNameResolver.normalized(firstName) else { return }
        if FirstNameResolver.normalized(authenticatedUser?.firstName) == name,
           !firstNamePersistFailedThisSession {
            return
        }
        do {
            let updated = try await persist(name)
            let merged = FirstNameResolver.coalescing(updated, fallbackFirstName: name)
            authenticatedUser = merged
            firstName = FirstNameResolver.normalized(merged.firstName) ?? name
            markFirstNamePersistFailed(false)
        } catch {
            markFirstNamePersistFailed(true)
            throw error
        }
    }
}

// MARK: - Step completion analytics

extension OnboardingState {
    /// Fire `onboarding_step_completed` with `step_index` (1-based), `step_count`,
    /// and `auth_method` so PostHog funnels survive step reordering.
    func captureStepCompleted(_ step: OnboardingStep) {
        let bar = progressBarSteps
        let index = (bar.firstIndex(of: step).map { $0 + 1 }) ?? 0
        var properties: [String: Any] = [
            "step": step.analyticsName,
            "step_index": index,
            // Not `step_total`: `sanitizeProperties` drops any key carrying `total`.
            "step_count": bar.count,
            "auth_method": authMethodProperty
        ]
        if isStepSkipped(step) {
            properties["skipped"] = true
        }
        AnalyticsService.shared.capture(.onboardingStepCompleted, properties: properties)
    }

    /// « Passer » is « Continuer » with nothing filled: skipped = optional step, no amount.
    func isStepSkipped(_ step: OnboardingStep) -> Bool {
        guard step.isOptional else { return false }
        switch step {
        case .charges: return totalCharges == 0
        case .savings: return totalSavings == 0
        default: return false
        }
    }
}
