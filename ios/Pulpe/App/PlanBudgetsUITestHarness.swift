import SwiftUI

@MainActor
struct PlanBudgetsUITestHarness: View {
    @State private var isPresented = true
    private let viewModel: PlanBudgetsViewModel
    private let failGeneration: () -> Void

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
        let (results, continuation) = AsyncThrowingStream<BudgetGenerateResponse, Error>.makeStream()
        self.failGeneration = { continuation.finish(throwing: URLError(.cannotConnectToHost)) }
        self.viewModel = PlanBudgetsViewModel(
            payDayOfMonth: nil,
            loadTemplates: { [template] },
            generate: { _ in
                guard let response = try await results.first(where: { _ in true }) else {
                    throw URLError(.cannotConnectToHost)
                }
                return response
            }
        )
    }

    var body: some View {
        Color.clear
            .sheet(isPresented: $isPresented) {
                PlanBudgetsView(viewModel: viewModel) { _ in }
                    .accessibilityIdentifier("planBudgetsSheet")
                    .overlay(alignment: .bottomTrailing) {
                        Button(action: failGeneration) {
                            Color.clear.frame(width: 44, height: 44)
                        }
                        .accessibilityIdentifier("planBudgetsFail")
                    }
                    .environment(UserSettingsStore())
            }
    }
}
