import Foundation
import SwiftUI

/// The destination and its presenting budget stay together when adaptive columns move.
struct BudgetDetailPresentation: Identifiable {
    let destination: BudgetDetailDestination
    let coordinator: BudgetDetailsCoordinator?
    var id: String { destination.id }
}

/// Routes pushes to the active stack and owns its budget sheet presentation.
@Observable @MainActor
final class BudgetDetailsRouter {
    var sheetPresentation: BudgetDetailPresentation?
    let hostsSheetsAtTab: Bool

    /// Local hosts and draft guards share the same presentation slot.
    var sheet: BudgetDetailDestination? {
        get { sheetPresentation?.destination }
        set {
            sheetPresentation = newValue.map {
                BudgetDetailPresentation(destination: $0, coordinator: sheetPresentation?.coordinator)
            }
        }
    }

    init(hostsSheetsAtTab: Bool = false) {
        self.hostsSheetsAtTab = hostsSheetsAtTab
    }

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

    func present(_ destination: BudgetDetailDestination, from coordinator: BudgetDetailsCoordinator? = nil) {
        sheetPresentation = BudgetDetailPresentation(destination: destination, coordinator: coordinator)
    }

    func dismissSheet() {
        sheet = nil
    }
}
