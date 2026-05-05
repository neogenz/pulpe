import Foundation
@testable import Pulpe
import Testing

@MainActor
@Suite(.serialized)
struct OnboardingBootstrapperTests {
    // MARK: - Test Data
    private static let mockTemplate = BudgetTemplate(
        id: "template-1",
        name: "Test Template",
        description: nil,
        userId: "user-1",
        isDefault: true,
        createdAt: Date(),
        updatedAt: Date()
    )

    private static let mockBudget = Budget(
        id: "budget-1",
        month: 1,
        year: 2026,
        description: "Janvier 2026",
        userId: "user-1",
        templateId: "template-1",
        endingBalance: nil,
        rollover: nil,
        remaining: nil,
        previousBudgetId: nil,
        createdAt: Date(),
        updatedAt: Date()
    )

    // MARK: - SUT Factory

    private func makeSUT(
        createTemplate: (@MainActor (BudgetTemplateCreateFromOnboarding) async throws -> BudgetTemplate)? = nil,
        createBudget: (@MainActor (BudgetCreate) async throws -> Budget)? = nil,
        toastManager: ToastManager = ToastManager(),
        persistCurrency: (@MainActor (SupportedCurrency) async -> Bool)? = nil
    ) -> OnboardingBootstrapper {
        let sut = OnboardingBootstrapper(
            createTemplate: createTemplate ?? { _ in Self.mockTemplate },
            createBudget: createBudget ?? { _ in Self.mockBudget },
            toastManager: toastManager
        )
        sut.persistCurrency = persistCurrency
        return sut
    }

    // MARK: - bootstrapIfNeeded

    @Test("bootstrapIfNeeded with pending data creates template and budget")
    func bootstrapIfNeeded_withData_createsTemplateAndBudget() async {
        nonisolated(unsafe) var templateCreated = false
        nonisolated(unsafe) var budgetCreated = false

        let sut = makeSUT(
            createTemplate: { _ in
                templateCreated = true
                return Self.mockTemplate
            },
            createBudget: { _ in
                budgetCreated = true
                return Self.mockBudget
            }
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()

        #expect(templateCreated)
        #expect(budgetCreated)
    }

    @Test("bootstrapIfNeeded without pending data is a no-op")
    func bootstrapIfNeeded_withoutData_isNoOp() async {
        nonisolated(unsafe) var templateCreated = false

        let sut = makeSUT(
            createTemplate: { _ in
                templateCreated = true
                return Self.mockTemplate
            }
        )

        await sut.bootstrapIfNeeded()

        #expect(!templateCreated)
    }

    @Test("bootstrapIfNeeded consumes pending data on success")
    func bootstrapIfNeeded_consumesDataOnSuccess() async {
        let sut = makeSUT()
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()

        #expect(sut.pendingOnboardingData == nil)
    }

    @Test("bootstrapIfNeeded called twice — second call is no-op")
    func bootstrapIfNeeded_calledTwice_secondIsNoOp() async {
        nonisolated(unsafe) var callCount = 0

        let sut = makeSUT(
            createTemplate: { _ in
                callCount += 1
                return Self.mockTemplate
            }
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()
        await sut.bootstrapIfNeeded()

        #expect(callCount == 1)
    }

    @Test("bootstrapIfNeeded passes template ID to budget creation")
    func bootstrapIfNeeded_passesTemplateIdToBudget() async {
        nonisolated(unsafe) var capturedBudgetData: BudgetCreate?

        let sut = makeSUT(
            createBudget: { data in
                capturedBudgetData = data
                return Self.mockBudget
            }
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()

        #expect(capturedBudgetData?.templateId == Self.mockTemplate.id)
    }

    // MARK: - Error Handling

    @Test("bootstrapIfNeeded returns true on success")
    func bootstrapIfNeeded_returnsTrue_onSuccess() async {
        let sut = makeSUT()
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        let result = await sut.bootstrapIfNeeded()

        #expect(result == true)
    }

    @Test("bootstrapIfNeeded returns true when no pending data")
    func bootstrapIfNeeded_returnsTrue_whenNoPendingData() async {
        let sut = makeSUT()

        let result = await sut.bootstrapIfNeeded()

        #expect(result == true)
    }

    @Test("bootstrapIfNeeded returns false on error")
    func bootstrapIfNeeded_returnsFalse_onError() async {
        struct BootstrapError: Error {}
        let sut = makeSUT(
            createTemplate: { _ in throw BootstrapError() }
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        let result = await sut.bootstrapIfNeeded()

        #expect(result == false)
    }

    @Test("bootstrapIfNeeded retains pending data on failure for retry")
    func bootstrapIfNeeded_retainsPendingData_onFailure() async {
        struct BootstrapError: Error {}
        let sut = makeSUT(
            createTemplate: { _ in throw BootstrapError() }
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        _ = await sut.bootstrapIfNeeded()

        #expect(sut.pendingOnboardingData != nil, "Pending data must be retained for retry")
    }

    @Test("template creation error shows toast and does not create budget")
    func templateError_showsToast_noBudget() async {
        struct TemplateError: Error {}
        nonisolated(unsafe) var budgetCreated = false
        let toast = ToastManager()

        let sut = makeSUT(
            createTemplate: { _ in throw TemplateError() },
            createBudget: { _ in
                budgetCreated = true
                return Self.mockBudget
            },
            toastManager: toast
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()

        #expect(!budgetCreated)
        #expect(toast.currentToast != nil)
    }

    @Test("budget creation error shows toast")
    func budgetError_showsToast() async {
        struct BudgetError: Error {}
        let toast = ToastManager()

        let sut = makeSUT(
            createBudget: { _ in throw BudgetError() },
            toastManager: toast
        )
        sut.setPendingData(BudgetTemplateCreateFromOnboarding())

        await sut.bootstrapIfNeeded()

        #expect(toast.currentToast != nil)
    }

    // MARK: - setPendingData / clearPendingData

    @Test("setPendingData stores data and clearPendingData removes it")
    func setPendingData_andClearPendingData() {
        let sut = makeSUT()

        #expect(sut.pendingOnboardingData == nil)

        let data = BudgetTemplateCreateFromOnboarding()
        sut.setPendingData(data)
        #expect(sut.pendingOnboardingData != nil)

        sut.clearPendingData()
        #expect(sut.pendingOnboardingData == nil)
    }

    // MARK: - Currency Persistence (PUL-118)

    @Test("bootstrapIfNeeded with pending currency calls persistCurrency")
    func bootstrapIfNeeded_withPendingCurrency_callsPersistCurrency() async {
        nonisolated(unsafe) var capturedCurrency: SupportedCurrency?

        let sut = makeSUT(
            persistCurrency: { currency in
                capturedCurrency = currency
                return true
            }
        )
        sut.setPendingData(
            BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )

        await sut.bootstrapIfNeeded()

        #expect(capturedCurrency == .eur)
    }

    @Test("bootstrapIfNeeded when persistCurrency fails still returns true")
    func bootstrapIfNeeded_whenPersistCurrencyFails_stillReturnsTrue() async {
        let sut = makeSUT(
            persistCurrency: { _ in false }
        )
        sut.setPendingData(
            BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )

        let result = await sut.bootstrapIfNeeded()

        #expect(result == true)
        #expect(sut.pendingOnboardingData == nil, "Pending data must be cleared on success path")
        #expect(sut.pendingCurrency == nil, "Pending currency must be cleared on success path")
    }

    @Test("bootstrapIfNeeded when persistCurrency fails shows toast")
    func bootstrapIfNeeded_whenPersistCurrencyFails_showsToast() async {
        let toast = ToastManager()
        let sut = makeSUT(
            toastManager: toast,
            persistCurrency: { _ in false }
        )
        sut.setPendingData(
            BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )

        await sut.bootstrapIfNeeded()

        #expect(toast.currentToast != nil, "User must see an error toast on currency failure")
    }

    @Test("bootstrapIfNeeded without pending currency does not call persistCurrency")
    func bootstrapIfNeeded_withoutPendingCurrency_doesNotCallPersistCurrency() async {
        nonisolated(unsafe) var persistCallCount = 0

        let sut = makeSUT(
            persistCurrency: { _ in
                persistCallCount += 1
                return true
            }
        )
        // setPendingData WITHOUT currency — pendingCurrency stays nil
        sut.setPendingData(BudgetTemplateCreateFromOnboarding(), signupMethod: "email")

        await sut.bootstrapIfNeeded()

        #expect(persistCallCount == 0)
    }

    @Test("setPendingData with currency stores pendingCurrency; clearPendingData clears it")
    func setPendingData_withCurrency_storesAndClears() {
        let sut = makeSUT()

        #expect(sut.pendingCurrency == nil)

        sut.setPendingData(
            BudgetTemplateCreateFromOnboarding(),
            signupMethod: "email",
            currency: .eur
        )
        #expect(sut.pendingCurrency == .eur)

        sut.clearPendingData()
        #expect(sut.pendingCurrency == nil)
    }
}
