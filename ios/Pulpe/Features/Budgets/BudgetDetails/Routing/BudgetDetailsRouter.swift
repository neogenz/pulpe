import Foundation
import SwiftUI

/// Feature-internal router for the BudgetDetails NavigationStack branch.
///
/// `BudgetDetailsRouter` is a thin facade over `AppState.budgetPath` plus a
/// dedicated sheet slot. All push/pop and sheet transitions inside the
/// BudgetDetails feature go through this type. Cross-feature entry points
/// (deep link, BudgetList CTA, CurrentMonth CTA) keep writing to
/// `appState.budgetPath` directly — they are not feature-internal navigation.
///
/// Pattern: see `ios/docs/BUDGET_DETAILS_REFACTOR_PLAN.md` Phase 1.
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
        appState?.budgetPath.append(route)
    }

    func popToRoot() {
        appState?.budgetPath = NavigationPath()
    }

    // MARK: - Sheet

    func present(_ destination: BudgetDetailDestination) {
        sheet = destination
    }

    func dismissSheet() {
        sheet = nil
    }
}
