import SwiftUI

/// Interactive tutorial overlay with spotlight effect
struct TutorialOverlay: View {
    @Environment(AppState.self) private var appState
    @State private var state = TutorialState()

    var body: some View {
        GeometryReader { geometry in
            ZStack {
                // Dark overlay - taps pass through to tooltip
                SpotlightMask(targetFrame: state.currentTargetFrame)
                    .fill(.black.opacity(0.7))
                    .ignoresSafeArea()
                    .allowsHitTesting(false)

                // Tooltip (must be interactive)
                TutorialTooltip(
                    step: state.currentStep,
                    currentIndex: state.currentStepIndex,
                    totalSteps: TutorialStep.allCases.count,
                    targetFrame: state.currentTargetFrame,
                    containerSize: geometry.size,
                    onNext: {
                        if state.hasNextStep {
                            state.nextStep()
                        } else {
                            appState.completeTutorial()
                        }
                    },
                    onSkip: {
                        appState.completeTutorial()
                    }
                )
            }
        }
        .animation(.easeInOut(duration: 0.3), value: state.currentStepIndex)
    }
}

// MARK: - Spotlight Mask

struct SpotlightMask: Shape {
    let targetFrame: CGRect

    func path(in rect: CGRect) -> Path {
        var path = Path()

        // Full rectangle
        path.addRect(rect)

        // Subtract spotlight hole
        if targetFrame != .zero {
            let spotlightRect = targetFrame.insetBy(dx: -8, dy: -8)
            path.addRoundedRect(in: spotlightRect, cornerSize: CGSize(width: 12, height: 12))
        }

        return path
    }
}

// MARK: - Tooltip

struct TutorialTooltip: View {
    let step: TutorialStep
    let currentIndex: Int
    let totalSteps: Int
    let targetFrame: CGRect
    let containerSize: CGSize
    let onNext: () -> Void
    let onSkip: () -> Void

    private var tooltipPosition: CGPoint {
        // Position tooltip below or above the target
        let padding: CGFloat = 20
        let tooltipHeight: CGFloat = 180

        var y: CGFloat
        if targetFrame.maxY + tooltipHeight + padding < containerSize.height {
            // Below target
            y = targetFrame.maxY + padding + tooltipHeight / 2
        } else {
            // Above target
            y = targetFrame.minY - padding - tooltipHeight / 2
        }

        return CGPoint(x: containerSize.width / 2, y: y)
    }

    var body: some View {
        VStack(alignment: .leading, spacing: 16) {
            // Step indicator
            HStack {
                Text("Étape \(currentIndex + 1)/\(totalSteps)")
                    .font(.caption)
                    .foregroundStyle(.secondary)

                Spacer()

                Button("Passer") {
                    onSkip()
                }
                .font(.caption)
                .foregroundStyle(.secondary)
            }

            // Title
            Text(step.title)
                .font(.headline)
                .foregroundStyle(.primary)

            // Description
            Text(step.description)
                .font(.subheadline)
                .foregroundStyle(.secondary)
                .fixedSize(horizontal: false, vertical: true)

            // Next button
            Button {
                onNext()
            } label: {
                Text(currentIndex == totalSteps - 1 ? "Terminer" : "Suivant")
                    .frame(maxWidth: .infinity)
                    .padding(.vertical, 12)
            }
            .buttonStyle(.borderedProminent)
        }
        .padding(20)
        .frame(maxWidth: 320)
        .background(.regularMaterial, in: RoundedRectangle(cornerRadius: 16))
        .shadow(color: .black.opacity(0.2), radius: 10, y: 5)
        .contentShape(RoundedRectangle(cornerRadius: 16))
        .position(tooltipPosition)
    }
}

// MARK: - Tutorial State

@Observable
final class TutorialState {
    var currentStepIndex: Int = 0

    var currentStep: TutorialStep {
        TutorialStep.allCases[currentStepIndex]
    }

    var currentTargetFrame: CGRect {
        // In a real app, this would be populated by preference keys from the actual UI elements
        // For now, we return a placeholder
        currentStep.placeholderFrame
    }

    var hasNextStep: Bool {
        currentStepIndex < TutorialStep.allCases.count - 1
    }

    func nextStep() {
        if hasNextStep {
            currentStepIndex += 1
        }
    }

    func reset() {
        currentStepIndex = 0
    }
}

// MARK: - Tutorial Steps

enum TutorialStep: String, CaseIterable, Identifiable {
    case progressBar
    case addTransaction
    case recurringExpenses
    case navigation

    var id: String { rawValue }

    var title: String {
        switch self {
        case .progressBar: "Votre budget disponible"
        case .addTransaction: "Ajouter une dépense"
        case .recurringExpenses: "Vos dépenses récurrentes"
        case .navigation: "Navigation"
        }
    }

    var description: String {
        switch self {
        case .progressBar:
            "Cette barre vous montre combien il vous reste à dépenser ce mois-ci. Le vert représente ce qui est disponible."
        case .addTransaction:
            "Appuyez ici pour ajouter rapidement une dépense ou un revenu."
        case .recurringExpenses:
            "Vos dépenses récurrentes apparaissent ici. Cochez-les quand elles sont payées."
        case .navigation:
            "Utilisez ces onglets pour accéder à vos budgets et modèles."
        }
    }

    // Placeholder frames for demo - in real app, use PreferenceKey
    var placeholderFrame: CGRect {
        switch self {
        case .progressBar:
            CGRect(x: 20, y: 120, width: UIScreen.main.bounds.width - 40, height: 80)
        case .addTransaction:
            CGRect(x: UIScreen.main.bounds.width - 80, y: UIScreen.main.bounds.height - 180, width: 56, height: 56)
        case .recurringExpenses:
            CGRect(x: 20, y: 300, width: UIScreen.main.bounds.width - 40, height: 150)
        case .navigation:
            CGRect(x: 0, y: UIScreen.main.bounds.height - 90, width: UIScreen.main.bounds.width, height: 80)
        }
    }
}

#Preview {
    ZStack {
        Color(.systemGroupedBackground)
            .ignoresSafeArea()

        VStack {
            Text("App Content")
        }

        TutorialOverlay()
    }
    .environment(AppState())
}
