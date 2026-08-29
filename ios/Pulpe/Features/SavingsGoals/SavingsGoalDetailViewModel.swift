import Foundation
import SwiftUI

/// Drives `SavingsGoalDetailView`: fetches the derived progression and routes
/// status changes through `SavingsGoalStore` (so the goals list stays fresh),
/// refetching progress after each change. The server owns every figure; this
/// object only loads and mutates status.
@Observable @MainActor
final class SavingsGoalDetailViewModel {
    let goalId: String

    private(set) var progress: SavingsGoalProgress?
    private(set) var contributions: [SavingsGoalContribution] = []
    private(set) var withdrawals: [SavingsGoalWithdrawal] = []
    private(set) var plannedWithdrawals: [SavingsGoalPlannedWithdrawal] = []
    private(set) var planOnlyWithdrawals: [SavingsGoalPlanOnlyWithdrawal] = []
    private(set) var futureLines: [SavingsGoalFutureLine] = []
    private(set) var isLoading = true
    private(set) var isLoadingContributions = false
    private(set) var isLoadingWithdrawals = false
    private(set) var isMutatingStatus = false
    private(set) var error: Error?
    private(set) var contributionsError: Error?
    private(set) var withdrawalsError: Error?

    private let service: any SavingsGoalServicing

    init(goalId: String, service: any SavingsGoalServicing = SavingsGoalService.shared) {
        self.goalId = goalId
        self.service = service
    }

    static func recoveryAmount(_ progress: SavingsGoalProgress) -> Decimal? {
        guard let amount = progress.required?.rounded(2, .up), amount > 0 else { return nil }
        return amount
    }

    static func canRepairPlan(_ progress: SavingsGoalProgress, status: SavingsGoalStatus) -> Bool {
        status == .active
            && recoveryAmount(progress) != nil
            && progress.months.contains(where: \.isRepairable)
    }

    static func shouldShowPlanTimeline(_ progress: SavingsGoalProgress) -> Bool {
        !progress.months.isEmpty
    }

    /// Initial / pull-to-refresh load. Shows the full-screen spinner while the
    /// first fetch is in flight (progress still nil). The three reads carry
    /// their own state: a history that fails must not blank out a progression
    /// that loaded, so none of them can speak for the others.
    func load() async {
        isLoading = true
        defer { isLoading = false }
        async let progressLoad: Void = fetchProgress()
        async let contributionsLoad: Void = loadContributions()
        async let withdrawalsLoad: Void = loadWithdrawals()
        await progressLoad
        await contributionsLoad
        await withdrawalsLoad
    }

    func loadContributions() async {
        isLoadingContributions = true
        contributionsError = nil
        defer { isLoadingContributions = false }
        do {
            contributions = try await service.getContributions(id: goalId)
        } catch {
            contributionsError = error
        }
    }

    /// Incomes drawn from this goal (PUL-329), newest first — the server's order
    /// is the displayed order.
    func loadWithdrawals() async {
        isLoadingWithdrawals = true
        withdrawalsError = nil
        defer { isLoadingWithdrawals = false }
        do {
            let readModel = try await service.getWithdrawals(id: goalId)
            withdrawals = readModel.withdrawals
            plannedWithdrawals = readModel.planned
            planOnlyWithdrawals = readModel.planOnly
        } catch {
            withdrawalsError = error
        }
    }

    /// Changes status via the store (keeps the cached list in sync) then
    /// refetches progress so `suggestCompletion` and the status flip are
    /// reflected. Never auto-flips — always user-initiated (pilier Contrôle).
    func changeStatus(to status: SavingsGoalStatus, via store: SavingsGoalStore) async {
        isMutatingStatus = true
        defer { isMutatingStatus = false }
        error = nil
        do {
            _ = try await store.update(id: goalId, data: SavingsGoalUpdate(status: status))
            await fetchProgress(reportError: false)
        } catch {
            self.error = error
        }
    }

    func applyMissingForecasts(from progress: SavingsGoalProgress) async -> Bool {
        error = nil
        guard let amount = Self.recoveryAmount(progress) else { return false }
        let adjustments = progress.months
            .filter(\.isRepairable)
            .map {
                SavingsGoalPlanApply.MissingMonthAdjustment(
                    month: $0.month,
                    year: $0.year,
                    amount: amount
                )
            }
        guard !adjustments.isEmpty else { return false }

        do {
            _ = try await service.applyPlan(
                id: goalId,
                SavingsGoalPlanApply(
                    monthAdjustments: [],
                    missingMonthAdjustments: adjustments
                )
            )
            return true
        } catch {
            self.error = error
            return false
        }
    }

    private func fetchProgress(reportError: Bool = true) async {
        error = nil
        do {
            progress = try await service.getProgress(id: goalId)
        } catch {
            if reportError { self.error = error }
        }
    }

    // MARK: - Generation stop (PUL-285 CA8)

    /// Advisory candidates: the goal's future linked lines. Read is advisory —
    /// a failure just leaves the card hidden (the user can pull-to-refresh).
    func loadFutureLines() async {
        futureLines = (try? await service.getFutureLines(id: goalId)) ?? []
    }
}
