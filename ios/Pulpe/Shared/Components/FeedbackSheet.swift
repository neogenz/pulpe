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

    private let onSubmitted: () -> Void

    init(
        dependencies: FeedbackDependencies? = nil,
        onSubmitted: @escaping () -> Void = {}
    ) {
        _viewModel = State(initialValue: FeedbackViewModel(dependencies: dependencies))
        self.onSubmitted = onSubmitted
    }

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.none) {
            ScrollView {
                VStack(spacing: DesignTokens.Spacing.xxxl) {
                    if viewModel.isSubmitted {
                        successContent
                    } else {
                        header
                        formContent
                    }
                }
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.top, DesignTokens.Spacing.xxxl)
                .padding(.bottom, DesignTokens.Spacing.xxl)
            }
            .scrollBounceBehavior(.basedOnSize)
            .scrollDismissesKeyboard(.interactively)

            footer
                .padding(.horizontal, DesignTokens.Spacing.xl)
                .padding(.vertical, DesignTokens.Spacing.lg)
                .background(Color.sheetBackground)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Color.sheetBackground)
        .loadingOverlay(viewModel.isSubmitting)
        .dismissKeyboardOnTap()
        .keyboardFieldNavigation(focus: $focusedField, order: [.comment])
        .sensoryFeedback(.success, trigger: viewModel.isSubmitted)
        .suppressesTips()
        .standardSheetPresentation()
    }

    private var header: some View {
        VStack(spacing: DesignTokens.Spacing.lg) {
            Image(systemName: "bubble.left.and.bubble.right.fill")
                .font(.system(size: DesignTokens.IconSize.brand, weight: .semibold))
                .foregroundStyle(Color.pulpePrimary)
                .accessibilityHidden(true)

            Text("Ton avis sur Pulpe")
                .font(.title2.bold())
                .foregroundStyle(Color.textPrimary)
                .multilineTextAlignment(.center)

            Label {
                Text("Ton avis reste privé. Il n'est pas publié sur l'App Store.")
                    .font(PulpeTypography.body)
                    .foregroundStyle(Color.onSurfaceVariant)
                    .multilineTextAlignment(.center)
                    .fixedSize(horizontal: false, vertical: true)
            } icon: {
                Image(systemName: "lock.fill")
                    .foregroundStyle(Color.pulpePrimary)
                    .accessibilityHidden(true)
            }
        }
        .frame(maxWidth: .infinity)
        .accessibilityElement(children: .combine)
    }

    private var formContent: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            FormCard {
                VStack(spacing: DesignTokens.Spacing.md) {
                    Text("Comment ça se passe avec Pulpe ?")
                        .font(PulpeTypography.title3)
                        .foregroundStyle(Color.textPrimary)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)

                    FeedbackRatingControl(selection: $viewModel.overallRating)
                        .accessibilityIdentifier("feedbackOverallRating")

                    if let overallRating = viewModel.overallRating {
                        Text(overallRating.accessibilityLabel)
                            .font(PulpeTypography.labelLarge)
                            .foregroundStyle(Color.pulpePrimary)
                    }
                }
                .padding(.vertical, DesignTokens.Spacing.xl)
            }

            Button {
                withAnimation(DesignTokens.Animation.smoothEaseInOut) {
                    showsDetails.toggle()
                }
            } label: {
                HStack(spacing: DesignTokens.Spacing.md) {
                    Image(systemName: showsDetails ? "minus.circle.fill" : "plus.circle.fill")
                        .font(PulpeTypography.title2)
                        .foregroundStyle(Color.pulpePrimary)
                        .contentTransition(.symbolEffect(.replace))

                    Text("Préciser mon avis")
                        .font(PulpeTypography.headline)
                        .foregroundStyle(Color.textPrimary)

                    Spacer(minLength: DesignTokens.Spacing.sm)
                }
            }
            .plainPressedButtonStyle()
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
            .accessibilityHint(showsDetails ? Text("Appuie pour réduire") : Text("Appuie pour développer"))
            .sensoryFeedback(.selection, trigger: showsDetails)

            if showsDetails {
                FormCard {
                    detailsContent
                }
                .transition(.opacity.combined(with: .move(edge: .top)))
            }

            if let errorMessage = viewModel.errorMessage {
                ErrorBanner(message: errorMessage) {
                    viewModel.errorMessage = nil
                }
                .accessibilityIdentifier("feedbackError")
            }
        }
    }

    private var detailsContent: some View {
        VStack(alignment: .leading, spacing: DesignTokens.Spacing.none) {
            ForEach(Array(FeedbackArea.allCases.enumerated()), id: \.element) { index, area in
                if index > 0 {
                    FormRowDivider()
                }
                areaRatingRow(area)
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
                .font(PulpeTypography.bodyLarge)
                .textFieldStyle(.plain)
                .padding(DesignTokens.Spacing.lg)
                .background(Color.inputBackgroundSoft)
                .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.md))
                .overlay {
                    RoundedRectangle(cornerRadius: DesignTokens.CornerRadius.md)
                        .strokeBorder(
                            Color.outlineVariant,
                            lineWidth: DesignTokens.BorderWidth.thin
                        )
                }
                .focused($focusedField, equals: .comment)
                .accessibilityLabel("Commentaire facultatif")
                .accessibilityIdentifier("feedbackComment")
            }
            .padding(.vertical, DesignTokens.Spacing.lg)
        }
    }

    private func areaRatingRow(_ area: FeedbackArea) -> some View {
        Menu {
            Picker(area.title, selection: viewModel.ratingBinding(for: area)) {
                ForEach(FeedbackRating.allCases) { rating in
                    Text(rating.accessibilityLabel)
                        .tag(Optional(rating))
                }
            }
        } label: {
            HStack(spacing: DesignTokens.Spacing.sm) {
                Text(area.title)
                    .foregroundStyle(Color.textPrimary)
                    .accessibilityIdentifier("feedbackArea.\(area.rawValue)")

                Spacer(minLength: DesignTokens.Spacing.sm)

                Text(viewModel.ratings[area]?.accessibilityLabel ?? AppLocale.string("Noter"))
                    .foregroundStyle(viewModel.ratings[area] == nil ? Color.textTertiary : Color.pulpePrimary)

                Image(systemName: "chevron.up.chevron.down")
                    .font(PulpeTypography.caption)
                    .foregroundStyle(Color.textTertiary)
                    .accessibilityHidden(true)
            }
            .font(PulpeTypography.body)
            .frame(minHeight: DesignTokens.TapTarget.minimum)
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .padding(.vertical, DesignTokens.Spacing.sm)
        .accessibilityIdentifier("feedbackAreaRating.\(area.rawValue)")
        .sensoryFeedback(.selection, trigger: viewModel.ratings[area])
    }

    private var footer: some View {
        VStack(spacing: DesignTokens.Spacing.md) {
            if viewModel.isSubmitted {
                Button("Fermer") { dismiss() }
                    .primaryButtonStyle()
                    .accessibilityIdentifier("feedbackSuccessClose")
            } else {
                Button("Envoyer", action: submit)
                    .disabled(!viewModel.canSubmit)
                    .primaryButtonStyle(isEnabled: viewModel.canSubmit)
                    .accessibilityIdentifier("feedbackSubmit")

                Button("Fermer") { dismiss() }
                    .secondaryButtonStyle()
            }
        }
    }

    private func submit() {
        Task {
            guard await viewModel.submit() else { return }
            onSubmitted()
        }
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
        }
        .frame(maxWidth: .infinity)
        .padding(.top, DesignTokens.Spacing.xxl)
    }
}

private struct FeedbackRatingControl: View {
    @Binding var selection: FeedbackRating?

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.xs) {
            ForEach(FeedbackRating.allCases) { rating in
                Button {
                    selection = rating
                } label: {
                    Image(systemName: isFilled(rating) ? "star.fill" : "star")
                        .font(PulpeTypography.title2)
                        .foregroundStyle(isFilled(rating) ? Color.pulpePrimary : Color.textTertiary)
                        .frame(maxWidth: .infinity)
                        .contentTransition(.symbolEffect(.replace))
                }
                .buttonStyle(.plain)
                .frame(maxWidth: .infinity, minHeight: DesignTokens.TapTarget.minimum)
                .contentShape(Rectangle())
                .accessibilityLabel(rating.accessibilityLabel)
                .accessibilityValue(selection == rating ? Text("Sélectionné") : Text(""))
                .accessibilityAddTraits(selection == rating ? .isSelected : [])
            }
        }
        .sensoryFeedback(.selection, trigger: selection)
    }

    private func isFilled(_ rating: FeedbackRating) -> Bool {
        rating.rawValue <= (selection?.rawValue ?? 0)
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
