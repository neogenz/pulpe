import SwiftUI

/// Full-screen error view with retry option
struct ErrorView: View {
    let error: Error
    let retryAction: (() async -> Void)?
    @State private var isRetrying = false

    init(error: Error, retryAction: (() async -> Void)? = nil) {
        self.error = error
        self.retryAction = retryAction
    }

    var body: some View {
        ContentUnavailableView {
            Label("Oups", systemImage: "exclamationmark.triangle")
        } description: {
            Text(DomainErrorLocalizer.localize(error))
        } actions: {
            if let retryAction {
                Button {
                    Task {
                        isRetrying = true
                        defer { isRetrying = false }
                        await retryAction()
                    }
                } label: {
                    if isRetrying {
                        ProgressView()
                    } else {
                        Text("Réessayer")
                    }
                }
                .buttonStyle(.borderedProminent)
                .tint(.pulpePrimary)
                .controlSize(.regular)
                .disabled(isRetrying)
            }
        }
    }
}

/// Inline error banner — white card with left accent stripe
struct ErrorBanner: View {
    let message: String
    let dismissAction: (() -> Void)?

    private let cornerRadius: CGFloat = 12

    init(message: String, dismissAction: (() -> Void)? = nil) {
        self.message = message
        self.dismissAction = dismissAction
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .font(.system(.title3))
                .foregroundStyle(Color.errorPrimary)

            Text(message)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)
                .fixedSize(horizontal: false, vertical: true)

            Spacer(minLength: 0)

            if let dismissAction {
                Button(action: dismissAction) {
                    Image(systemName: "xmark")
                        .font(.system(.caption, weight: .bold))
                        .foregroundStyle(Color.textTertiary)
                }
                .iconButtonStyle()
                .accessibilityLabel("Fermer l'erreur")
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(Color.surfaceContainerLowest, in: .rect(cornerRadius: cornerRadius))
        .overlay(alignment: .leading) {
            UnevenRoundedRectangle(cornerRadii: .init(topLeading: cornerRadius, bottomLeading: cornerRadius))
                .fill(Color.errorPrimary)
                .frame(width: 4)
        }
        .shadow(color: .black.opacity(0.04), radius: 4, y: 1)
        .transition(.move(edge: .top).combined(with: .opacity))
        .accessibilityElement(children: .combine)
        .accessibilityLabel("Erreur: \(message)")
    }
}

/// Empty state view
struct EmptyStateView: View {
    let title: String
    let description: String
    let systemImage: String
    let action: (() -> Void)?
    let actionTitle: String?

    init(
        title: String,
        description: String,
        systemImage: String,
        actionTitle: String? = nil,
        action: (() -> Void)? = nil
    ) {
        self.title = title
        self.description = description
        self.systemImage = systemImage
        self.action = action
        self.actionTitle = actionTitle
    }

    var body: some View {
        ContentUnavailableView {
            Label(title, systemImage: systemImage)
        } description: {
            Text(description)
        } actions: {
            if let action, let actionTitle {
                Button(actionTitle, action: action)
                    .primaryButtonStyle()
                    .padding(.horizontal, DesignTokens.Spacing.sectionGap)
            }
        }
    }
}

#Preview("Error View") {
    ErrorView(error: APIError.networkError(URLError(.notConnectedToInternet))) {
        print("Retry tapped")
    }
}

#Preview("Error Banner") {
    ErrorBanner(message: "Quelque chose n'a pas fonctionné") {
        print("Dismissed")
    }
    .padding()
}
