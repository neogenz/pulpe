import SwiftUI

@MainActor
struct PlanBudgetsUITestHarness: View {
    @State private var isPresented = true
    private let viewModel: PlanBudgetsViewModel

    init() {
        let template = BudgetTemplate(
            id: "template-1",
            name: "Mois standard",
            description: nil,
            userId: "user-1",
            isDefault: true,
            createdAt: .distantPast,
            updatedAt: .distantPast
        )
        self.viewModel = PlanBudgetsViewModel(
            payDayOfMonth: nil,
            loadTemplates: { [template] },
            generate: { _ in
                try await Task.sleep(for: .seconds(5))
                throw URLError(.cannotConnectToHost)
            }
        )
    }

    var body: some View {
        Color.clear
            .sheet(isPresented: $isPresented) {
                PlanBudgetsView(viewModel: viewModel) { _ in }
                    .accessibilityIdentifier("planBudgetsSheet")
                    .environment(UserSettingsStore())
            }
    }
}
