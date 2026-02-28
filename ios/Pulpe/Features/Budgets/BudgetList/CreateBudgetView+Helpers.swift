import SwiftUI

// MARK: - Preview

#Preview("Create Budget") {
    CreateBudgetView(month: 1, year: 2025) { budget in
        print("Created: \(budget)")
    }
}
