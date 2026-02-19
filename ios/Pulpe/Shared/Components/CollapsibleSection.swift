import SwiftUI

/// Reusable collapsible section for progressive disclosure
/// Reduces visual density by allowing users to expand/collapse secondary content
struct CollapsibleSection<Content: View>: View {
    let title: String
    let isExpanded: Binding<Bool>
    @ViewBuilder let content: () -> Content

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            Button {
                withAnimation(.spring(duration: 0.3)) {
                    isExpanded.wrappedValue.toggle()
                }
            } label: {
                HStack {
                    Text(title)
                        .pulpeSectionHeader()

                    Spacer()

                    Image(systemName: "chevron.right")
                        .font(.caption.weight(.semibold))
                        .foregroundStyle(.secondary)
                        .rotationEffect(.degrees(isExpanded.wrappedValue ? 90 : 0))
                }
                .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel(title)
            .accessibilityHint(isExpanded.wrappedValue ? "Appuie pour réduire" : "Appuie pour développer")
            .accessibilityAddTraits(.isButton)

            if isExpanded.wrappedValue {
                content()
                    .transition(.opacity.combined(with: .move(edge: .top)))
            }
        }
    }
}

// MARK: - Preview

#Preview("Collapsible Section") {
    struct PreviewContainer: View {
        @State private var trendsExpanded = true
        @State private var yearExpanded = false

        var body: some View {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxl) {
                    CollapsibleSection(title: "Dépenses", isExpanded: $trendsExpanded) {
                        Text("Trends content here")
                            .pulpeCard()
                    }

                    CollapsibleSection(title: "Cette année", isExpanded: $yearExpanded) {
                        Text("Year overview content here")
                            .pulpeCard()
                    }
                }
                .padding()
            }
            .pulpeBackground()
        }
    }

    return PreviewContainer()
}
