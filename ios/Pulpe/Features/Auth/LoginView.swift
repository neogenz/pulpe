import SwiftUI

struct LoginView: View {
    @Environment(AppState.self) private var appState
    @State private var viewModel = LoginViewModel()
    @State private var canRetryBiometric = false

    var isPresented: Binding<Bool>?

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 32) {
                    // Logo and title
                    VStack(spacing: 16) {
                        PulpeLogo(size: 80)

                        Text("Connexion")
                            .font(.largeTitle)
                            .fontWeight(.bold)

                        Text("Accédez à votre espace personnel")
                            .font(.subheadline)
                            .foregroundStyle(.secondary)
                    }
                    .padding(.top, 40)

                    // Error message
                    if let errorMessage = viewModel.errorMessage {
                        HStack(spacing: 8) {
                            Image(systemName: "exclamationmark.circle.fill")
                            Text(errorMessage)
                                .multilineTextAlignment(.leading)
                        }
                        .font(.subheadline)
                        .foregroundStyle(.white)
                        .padding()
                        .frame(maxWidth: .infinity, alignment: .leading)
                        .background(.red, in: RoundedRectangle(cornerRadius: 12))
                        .padding(.horizontal)
                    }

                    // Biometric retry button
                    if canRetryBiometric {
                        VStack(spacing: 16) {
                            Button {
                                Task {
                                    await appState.retryBiometricLogin()
                                }
                            } label: {
                                HStack(spacing: 12) {
                                    Image(systemName: biometricIcon)
                                        .font(.title2)
                                    Text("Se connecter avec \(BiometricService.shared.biometryDisplayName)")
                                }
                                .frame(maxWidth: .infinity)
                                .padding()
                                .background(Color.accentColor)
                                .foregroundStyle(.white)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                            }
                            .padding(.horizontal)

                            // Separator
                            HStack {
                                Rectangle()
                                    .fill(Color.inputBorder)
                                    .frame(height: 1)
                                Text("ou")
                                    .font(.subheadline)
                                    .foregroundStyle(.secondary)
                                Rectangle()
                                    .fill(Color.inputBorder)
                                    .frame(height: 1)
                            }
                            .padding(.horizontal)
                        }
                    }

                    // Form
                    VStack(spacing: 16) {
                        // Email field
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Email")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            TextField("votre@email.com", text: $viewModel.email)
                                .textContentType(.emailAddress)
                                .keyboardType(.emailAddress)
                                .textInputAutocapitalization(.never)
                                .autocorrectionDisabled()
                                .padding()
                                .background(.background)
                                .clipShape(RoundedRectangle(cornerRadius: 12))
                                .overlay(
                                    RoundedRectangle(cornerRadius: 12)
                                        .stroke(Color.inputBorder, lineWidth: 1)
                                )
                        }

                        // Password field
                        VStack(alignment: .leading, spacing: 4) {
                            Text("Mot de passe")
                                .font(.subheadline)
                                .foregroundStyle(.secondary)

                            HStack {
                                if viewModel.showPassword {
                                    TextField("Mot de passe", text: $viewModel.password)
                                } else {
                                    SecureField("Mot de passe", text: $viewModel.password)
                                }

                                Button {
                                    viewModel.showPassword.toggle()
                                } label: {
                                    Image(systemName: viewModel.showPassword ? "eye.slash" : "eye")
                                        .foregroundStyle(.secondary)
                                }
                            }
                            .textContentType(.password)
                            .padding()
                            .background(.background)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                            .overlay(
                                RoundedRectangle(cornerRadius: 12)
                                    .stroke(Color.inputBorder, lineWidth: 1)
                            )
                        }

                        // Login button
                        Button {
                            Task {
                                await login()
                            }
                        } label: {
                            HStack {
                                if viewModel.isLoading {
                                    ProgressView()
                                        .tint(.white)
                                } else {
                                    Text("Se connecter")
                                }
                            }
                            .frame(maxWidth: .infinity)
                            .padding()
                            .background(viewModel.canSubmit ? Color.accentColor : Color.secondary)
                            .foregroundStyle(.white)
                            .clipShape(RoundedRectangle(cornerRadius: 12))
                        }
                        .disabled(!viewModel.canSubmit)
                    }
                    .padding(.horizontal)

                    // Create account link
                    VStack(spacing: 8) {
                        Text("Nouveau sur Pulpe ?")
                            .foregroundStyle(.secondary)

                        Button("Créer un compte") {
                            if let isPresented {
                                isPresented.wrappedValue = false
                            } else {
                                OnboardingState.clearPersistedData()
                                appState.hasCompletedOnboarding = false
                            }
                        }
                        .fontWeight(.medium)
                    }
                    .font(.subheadline)

                    Spacer()
                }
                .padding()
            }
            .background(Color(.systemGroupedBackground))
            .toolbar {
                if let isPresented {
                    ToolbarItem(placement: .cancellationAction) {
                        Button("Annuler") {
                            isPresented.wrappedValue = false
                        }
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
