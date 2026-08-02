import Foundation
import SwiftUI

/// Feature-internal router for the BudgetDetails NavigationStack branch.
///
/// `BudgetDetailsRouter` is a thin facade over `AppState.budgetPath` plus a
/// dedicated sheet slot. All push/pop and sheet transitions inside the
/// BudgetDetails feature go through this type. Cross-feature entry points
/// (deep link, BudgetList CTA, CurrentMonth CTA) keep writing to
/// `appState.budgetPath` directly — they are not feature-internal navigation.
@Observable @MainActor
final class BudgetDetailsRouter {
    /// Active sheet, or `nil` if no sheet is presented. Bound to
    /// `BudgetDetailsView.sheet(item:)`.
    var sheet: BudgetDetailDestination?

    /// Weak reference to `AppState` so the router does not extend its
    /// lifetime. Bound by the owning tab via `bind(to:)` once the
    /// environment is available.
    @ObservationIgnored private weak var appState: AppState?

    /// Binds the router to its owning `AppState`. Call once from the tab
    /// shell after the environment is available (e.g. inside `.task`).
    func bind(to appState: AppState) {
        self.appState = appState
    }

    // MARK: - Push

    func push(_ route: BudgetLinePushRoute) {
        // The budget detail is reachable from two sections, so the push goes to whichever
        // stack is on screen — hardcoding the budgets path made a detail opened from the
        // accueil push its lines onto a stack nobody was looking at.
        appState?.pushOnActiveStack(route)
    }

    /// Pushes a savings goal's progression detail onto the on-screen stack (PUL-12).
    /// Cross-feature push from a saving prévision's detail — resolved by the
    /// `SavingsGoalDestination` destination, registered on every tab that can reach a
    /// budget detail.
    func pushSavingsGoal(_ goal: SavingsGoal) {
        appState?.pushOnActiveStack(SavingsGoalDestination.detail(goal))
    }

    func popToRoot() {
        appState?.popActiveStackToRoot()
    }

    // MARK: - Sheet

    func present(_ destination: BudgetDetailDestination) {
        sheet = destination
    }

    func dismissSheet() {
        sheet = nil
    }
}
