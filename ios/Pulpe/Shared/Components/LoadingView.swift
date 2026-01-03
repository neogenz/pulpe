import SwiftUI

/// Full-screen loading indicator
struct LoadingView: View {
    let message: String?

    init(message: String? = nil) {
        self.message = message
    }

    var body: some View {
        VStack(spacing: 16) {
            ProgressView()
                .scaleEffect(1.2)

            if let message {
                Text(message)
                    .font(.subheadline)
                    .foregroundStyle(.secondary)
            }
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(.background)
    }
}

/// Inline loading indicator for buttons or small areas
struct InlineLoadingView: View {
    var body: some View {
        ProgressView()
            .progressViewStyle(.circular)
    }
}

/// Overlay loading that dims the background
struct LoadingOverlay: View {
    let isLoading: Bool
    let message: String?

    init(isLoading: Bool, message: String? = nil) {
        self.isLoading = isLoading
        self.message = message
    }

    var body: some View {
        if isLoading {
            ZStack {
                Color.black.opacity(0.3)
                    .ignoresSafeArea()

                VStack(spacing: 16) {
                    ProgressView()
                        .scaleEffect(1.2)
                        .tint(.white)

                    if let message {
                        Text(message)
                            .font(.subheadline)
                            .foregroundStyle(.white)
                    }
                }
                .padding(24)
                .background(.ultraThinMaterial, in: RoundedRectangle(cornerRadius: 16))
            }
        }
    }
}

#Preview {
    LoadingView(message: "Chargement...")
}
