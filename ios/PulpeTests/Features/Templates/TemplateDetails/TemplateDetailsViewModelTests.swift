import Foundation
@testable import Pulpe
import Testing

/// The template page had the same blank-page bug as the budget page and no
/// smoke covers it: the ViewModel is driven here through `TemplateServicing`,
/// without the network or `TemplateService.shared`.
@Suite("Template details cold load", .serialized)
@MainActor
struct TemplateDetailsViewModelTests {
    struct StubTemplateService: TemplateServicing {
        var failure: Error?
        var usedBudgetCount = 0

        let template = BudgetTemplate(
            id: "tpl-1",
            name: "Mois type",
            description: nil,
            userId: nil,
            isDefault: true,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate
        )

        let lines = [
            Self.line(id: "l1", kind: .income, amount: 5000),
            Self.line(id: "l2", kind: .expense, amount: 1200)
        ]

        func getTemplate(id: String) async throws -> BudgetTemplate {
            if let failure { throw failure }
            return template
        }

        func getTemplateLines(templateId: String) async throws -> [TemplateLine] {
            if let failure { throw failure }
            return lines
        }

        func checkTemplateUsage(id: String) async throws -> TemplateUsageData {
            if let failure { throw failure }
            return TemplateUsageData(isUsed: usedBudgetCount > 0, budgetCount: usedBudgetCount, budgets: [])
        }

        func deleteTemplate(id: String) async throws {
            if let failure { throw failure }
        }

        private static func line(id: String, kind: TransactionKind, amount: Decimal) -> TemplateLine {
            TemplateLine(
                id: id,
                templateId: "tpl-1",
                name: id,
                amount: amount,
                kind: kind,
                recurrence: .fixed,
                description: "",
                createdAt: TestDataFactory.fixedDate,
                updatedAt: TestDataFactory.fixedDate
            )
        }
    }

    @Test func coldPage_startsLoading() {
        let viewModel = TemplateDetailsViewModel(templateId: "tpl-1", templateService: StubTemplateService())

        #expect(viewModel.content == .loading)
    }

    @Test func loadDetails_landsOnLoaded() async {
        let stub = StubTemplateService()
        let viewModel = TemplateDetailsViewModel(templateId: "tpl-1", templateService: stub)

        await viewModel.loadDetails()

        #expect(viewModel.content == .loaded(stub.template))
        #expect(viewModel.lines == stub.lines)
    }

    @Test func loadDetails_failingService_landsOnFailed() async {
        let stub = StubTemplateService(failure: APIError.invalidResponse)
        let viewModel = TemplateDetailsViewModel(templateId: "tpl-1", templateService: stub)

        await viewModel.loadDetails()

        #expect(viewModel.content == .failed(APIError.invalidResponse))
    }

    @Test func loadDetails_unusedTemplate_canBeDeleted() async {
        let viewModel = TemplateDetailsViewModel(templateId: "tpl-1", templateService: StubTemplateService())

        await viewModel.loadDetails()

        #expect(viewModel.usedBudgetCount == 0)
        #expect(viewModel.canDelete)
    }

    @Test func loadDetails_usedTemplate_cannotBeDeleted() async {
        let viewModel = TemplateDetailsViewModel(
            templateId: "tpl-1",
            templateService: StubTemplateService(usedBudgetCount: 9)
        )

        await viewModel.loadDetails()

        #expect(viewModel.usedBudgetCount == 9)
        #expect(!viewModel.canDelete)
    }

    @Test func coldPage_cannotBeDeletedBeforeUsageIsKnown() {
        let viewModel = TemplateDetailsViewModel(templateId: "tpl-1", templateService: StubTemplateService())

        #expect(!viewModel.canDelete)
    }
}
