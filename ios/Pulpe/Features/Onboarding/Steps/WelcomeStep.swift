import SwiftUI

struct WelcomeStep: View {
    @State private var showLogin = false
    @State private var currentPage = 0
    @State private var isAppeared = false
    let state: OnboardingState

    private let pages: [WelcomePage] = [
        WelcomePage(
            icon: "chart.bar.fill",
            iconColor: Color.financialExpense,
            title: "Suis tes dépenses",
            subtitle: "Visualise où va ton argent chaque mois et reprends le contrôle"
        ),
        WelcomePage(
            icon: "target",
            iconColor: Color.pulpePrimary,
            title: "Planifie ton budget",
            subtitle: "Crée des modèles de budget et atteins tes objectifs financiers"
        ),
        WelcomePage(
            icon: "chart.line.uptrend.xyaxis",
            iconColor: Color.financialIncome,
            title: "Progresse chaque mois",
            subtitle: "Compare tes dépenses, suis tes tendances et améliore-toi"
        )
    ]

    var body: some View {
        VStack(spacing: 0) {
            Spacer()

            // Carousel
            TabView(selection: $currentPage) {
                ForEach(Array(pages.enumerated()), id: \.offset) { index, page in
                    WelcomePageView(page: page)
                        .tag(index)
                }
            }
            .tabViewStyle(.page(indexDisplayMode: .never))
            .frame(height: 360)
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 20)

            // Page indicators
            HStack(spacing: 8) {
                ForEach(0..<pages.count, id: \.self) { index in
                    Capsule()
                        .fill(index == currentPage ? Color.pulpePrimary : Color.secondary.opacity(0.25))
                        .frame(width: index == currentPage ? 24 : 8, height: 8)
                        .animation(.spring(response: 0.3, dampingFraction: 0.7), value: currentPage)
                }
            }
            .padding(.top, DesignTokens.Spacing.xxl)
            .opacity(isAppeared ? 1 : 0)

            Spacer()

            // Bottom buttons
            VStack(spacing: DesignTokens.Spacing.md) {
                Button {
                    state.nextStep()
                } label: {
                    HStack(spacing: 8) {
                        Text("Commencer")
                            .font(PulpeTypography.buttonPrimary)
                        Image(systemName: "arrow.right")
                            .font(.system(size: 14, weight: .semibold))
                    }
                    .frame(maxWidth: .infinity)
                    .frame(height: DesignTokens.FrameHeight.button)
                    .background(Color.onboardingGradient)
                    .foregroundStyle(Color.textOnPrimary)
                    .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                    .shadow(color: Color.pulpePrimary.opacity(0.3), radius: 8, y: 4)
                }

                Button {
                    showLogin = true
                } label: {
                    Text("Se connecter")
                        .font(PulpeTypography.buttonPrimary)
                        .frame(maxWidth: .infinity)
                        .frame(height: DesignTokens.FrameHeight.button)
                        .foregroundStyle(Color.textPrimary)
                        .background(Color.surfaceSecondary.opacity(0.6))
                        .clipShape(.rect(cornerRadius: DesignTokens.CornerRadius.button))
                }
            }
            .padding(.horizontal, DesignTokens.Spacing.xxl)
            .padding(.bottom, DesignTokens.Spacing.xxxl)
            .opacity(isAppeared ? 1 : 0)
            .offset(y: isAppeared ? 0 : 10)
        }
        .pulpeBackground()
        .sheet(isPresented: $showLogin) {
            LoginView(isPresented: $showLogin)
        }
        .task {
            try? await Task.sleep(for: .milliseconds(100))
            withAnimation(.spring(response: 0.6, dampingFraction: 0.8)) {
                isAppeared = true
            }
        }
    }
}

// MARK: - Welcome Page Data

private struct WelcomePage {
    let icon: String
    let iconColor: Color
    let title: String
    let subtitle: String
}

// MARK: - Welcome Page View

private struct WelcomePageView: View {
    let page: WelcomePage

    var body: some View {
        VStack(spacing: DesignTokens.Spacing.xxl) {
            // Icon illustration
            ZStack {
                Circle()
                    .fill(page.iconColor.opacity(0.12))
                    .frame(width: 120, height: 120)

                Circle()
                    .fill(page.iconColor.opacity(0.06))
                    .frame(width: 180, height: 180)

                Image(systemName: page.icon)
                    .font(.system(size: 48, weight: .medium))
                    .foregroundStyle(page.iconColor)
                    .symbolRenderingMode(.hierarchical)
            }

            VStack(spacing: DesignTokens.Spacing.md) {
                Text(page.title)
                    .font(PulpeTypography.onboardingTitle)
                    .foregroundStyle(Color.textPrimaryOnboarding)
                    .multilineTextAlignment(.center)

                Text(page.subtitle)
                    .font(PulpeTypography.onboardingSubtitle)
                    .foregroundStyle(Color.textSecondaryOnboarding)
                    .multilineTextAlignment(.center)
                    .lineLimit(3)
            }
            .padding(.horizontal, DesignTokens.Spacing.xxxl)
        }
    }
}

#Preview {
    WelcomeStep(state: OnboardingState())
        .environment(AppState())
}
