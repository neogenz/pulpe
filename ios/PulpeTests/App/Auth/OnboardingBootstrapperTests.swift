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
        toastManager: ToastManager = ToastManager()
    ) -> OnboardingBootstrapper {
        OnboardingBootstrapper(
            createTemplate: createTemplate ?? { _ in Self.mockTemplate },
            createBudget: createBudget ?? { _ in Self.mockBudget },
            toastManager: toastManager
        )
    }

    // MARK: - bootstrapIfNeeded

    @Test("bootstrapIfNeeded with pending data creates template and budget")
    func bootstrapIfNeeded_withData_createsTemplateAndBudget() async {
        var templateCreated = false
        var budgetCreated = false

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
        var templateCreated = false

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
        var callCount = 0

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
        var capturedBudgetData: BudgetCreate?

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
        var budgetCreated = false
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
}
