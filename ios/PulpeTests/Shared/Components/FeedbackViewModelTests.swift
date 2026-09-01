@testable import Pulpe
import Testing

@Suite("Feedback view model")
@MainActor
struct FeedbackViewModelTests {
    @Test
    func overallRatingAlone_enablesSubmission_andBuildsMinimalPayload() async throws {
        let recorder = FeedbackSubmissionRecorder()
        let viewModel = makeViewModel(recorder: recorder)

        #expect(!viewModel.canSubmit)
        viewModel.overallRating = .good
        #expect(viewModel.canSubmit)

        #expect(await viewModel.submit())
        let submissions = await recorder.submissions
        let submission = try #require(submissions.first)
        #expect(submissions.count == 1)
        #expect(submission == FeedbackSubmission(
            overallRating: .good,
            appVersion: "1.4.3",
            iosVersion: "26.0"
        ))
        #expect(viewModel.isSubmitted)
    }

    @Test
    func details_areIncludedWithoutMakingEveryAreaRequired() async throws {
        let recorder = FeedbackSubmissionRecorder()
        let viewModel = makeViewModel(recorder: recorder)
        viewModel.overallRating = .veryGood
        viewModel.ratings[.budgetClarity] = .good
        viewModel.ratings[.futurePlanning] = .okay
        viewModel.updateComment("Une vue annuelle serait utile")

        #expect(await viewModel.submit())

        let submission = try #require(await recorder.submissions.first)
        #expect(submission.overallRating == .veryGood)
        #expect(submission.budgetClarity == .good)
        #expect(submission.futurePlanning == .okay)
        #expect(submission.onboarding == nil)
        #expect(submission.comment == "Une vue annuelle serait utile")
    }

    @Test
    func failedSubmission_preservesEveryValue_thenRetrySucceedsOnce() async throws {
        let recorder = FeedbackSubmissionRecorder(failuresRemaining: 1)
        let viewModel = makeViewModel(recorder: recorder)
        viewModel.overallRating = .okay
        viewModel.ratings[.onboarding] = .difficult
        viewModel.ratings[.homeClarity] = .veryGood
        viewModel.updateComment("Garde ma saisie")

        #expect(!(await viewModel.submit()))
        #expect(viewModel.errorMessage != nil)
        #expect(viewModel.overallRating == .okay)
        #expect(viewModel.ratings[.onboarding] == .difficult)
        #expect(viewModel.ratings[.homeClarity] == .veryGood)
        #expect(viewModel.comment == "Garde ma saisie")
        #expect(!viewModel.isSubmitted)

        #expect(await viewModel.submit())
        #expect(viewModel.errorMessage == nil)
        #expect(viewModel.isSubmitted)
        let attempts = await recorder.attempts
        let submissions = await recorder.submissions
        #expect(attempts == 2)
        #expect(submissions.count == 1)
        #expect(submissions.first?.comment == "Garde ma saisie")
    }

    @Test
    func comment_isCappedAtTheBackendLimit() {
        let viewModel = makeViewModel(recorder: FeedbackSubmissionRecorder())

        viewModel.updateComment(String(repeating: "a", count: 1_005))

        #expect(viewModel.comment.count == 1_000)
    }

    private func makeViewModel(recorder: FeedbackSubmissionRecorder) -> FeedbackViewModel {
        FeedbackViewModel(
            dependencies: FeedbackDependencies { submission in
                try await recorder.submit(submission)
            },
            appVersion: "1.4.3",
            iosVersion: "26.0"
        )
    }
}

private actor FeedbackSubmissionRecorder {
    private(set) var submissions: [FeedbackSubmission] = []
    private(set) var attempts = 0
    private var failuresRemaining: Int

    init(failuresRemaining: Int = 0) {
        self.failuresRemaining = failuresRemaining
    }

    func submit(_ submission: FeedbackSubmission) throws {
        attempts += 1
        if failuresRemaining > 0 {
            failuresRemaining -= 1
            throw FeedbackTestError.unavailable
        }
        submissions.append(submission)
    }
}

private enum FeedbackTestError: Error {
    case unavailable
}
