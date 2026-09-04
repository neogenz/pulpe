import Foundation
@testable import Pulpe
import Testing

@MainActor
struct PlanBudgetsViewModelTests {
    @Test
    func defaultsToCurrentPayDayPeriodAndElevenFollowingMonths() throws {
        let date = try #require(Calendar.current.date(from: DateComponents(year: 2026, month: 9, day: 1)))
        let viewModel = PlanBudgetsViewModel(payDayOfMonth: 25, now: date)

        #expect(viewModel.start == BudgetPeriod(month: 9, year: 2026))
        #expect(viewModel.end == BudgetPeriod(month: 8, year: 2027))
        #expect(viewModel.inclusiveCount == 12)
        #expect(viewModel.showsPeriodCount)
    }

    @Test("invalid ranges are rejected", arguments: [
        (BudgetPeriod(month: 8, year: 2026), BudgetPeriod(month: 7, year: 2026)),
        (BudgetPeriod(month: 1, year: 2026), BudgetPeriod(month: 1, year: 2029)),
    ])
    func invalidRangesAreRejected(start: BudgetPeriod, end: BudgetPeriod) {
        let viewModel = PlanBudgetsViewModel(payDayOfMonth: nil)
        viewModel.start = start
        viewModel.end = end
        viewModel.selectedTemplateId = "template-1"

        #expect(viewModel.validationMessage != nil)
        #expect(!viewModel.showsPeriodCount)
        #expect(viewModel.generateRequest == nil)
        #expect(!viewModel.canGenerate)
    }

    @Test
    func loadingTemplatesSelectsTheDefaultTemplate() async {
        let regular = Self.template(id: "regular", isDefault: false)
        let defaultTemplate = Self.template(id: "default", isDefault: true)
        let viewModel = PlanBudgetsViewModel(
            payDayOfMonth: nil,
            loadTemplates: { [regular, defaultTemplate] }
        )

        await viewModel.loadTemplates()

        #expect(viewModel.templates.map(\.id) == ["regular", "default"])
        #expect(viewModel.selectedTemplateId == "default")
    }

    @Test
    func validRangeBuildsExactGeneratePayload() {
        let viewModel = PlanBudgetsViewModel(payDayOfMonth: nil)
        viewModel.start = BudgetPeriod(month: 11, year: 2026)
        viewModel.end = BudgetPeriod(month: 2, year: 2027)
        viewModel.selectedTemplateId = "template-1"

        let request = viewModel.generateRequest
        #expect(request?.templateId == "template-1")
        #expect(request?.startMonth == 11)
        #expect(request?.startYear == 2026)
        #expect(request?.count == 4)
    }

    @Test("generation stays pending for the whole request", arguments: [false, true])
    func generationPendingLifecycle(shouldFail: Bool) async {
        let (started, startedContinuation) = AsyncStream<Void>.makeStream()
        let (results, resultContinuation) = AsyncThrowingStream<BudgetGenerateResponse, Error>.makeStream()
        let viewModel = PlanBudgetsViewModel(
            payDayOfMonth: nil,
            generate: { _ in
                startedContinuation.yield()
                for try await response in results {
                    return response
                }
                throw TestError.expected
            }
        )
        viewModel.selectedTemplateId = "template-1"

        let generation = Task { await viewModel.generate() }
        for await _ in started { break }
        #expect(viewModel.isGenerating)
        #expect(!viewModel.canGenerate)

        if shouldFail {
            resultContinuation.finish(throwing: TestError.expected)
        } else {
            resultContinuation.yield(BudgetGenerateResponse(budgets: [], skippedMonths: []))
            resultContinuation.finish()
        }
        let response = await generation.value

        #expect(!viewModel.isGenerating)
        #expect((response == nil) == shouldFail)
        #expect((viewModel.error != nil) == shouldFail)
    }

    private static func template(id: String, isDefault: Bool) -> BudgetTemplate {
        BudgetTemplate(
            id: id,
            name: id,
            description: nil,
            userId: "user-1",
            isDefault: isDefault,
            createdAt: TestDataFactory.fixedDate,
            updatedAt: TestDataFactory.fixedDate
        )
    }

    private enum TestError: Error {
        case expected
    }
}
