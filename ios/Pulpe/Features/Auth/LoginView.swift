import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()
    @State private var canRetryBiometric = false
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
                    VStack(spacing: 16) {
                        PulpeIcon(size: 72)

                        Text("Pulpe")
                            .font(.largeTitle)
                            .fontWeight(.bold)
                            .foregroundStyle(Color.pulpePrimary)

                        Text("Retrouve ton espace")
                            .font(.subheadline)
                            .foregroundStyle(Color.textSecondaryOnboarding)
                    }
                    .padding(.top, 48)
                    .padding(.bottom, 40)

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
                            Text("Email")
                                .font(.footnote)
                                .fontWeight(.medium)
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            TextField(
                                "",
                                text: $viewModel.email,
                                prompt: Text("nom@exemple.com")
                                    .foregroundColor(Color.textTertiaryOnboarding)
                            )
                            .textContentType(.emailAddress)
                            .keyboardType(.emailAddress)
                            .textInputAutocapitalization(.never)
                            .autocorrectionDisabled()
                            .focused($focusedField, equals: .email)
                            .font(.body)
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        focusedField == .email ? Color.pulpePrimary : Color.clear,
                                        lineWidth: 2
                                    )
                            )
                            .animation(.easeInOut(duration: 0.2), value: focusedField)
                        }

                        // Password field
                        VStack(alignment: .leading, spacing: 8) {
                            Text("Mot de passe")
                                .font(.footnote)
                                .fontWeight(.medium)
                                .foregroundStyle(Color.textSecondaryOnboarding)

                            HStack(spacing: 12) {
                                Group {
                                    if viewModel.showPassword {
                                        TextField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Saisissez votre mot de passe")
                                                .foregroundColor(Color.textTertiaryOnboarding)
                                        )
                                    } else {
                                        SecureField(
                                            "",
                                            text: $viewModel.password,
                                            prompt: Text("Saisissez votre mot de passe")
                                                .foregroundColor(Color.textTertiaryOnboarding)
                                        )
                                    }
                                }
                                .textContentType(.password)
                                .focused($focusedField, equals: .password)
                                .font(.body)

                                Button {
                                    viewModel.showPassword.toggle()
                                } label: {
                                    Image(systemName: viewModel.showPassword ? "eye.slash.fill" : "eye.fill")
                                        .font(.body)
                                        .foregroundStyle(Color.textTertiaryOnboarding)
                                }
                            }
                            .padding(.horizontal, 16)
                            .frame(height: 52)
                            .background(Color(.systemGray6))
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(
                                        focusedField == .password ? Color.pulpePrimary : Color.clear,
                                        lineWidth: 2
                                    )
                            )
                            .animation(.easeInOut(duration: 0.2), value: focusedField)
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
                                } else {
                                    Text("Se connecter")
                                        .fontWeight(.semibold)
                                    Image(systemName: "arrow.right")
                                        .font(.system(size: 14, weight: .semibold))
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .frame(height: 54)
                            .background(
                                viewModel.canSubmit
                                    ? AnyShapeStyle(Color.onboardingGradient)
                                    : AnyShapeStyle(Color.secondary.opacity(0.3))
                            )
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
                    .shadow(color: Color.black.opacity(0.06), radius: 20, y: 8)
                    .padding(.horizontal, 20)

                    // Create account link
                    VStack(spacing: 6) {
                        Text("Nouveau sur Pulpe ?")
                            .font(.subheadline)
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
                                .font(.subheadline)
                                .fontWeight(.semibold)
                                .foregroundStyle(Color.pulpePrimary)
                        }
                    }
                    .padding(.top, 28)

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
