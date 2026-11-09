import SwiftUI

/// « Quand ? » on a model line: « Mensuel » or « Ponctuel », and what the answer means
/// for the months built from the model. Shared by the add and edit sheets.
struct TemplateWhenSection: View {
    @Binding var recurrence: TransactionRecurrence
    let templateName: String

    var body: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
            SegmentedPicker(
                selection: $recurrence,
                title: AppLocale.string("Quand ?"),
                options: [.fixed, .oneOff]
            ) { Text(TemplatePresentation.whenLabel($0)) }
            Text(TemplatePresentation.whenCaption(recurrence: recurrence, templateName: templateName))
                .font(PulpeTypography.captionRegular)
                .foregroundStyle(Color.textSecondary)
                .padding(.horizontal, DesignTokens.Spacing.xs)
        }
    }
}

#Preview {
    @Previewable @State var recurrence = TransactionRecurrence.fixed
    TemplateWhenSection(recurrence: $recurrence, templateName: "Mois standard")
        .padding()
        .background(Color.sheetBackground)
}
