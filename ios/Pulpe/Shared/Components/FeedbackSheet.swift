import SwiftUI
import UIKit

struct FeedbackSheet: View {
    private enum Field: Hashable {
        case comment
    }

    @Environment(\.dismiss) private var dismiss
    @FocusState private var focusedField: Field?
    @State private var viewModel: FeedbackViewModel
    @State private var showsDetails = false
    @State private var expandedArea: FeedbackArea?

    private let onSubmitted: () -> Void

    init(
        dependencies: FeedbackDependencies? = nil,
        onSubmitted: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: FeedbackViewModel(dependencies: dependencies))
        self.onSubmitted = onSubmitted
    }

    var body: some View {
        SheetFormContainer(
            title: AppLocale.string("Ton avis sur Pulpe"),
            isLoading: viewModel.isSubmitting,
            focus: $focusedField,
            focusOrder: []
        ) {
            if viewModel.isSubmitted {
                successContent
            } else {
                formContent
            }
        }
        .sensoryFeedback(.success, trigger: viewModel.isSubmitted)
        .suppressesTips()
    }

    private var formContent: some View {
        Group {
            Label {
                Text("Ton avis reste privé. Il n'est pas publié sur l'App Store.")
                    .font(PulpeTypography.subheadline)
                    .foregroundStyle(Color.textSecondary)
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "lock.fill")
                    .foregroundStyle(Color.pulpePrimary)
                    .accessibilityHidden(true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)

            FormCard {
                SegmentedPicker(
                    selection: $viewModel.overallRating,
                    title: AppLocale.string("Comment ça se passe avec Pulpe ?"),
                    itemAccessibilityLabel: \.accessibilityLabel
                ) { rating in
                    Text(String(rating.rawValue))
                }
                .padding(.vertical, DesignTokens.Spacing.lg)
                .accessibilityIdentifier("feedbackOverallRating")
            }

            FormCard {
                DisclosureGroup(isExpanded: $showsDetails) {
                    detailsContent
                } label: {
                    Text("Préciser mon avis")
                        .font(PulpeTypography.bodyLarge)
                        .accessibilityIdentifier("feedbackDetailsDisclosure")
                }
                .frame(minHeight: DesignTokens.TapTarget.minimum)
            }

            if let errorMessage = viewModel.errorMessage {
                ErrorBanner(message: errorMessage) {
                    viewModel.errorMessage = nil
                }
                .accessibilityIdentifier("feedbackError")
            }

            Button {
                Task {
                    guard await viewModel.submit() else { return }
                    onSubmitted()
                }
            } label: {
                Text("Envoyer")
            }
            .disabled(!viewModel.canSubmit)
            .primaryButtonStyle(isEnabled: viewModel.canSubmit)
            .accessibilityIdentifier("feedbackSubmit")
        }
    }

    private var detailsContent: some View {
        VStack(spacing: 0) {
            ForEach(Array(FeedbackArea.allCases.enumerated()), id: \.element) { index, area in
                if index > 0 {
                    FormRowDivider()
                }
                areaDisclosure(area)
            }

            FormRowDivider()

            VStack(alignment: .leading, spacing: DesignTokens.Spacing.sm) {
                Text("Commentaire facultatif")
                    .font(PulpeTypography.labelMedium)
                    .foregroundStyle(Color.onSurfaceVariant)

                TextField(
                    "Un commentaire à ajouter ?",
                    text: Binding(
                        get: { viewModel.comment },
                        set: { viewModel.updateComment($0) }
                    ),
                    axis: .vertical
                )
                .lineLimit(3...6)
                .textFieldStyle(.plain)
                .focused($focusedField, equals: .comment)
                .accessibilityLabel("Commentaire facultatif")
                .accessibilityIdentifier("feedbackComment")
            }
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    private func areaDisclosure(_ area: FeedbackArea) -> some View {
        DisclosureGroup(
            isExpanded: Binding(
                get: { expandedArea == area },
                set: { expandedArea = $0 ? area : nil }
            )
        ) {
            SegmentedPicker(
                selection: viewModel.ratingBinding(for: area),
                title: area.title,
                itemAccessibilityLabel: \.accessibilityLabel
            ) { rating in
                Text(String(rating.rawValue))
            }
            .padding(.bottom, DesignTokens.Spacing.lg)
            .accessibilityIdentifier("feedbackAreaRating.\(area.rawValue)")
        } label: {
            HStack {
                Text(area.title)
                    .accessibilityIdentifier("feedbackArea.\(area.rawValue)")
                Spacer(minLength: DesignTokens.Spacing.sm)
                if let rating = viewModel.ratings[area] {
                    Text("\(rating.rawValue)/5")
                        .font(PulpeTypography.caption)
                        .foregroundStyle(Color.textSecondary)
                }
            }
            .font(PulpeTypography.body)
        }
        .frame(minHeight: DesignTokens.TapTarget.minimum)
    }

    private var successContent: some View {
        VStack(spacing: DesignTokens.Spacing.xl) {
            Image(systemName: "checkmark.circle.fill")
                .font(.system(size: DesignTokens.IconSize.heroBadge))
                .foregroundStyle(Color.pulpePrimary)
                .accessibilityHidden(true)

            Text("Merci. Ton avis fait progresser Pulpe.")
                .font(PulpeTypography.title3)
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)
                .fixedSize(horizontal: false, vertical: true)
                .accessibilityIdentifier("feedbackSuccessMessage")

            Button("Fermer") { dismiss() }
                .primaryButtonStyle()
                .accessibilityIdentifier("feedbackSuccessClose")
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignTokens.Spacing.xxl)
    }
}

struct FeedbackDependencies: Sendable {
    var submit: @Sendable (FeedbackSubmission) async throws -> Void

    static let live = FeedbackDependencies { feedback in
        try await FeedbackService.shared.submit(feedback)
    }
}

@Observable @MainActor
final class FeedbackViewModel {
    /// Shared contract unit: Unicode code points, matching JavaScript iteration
    /// and PostgreSQL `char_length` rather than UTF-16 units or grapheme clusters.
    static let maximumCommentCodePointCount = 1_000

    var overallRating: FeedbackRating?
    var ratings: [FeedbackArea: FeedbackRating] = [:]
    var comment = ""
    var isSubmitting = false
    var errorMessage: String?
    var isSubmitted = false

    private let dependencies: FeedbackDependencies
    private let appVersion: String
    private let iosVersion: String

    init(
        dependencies: FeedbackDependencies? = nil,
        appVersion: String = AppConfiguration.appVersion,
        iosVersion: String = UIDevice.current.systemVersion
    ) {
        self.dependencies = dependencies ?? .live
        self.appVersion = appVersion
        self.iosVersion = iosVersion
    }

    var canSubmit: Bool {
        overallRating != nil && !isSubmitting && !isSubmitted
    }

    func ratingBinding(for area: FeedbackArea) -> Binding<FeedbackRating?> {
        Binding(
            get: { self.ratings[area] },
            set: { self.ratings[area] = $0 }
        )
    }

    func updateComment(_ value: String) {
        comment = String(value.unicodeScalars.prefix(Self.maximumCommentCodePointCount))
    }

    @discardableResult
    func submit() async -> Bool {
        guard canSubmit, let overallRating else { return false }

        isSubmitting = true
        errorMessage = nil
        defer { isSubmitting = false }

        let trimmedComment = comment.trimmingCharacters(in: .whitespacesAndNewlines)
        let submission = FeedbackSubmission(
            overallRating: overallRating,
            ratings: ratings,
            comment: trimmedComment.isEmpty ? nil : trimmedComment,
            appVersion: appVersion,
            iosVersion: iosVersion
        )

        do {
            try await dependencies.submit(submission)
            isSubmitted = true
            return true
        } catch {
            errorMessage = AppLocale.string("Ton avis n'est pas parti. Réessaie.")
            return false
        }
    }
}

#Preview {
    FeedbackSheet()
}
