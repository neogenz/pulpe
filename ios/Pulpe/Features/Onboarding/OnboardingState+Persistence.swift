import Foundation
import OSLog

// MARK: - Persistence

extension OnboardingState {
    func saveToStorage() {
        let storedTx = customTransactions.map {
            OnboardingStorageData.StoredTransaction(
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
            currentStep: currentStep.rawValue,
            customTransactions: storedTx.isEmpty ? nil : storedTx,
            monthlyIncome: monthlyIncome,
            housingCosts: housingCosts,
            healthInsurance: healthInsurance,
            phonePlan: phonePlan,
            transportCosts: transportCosts,
            leasingCredit: leasingCredit,
            isEmailRegistered: !isSocialAuth && isAuthenticated ? true : nil
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

        if let storedTx = decoded.customTransactions {
            customTransactions = storedTx.compactMap { stored in
                guard let type = TransactionKind(rawValue: stored.type),
                      let expenseType = TransactionRecurrence(rawValue: stored.expenseType) else {
                    return nil
                }
                return OnboardingTransaction(
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
}

// MARK: - Storage Data

// Draft onboarding values live in `UserDefaults.standard` as plaintext JSON.
// No `EncryptionService` wrap: the user has no PIN yet, so no DEK exists to derive a key from.
// The data window is bounded — cleared on completion, abandon, and session reset.
// Keys affected: `monthlyIncome`, `housingCosts`, `healthInsurance`, `phonePlan`,
// `transportCosts`, `leasingCredit`, and per-transaction `amount`.
// Threat model: physical device access + jailbreak can read self-reported draft estimates.
// If this window needs hardening later, migrate the blob to Keychain (`kSecAttrAccessibleWhenUnlockedThisDeviceOnly`).
private struct OnboardingStorageData: Codable {
    let firstName: String
    let currentStep: String
    let customTransactions: [StoredTransaction]?
    let monthlyIncome: Decimal?
    let housingCosts: Decimal?
    let healthInsurance: Decimal?
    let phonePlan: Decimal?
    let transportCosts: Decimal?
    let leasingCredit: Decimal?
    let isEmailRegistered: Bool?

    struct StoredTransaction: Codable {
        let amount: Decimal
        let type: String
        let name: String
        let description: String?
        let expenseType: String
        let isRecurring: Bool
    }
}
