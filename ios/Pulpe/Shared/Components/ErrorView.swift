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
                .disabled(isRetrying)
            }
        }
    }
}

/// Inline error banner
struct ErrorBanner: View {
    let message: String
    let dismissAction: (() -> Void)?

    init(message: String, dismissAction: (() -> Void)? = nil) {
        self.message = message
        self.dismissAction = dismissAction
    }

    var body: some View {
        HStack(spacing: DesignTokens.Spacing.md) {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(Color.errorPrimary)

            Text(message)
                .font(PulpeTypography.subheadline)
                .foregroundStyle(.primary)
                .multilineTextAlignment(.leading)

            Spacer()

            if let dismissAction {
                Button {
                    dismissAction()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(Color.errorPrimary)
                }
                .accessibilityLabel("Fermer")
            }
        }
        .padding(DesignTokens.Spacing.lg)
        .background(Color.errorBackground, in: .rect(cornerRadius: DesignTokens.CornerRadius.md))
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
                    .buttonStyle(.borderedProminent)
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
