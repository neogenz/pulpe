import SwiftUI

// MARK: - Hero & contributions

/// Composition of the hero zone and the contributions card — extracted from the main
/// view file for length only, no logic of its own.
extension SavingsGoalDetailView {
    func hero(_ progress: SavingsGoalProgress) -> some View {
        GoalProgressHero(
            presentation: GoalHeroPresentation(
                progress: progress,
                status: currentGoal.status,
                currency: currency
            ),
            status: currentGoal.status
        )
    }

    @ViewBuilder
    func contributionsSection(_ progress: SavingsGoalProgress) -> some View {
        if progress.linkedLineCount > 0 {
            GoalContributionsSection(
                contributions: viewModel.contributions,
                currency: currency,
                isLoading: viewModel.isLoadingContributions,
                error: viewModel.contributionsError,
                onRetry: { Task { await viewModel.loadContributions() } }
            )
            .accessibilityIdentifier("savingsGoalContributionsSection")
        }
    }
}
