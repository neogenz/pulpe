import SwiftUI

/// Section header of the transactions list on an envelope's detail page.
///
/// `.listStyle(.plain)` pins it while the rows keep scrolling, and the list
/// content is transparent (`.scrollContentBackground(.hidden)` over the page's
/// own background) — so the header has to carry its own opaque surface or the
/// transactions run straight through the title.
///
/// The whole row has to be painted, insets included, or the rows show through
/// the gutters. `.listRowBackground` is ignored on a section header, so the
/// insets are cleared and carried by the content instead, reproducing them
/// exactly — which is what keeps the header where it sits at rest.
struct BudgetLineDetailTransactionsHeader: View {
    let count: Int

    var body: some View {
        HStack {
            Text("Transactions")
                .font(PulpeTypography.metricLabelBold)
                .foregroundStyle(.primary)

            Spacer()

            Text(countLabel)
                .font(PulpeTypography.metricMini)
                .foregroundStyle(Color.textTertiary)
        }
        .textCase(nil)
        .padding(.horizontal, DesignTokens.Spacing.lg)
        .padding(.vertical, DesignTokens.Spacing.listHeaderVertical)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.appBackground)
        .listRowInsets(EdgeInsets())
    }

    private var countLabel: String {
        switch count {
        case 0: "Aucune"
        case 1: "1 ce mois"
        default: "\(count) ce mois"
        }
    }
}

#Preview {
    List {
        Section {
            ForEach(0 ..< 12, id: \.self) { index in
                Text("Transaction \(index)")
                    .listRowBackground(Color.clear)
            }
        } header: {
            BudgetLineDetailTransactionsHeader(count: 17)
        }
    }
    .listStyle(.plain)
    .scrollContentBackground(.hidden)
    .pulpeBackground()
}
