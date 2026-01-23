import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @Environment(\.accessibilityReduceMotion) private var reduceMotion
    @State private var viewModel = LoginViewModel()
    @State private var canRetryBiometric = false
    @State private var isAppeared = false
    @FocusState private var focusedField: Field?

    var isPresented: Binding<Bool>?

    private enum Field: Hashable {
        case email, password
    }

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    // Logo and title
                    VStack(spacing: 20) {
                        PulpeIcon(size: 88)
                            .scaleEffect(isAppeared ? 1 : 0.8)
                            .opacity(isAppeared ? 1 : 0)

                        VStack(spacing: 8) {
                            Text("Pulpe")
                                .font(.system(size: 36, weight: .bold, design: .rounded))
                                .tracking(1)
                                .foregroundStyle(Color.pulpePrimary)

                            Text("Content de te revoir")
                                .font(.system(size: 17, weight: .medium, design: .rounded))
                                .foregroundStyle(Color.textSecondaryOnboarding)
                        }
                        .opacity(isAppeared ? 1 : 0)
                        .offset(y: isAppeared ? 0 : 10)
                    }
                    .padding(.top, 56)
                    .padding(.bottom, 44)
                    .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8), value: isAppeared)

                    // Form card
                    VStack(spacing: 20) {
                        // Error message
                        if let errorMessage = viewModel.errorMessage {
                            HStack(spacing: 10) {
                                Image(systemName: "exclamationmark.triangle.fill")
                                    .font(.body)
                                Text(errorMessage)
                                    .font(.subheadline)
                                    .multilineTextAlignment(.leading)
                            }
                            .foregroundStyle(.white)
                            .padding(14)
                            .frame(maxWidth: .infinity, alignment: .leading)
                            .background(Color.red.opacity(0.9), in: RoundedRectangle(cornerRadius: 12))
                        }

                        // Biometric button
                        if canRetryBiometric {
                            Button {
                                Task {
                                    await appState.retryBiometricLogin()
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: biometricIcon)
                                        .font(.title3)
                                    Text("Continuer avec \(BiometricService.shared.biometryDisplayName)")
                                        .fontWeight(.medium)
                                }
                                .frame(maxWidth: .infinity)
                                .frame(height: 54)
                                .background(Color.onboardingGradient)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 14))
                                .shadow(color: Color.pulpePrimary.opacity(0.25), radius: 8, y: 4)
                            }

                            // Divider
                            HStack(spacing: 16) {
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(height: 1)
                                Text("ou")
                                    .font(.footnote)
                                    .foregroundStyle(.secondary)
                                Rectangle()
                                    .fill(Color.secondary.opacity(0.2))
                                    .frame(height: 1)
                            }
                            .padding(.vertical, 4)
                        }

                        // Email field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Adresse e-mail")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            TextField(
                                "",
                                text: $viewModel.email,
                                prompt: Text("exemple@email.com")
                                    .foregroundColor(Color.textTertiaryOnboarding)
                            )
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .font(.system(size: 16))
                            .padding(.horizontal, 18)
                            .frame(height: 54)
                            .background(Color.inputBackgroundSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(
                                        focusedField == .email ? Color.pulpePrimary : Color.clear,
                                        lineWidth: 2
                                    )
                            )
                            .shadow(
                                color: focusedField == .email ? Color.inputFocusGlow : Color.black.opacity(0.04),
                                radius: focusedField == .email ? 8 : 4,
                                y: focusedField == .email ? 2 : 1
                            )
                            .scaleEffect(focusedField == .email ? 1.01 : 1)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
                        }

                        // Password field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Mot de passe")
                                .font(.system(size: 13, weight: .semibold))
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            HStack(spacing: 12) {
                                Group {
                                    if viewModel.showPassword {
                                        TextField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Votre mot de passe")
                                                .foregroundColor(Color.textTertiaryOnboarding)
                                        )
                                    } else {
                                        SecureField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Votre mot de passe")
                                                .foregroundColor(Color.textTertiaryOnboarding)
                                        )
                                    }
                                }
                                .textContentType(.password)
                                .focused($focusedField, equals: .password)
                                .font(.system(size: 16))

                                Button {
                                    withAnimation(.spring(response: 0.2, dampingFraction: 0.6)) {
                                        viewModel.showPassword.toggle()
                                    }
                                } label: {
                                    Image(systemName: viewModel.showPassword ? "eye.slash.fill" : "eye.fill")
                                        .font(.system(size: 16))
                                        .foregroundStyle(Color.textTertiaryOnboarding)
                                        .contentTransition(.symbolEffect(.replace))
                                }
                            }
                            .padding(.horizontal, 18)
                            .frame(height: 54)
                            .background(Color.inputBackgroundSoft)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            .overlay(
                                RoundedRectangle(cornerRadius: 14)
                                    .stroke(
                                        focusedField == .password ? Color.pulpePrimary : Color.clear,
                                        lineWidth: 2
                                    )
                            )
                            .shadow(
                                color: focusedField == .password ? Color.inputFocusGlow : Color.black.opacity(0.04),
                                radius: focusedField == .password ? 8 : 4,
                                y: focusedField == .password ? 2 : 1
                            )
                            .scaleEffect(focusedField == .password ? 1.01 : 1)
                            .animation(.spring(response: 0.3, dampingFraction: 0.7), value: focusedField)
                        }

                        // Login button
                        Button {
                            Task {
                                await login()
                            }
                        } label: {
                            HStack(spacing: 8) {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                        .accessibilityLabel("Connexion en cours")
                                } else {
                                    Text("Se connecter")
                                        .fontWeight(.semibold)
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 14, weight: .semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(viewModel.canSubmit ? Color.onboardingGradient : nil)
                            .background(viewModel.canSubmit ? nil : Color.secondary.opacity(0.3))
                            .foregroundStyle(viewModel.canSubmit ? .white : Color.secondary)
                            .clipShape(RoundedRectangle(cornerRadius: 14))
                            .shadow(
                                color: viewModel.canSubmit ? Color.pulpePrimary.opacity(0.25) : .clear,
                                radius: 8,
                                y: 4
                            )
                        }
                        .disabled(!viewModel.canSubmit)
                        .animation(.easeInOut(duration: 0.2), value: viewModel.canSubmit)
                        .padding(.top, 8)
                    }
                    .padding(24)
                    .background(Color.white)
                    .clipShape(RoundedRectangle(cornerRadius: 24))
                    .shadow(color: Color.black.opacity(0.08), radius: 24, y: 10)
                    .padding(.horizontal, 20)
                    .opacity(isAppeared ? 1 : 0)
                    .offset(y: isAppeared ? 0 : 20)
                    .animation(reduceMotion ? nil : .spring(response: 0.6, dampingFraction: 0.8).delay(0.1), value: isAppeared)

                    // Create account link
                    VStack(spacing: 8) {
                        Text("Nouveau sur Pulpe ?")
                            .font(.system(size: 15))
                            .foregroundStyle(Color.textSecondaryOnboarding)

                        Button {
                            if let isPresented {
                                isPresented.wrappedValue = false
                            } else {
                                OnboardingState.clearPersistedData()
                                appState.hasCompletedOnboarding = false
                            }
                        } label: {
                            Text("Créer un compte")
                                .font(.system(size: 15, weight: .semibold))
                                .foregroundStyle(Color.pulpePrimary)
                        }
                    }
                    .padding(.top, 32)
                    .opacity(isAppeared ? 1 : 0)
                    .animation(reduceMotion ? nil : .easeOut(duration: 0.4).delay(0.2), value: isAppeared)

                    Spacer(minLength: 40)
                }
            }
            .scrollBounceBehavior(.basedOnSize)
            .background(Color.onboardingBackground)
            .toolbar {
                if let isPresented {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") {
                            isPresented.wrappedValue = false
                        }
                        .foregroundStyle(Color.pulpePrimary)
                    }
                }
            }
            .dismissKeyboardOnTap()
            .task {
                canRetryBiometric = await appState.canRetryBiometric()
                if !reduceMotion {
                    try? await Task.sleep(for: .milliseconds(100))
                }
                withAnimation {
                    isAppeared = true
                }
            }
        }
    }

    private var biometricIcon: String {
        switch BiometricService.shared.biometryType {
        case .faceID:
            return "faceid"
        case .touchID:
            return "touchid"
        case .opticID:
            return "opticid"
        default:
            return "lock.fill"
        }
    }

    private func login() async {
        focusedField = nil
        viewModel.isLoading = true
        viewModel.errorMessage = nil

        do {
            try await appState.login(email: viewModel.email, password: viewModel.password)
            isPresented?.wrappedValue = false
        } catch {
            viewModel.errorMessage = AuthErrorLocalizer.localize(error)
            viewModel.isLoading = false
        }
    }
}

@Observable
final class LoginViewModel {
    var email = ""
    var password = ""
    var showPassword = false
    var isLoading = false
    var errorMessage: String?

    var isEmailValid: Bool {
        email.contains("@") && email.contains(".")
    }

    var isPasswordValid: Bool {
        password.count >= 8
    }

    var canSubmit: Bool {
        isEmailValid && isPasswordValid && !isLoading
    }
}

#Preview {
    LoginView()
        .environment(AppState())
}
