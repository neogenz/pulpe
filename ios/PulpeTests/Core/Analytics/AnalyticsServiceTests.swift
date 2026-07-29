import Foundation
import PostHog
@testable import Pulpe
import Testing

@MainActor
@Suite(.serialized)
struct AnalyticsServiceTests {
    private let sut = AnalyticsService.shared

    // MARK: - Event Naming Convention

    @Test func allEventRawValues_areSnakeCase() {
        let snakeCasePattern = /^[a-z][a-z0-9_]*$/
        for event in AnalyticsEvent.allCases {
            #expect(
                event.rawValue.wholeMatch(of: snakeCasePattern) != nil,
                "\(event) raw value '\(event.rawValue)' is not snake_case"
            )
        }
    }

    @Test func eventRawValues_matchWebConvention() {
        #expect(AnalyticsEvent.appOpened.rawValue == "app_opened")
        #expect(AnalyticsEvent.welcomeScreenViewed.rawValue == "welcome_screen_viewed")
        #expect(AnalyticsEvent.signupStarted.rawValue == "signup_started")
        #expect(AnalyticsEvent.signupCompleted.rawValue == "signup_completed")
        #expect(AnalyticsEvent.onboardingStepCompleted.rawValue == "onboarding_step_completed")
        #expect(AnalyticsEvent.loginCompleted.rawValue == "login_completed")
        #expect(AnalyticsEvent.authSessionObserved.rawValue == "auth_session_observed")
        #expect(AnalyticsEvent.pinSetupCompleted.rawValue == "pin_setup_completed")
        #expect(AnalyticsEvent.budgetCreated.rawValue == "budget_created")
        #expect(AnalyticsEvent.transactionCreated.rawValue == "transaction_created")
        #expect(AnalyticsEvent.tabSwitched.rawValue == "tab_switched")
        #expect(AnalyticsEvent.currencyPersistFailed.rawValue == "currency_persist_failed")
    }

    @Test func authSessionSnapshot_identityChangesBeforeCapture_keepsSignalValues() {
        let signalTimestamp = Date(timeIntervalSince1970: 1_700_000_000)
        var currentDistinctID = "identified-user"
        var currentTimestamp = signalTimestamp

        let snapshot = AnalyticsService.makeAuthSessionDiagnosticSnapshot(
            source: "session_validation",
            outcome: "missing_blob",
            distinctIDProvider: { currentDistinctID },
            now: { currentTimestamp }
        )

        currentDistinctID = "anonymous-after-reset"
        currentTimestamp = signalTimestamp.addingTimeInterval(60)

        #expect(snapshot.distinctID == "identified-user")
        #expect(snapshot.timestamp == signalTimestamp)
    }

    @Test func appContextProperties_matchRuntimeConfiguration() {
        let properties = AnalyticsService.appContextProperties

        #expect(properties["environment"] as? String == AppConfiguration.environment.rawValue)
        #expect(properties["app_version"] as? String == AppConfiguration.appVersion)
        #expect(properties["build_number"] as? String == AppConfiguration.buildNumber)
        #expect(properties["platform"] as? String == "ios")
    }

    // MARK: - Sanitization

    @Test func sanitizeProperties_removesFinancialData() {
        let properties: [String: Any] = [
            "amount": 1500,
            "balance": 3000,
            "income": 5000,
            "savings": 200,
            "total": 9000,
            "ending_balance": 1234,
            "target_amount": 500,
            "available": 800,
            "projection": 1200,
            "rollover": 100,
            "net_income": 4000,
            "expenses_total": 2000,
            "income_total": 6000,
            "savings_total": 1500,
            "budget_amount": 3500,
            "type": "expense",
            "step": "2"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["amount"] == nil)
        #expect(sanitized["balance"] == nil)
        #expect(sanitized["income"] == nil)
        #expect(sanitized["savings"] == nil)
        #expect(sanitized["total"] == nil)
        #expect(sanitized["ending_balance"] == nil)
        #expect(sanitized["target_amount"] == nil)
        #expect(sanitized["available"] == nil)
        #expect(sanitized["projection"] == nil)
        #expect(sanitized["rollover"] == nil)
        #expect(sanitized["net_income"] == nil)
        #expect(sanitized["expenses_total"] == nil)
        #expect(sanitized["income_total"] == nil)
        #expect(sanitized["savings_total"] == nil)
        #expect(sanitized["budget_amount"] == nil)
    }

    @Test func sanitizeProperties_removesCompoundFinancialKeys() {
        let properties: [String: Any] = [
            "total_amount": 9000,
            "current_balance": 3000,
            "monthly_income": 5000,
            "monthly_savings": 200,
            "available_budget": 800,
            "type": "expense"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["total_amount"] == nil)
        #expect(sanitized["current_balance"] == nil)
        #expect(sanitized["monthly_income"] == nil)
        #expect(sanitized["monthly_savings"] == nil)
        #expect(sanitized["available_budget"] == nil)
        #expect(sanitized["type"] as? String == "expense")
    }

    @Test func sanitizeProperties_preservesNonFinancialData() {
        let properties: [String: Any] = [
            "type": "expense",
            "step": "2",
            "method": "email",
            "tab": "budgets",
            "screen_name": "dashboard"
        ]

        let sanitized = AnalyticsService.sanitizeProperties(properties)

        #expect(sanitized["type"] as? String == "expense")
        #expect(sanitized["step"] as? String == "2")
        #expect(sanitized["method"] as? String == "email")
        #expect(sanitized["tab"] as? String == "budgets")
        #expect(sanitized["screen_name"] as? String == "dashboard")
    }

    @Test func sanitizeProperties_emptyInput_returnsEmpty() {
        let sanitized = AnalyticsService.sanitizeProperties([:])
        #expect(sanitized.isEmpty)
    }

    @Test func sanitizeProperties_removesSecretsAndTypedBusinessText() {
        let sanitized = AnalyticsService.sanitizeProperties([
            "recovery_key": "PULPE-SECRET-KEY",
            "access_token": "jwt",
            "label": "Loyer",
            "description": "Texte saisi",
            "safe_state": "completed"
        ])

        #expect(Set(sanitized.keys) == ["safe_state"])
    }

    @Test func sanitizeProperties_recursivelyRemovesSensitiveData() {
        let sanitized = AnalyticsService.sanitizeProperties([
            "metadata": [
                "safe_state": "completed",
                "amount": 1200,
                "label": "Loyer"
            ],
            "steps": [
                [
                    "safe_code": "validated",
                    "access_token": "jwt"
                ],
                [
                    "safe_code": "recovered",
                    "recovery_key": "PULPE-SECRET-KEY"
                ]
            ]
        ])

        let metadata = sanitized["metadata"] as? [String: Any]
        let steps = sanitized["steps"] as? [[String: Any]]

        #expect(metadata?["safe_state"] as? String == "completed")
        #expect(metadata?["amount"] == nil)
        #expect(metadata?["label"] == nil)
        #expect(steps?[0]["safe_code"] as? String == "validated")
        #expect(steps?[0]["access_token"] == nil)
        #expect(steps?[1]["safe_code"] as? String == "recovered")
        #expect(steps?[1]["recovery_key"] == nil)
    }

    @Test func postHogConfig_disablesReplayAndNetworkTelemetry() {
        let config = PostHogConfig(apiKey: "test")

        AnalyticsService.disableSensitiveCapture(in: config)

        #expect(config.sessionReplay == false)
        #expect(config.sessionReplayConfig.captureNetworkTelemetry == false)
    }

    @Test func diagnosticSharing_optOutAndOptInRestoresIdentityAndPreferences() {
        let service = AnalyticsService(isConfiguredEnabled: true)
        let identityProperties: [String: Any] = [
            AnalyticsService.emailProperty: "support@example.com",
            AnalyticsService.nameProperty: "Support",
            AnalyticsService.supabaseUserIdProperty: "support-user"
        ]
        service.initialize()
        service.identify(userId: "support-user", properties: identityProperties)
        service.setPersonProperties([
            AnalyticsService.currencyProperty: "EUR",
            AnalyticsService.showCurrencySelectorProperty: true
        ])
        #expect(service.isIdentified)

        service.setDiagnosticSharingEnabled(false)
        #expect(service.isDiagnosticSharingEnabled == false)
        #expect(service.isEventCapturingEnabled == false)
        #expect(service.isIdentified == false)
        #expect(service.isFeatureEnabled("disabled-flag") == false)

        service.identify(userId: "support-user", properties: identityProperties)
        var reloadCompleted = false
        service.reloadFeatureFlags {
            reloadCompleted = true
        }
        #expect(reloadCompleted)

        service.setDiagnosticSharingEnabled(true)
        #expect(service.isDiagnosticSharingEnabled)
        #expect(service.isEventCapturingEnabled)
        #expect(service.isIdentified)
        #expect(PostHogSDK.shared.getDistinctId() == "support-user")
        #expect(service.currentPersonProperties[AnalyticsService.currencyProperty] as? String == "EUR")
        #expect(
            service.currentPersonProperties[AnalyticsService.showCurrencySelectorProperty]
                as? Bool == true
        )
    }

    // MARK: - Guard Paths (not initialized in test environment)

    @Test func capture_whenNotInitialized_doesNotCrash() {
        sut.capture(.appOpened)
        sut.capture(.budgetCreated, properties: ["type": "expense"])
    }

    @Test func screen_whenNotInitialized_doesNotCrash() {
        sut.screen("TestScreen")
        sut.screen("Dashboard", properties: ["tab": "budgets"])
    }

    @Test func identify_whenNotInitialized_doesNotCrash() {
        sut.identify(userId: "test-user")
        sut.identify(userId: "test-user", properties: ["plan": "free"])
    }

    @Test func reset_whenNotInitialized_doesNotCrash() {
        sut.reset()
    }

    @Test func flush_whenNotInitialized_doesNotCrash() {
        sut.flush()
    }

    @Test func eventCapturing_isDisabledInTestEnvironment() {
        // Test xcconfig fallback sets POSTHOG_ENABLED=false → events gated off,
        // even if SDK initialized with the test API key fallback. Flag reads
        // remain available via `isInitialized`.
        #expect(sut.isEventCapturingEnabled == false)
    }
}
