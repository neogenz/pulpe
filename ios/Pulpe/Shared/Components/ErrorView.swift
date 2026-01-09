import SwiftUI

/// Full-screen error view with retry option
struct ErrorView: View {
    let error: Error
    let retryAction: (() async -> Void)?

    init(error: Error, retryAction: (() async -> Void)? = nil) {
        self.error = error
        self.retryAction = retryAction
    }

    var body: some View {
        ContentUnavailableView {
            Label("Erreur", systemImage: "exclamationmark.triangle")
        } description: {
            Text(error.localizedDescription)
        } actions: {
            if let retryAction {
                Button("Réessayer") {
                    Task {
                        await retryAction()
                    }
                }
                .buttonStyle(.borderedProminent)
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
        HStack {
            Image(systemName: "exclamationmark.circle.fill")
                .foregroundStyle(.red)

            Text(message)
                .font(.subheadline)
                .foregroundStyle(.primary)

            Spacer()

            if let dismissAction {
                Button {
                    dismissAction()
                } label: {
                    Image(systemName: "xmark.circle.fill")
                        .foregroundStyle(.secondary)
                }
            }
        }
        .padding()
        .background(.red.opacity(0.1), in: RoundedRectangle(cornerRadius: 12))
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
    ErrorBanner(message: "Une erreur est survenue") {
        print("Dismissed")
    }
    .padding()
}
