import Foundation

@Observable @MainActor
final class UserSettingsStore: StoreProtocol {
    // MARK: - State

    private(set) var payDayOfMonth: Int?
    private(set) var currency: SupportedCurrency = .chf
    private(set) var showCurrencySelector = false

    /// Seeded from the persisted snapshot so the first frame paints in the user's language,
    /// before the settings request answers.
    private(set) var locale: SupportedLocale = AppLocale.current
    private(set) var isLoading = false
    private(set) var error: APIError?

    var hasError: Bool {
        error != nil
    }

    // MARK: - Cache Metadata

    private var lastLoadTime: Date?

    /// Coalescing task to prevent concurrent API loads
    private var loadTask: Task<Void, Never>?
    /// Generation counter to safely nil loadTask after completion
    private var loadGeneration = 0

    // MARK: - Services

    private let service: any UserSettingsServicing

    // MARK: - Initialization

    init(service: any UserSettingsServicing = UserSettingsService.shared) {
        self.service = service
    }

    // MARK: - Smart Loading (StoreProtocol)

    func loadIfNeeded() async {
        if let lastLoad = lastLoadTime,
           Date().timeIntervalSince(lastLoad) < AppConfiguration.shortCacheValidity {
            return
        }
        await forceRefresh()
    }

    func forceRefresh() async {
        loadTask?.cancel()

        loadGeneration += 1
        let currentGeneration = loadGeneration

        let task = Task(name: "UserSettings.load") {
            isLoading = true
            error = nil
            defer { isLoading = false }

            do {
                let settings = try await service.getSettings()

                try Task.checkCancellation()

                payDayOfMonth = settings.payDayOfMonth
                currency = settings.currency ?? .chf
                showCurrencySelector = settings.showCurrencySelector ?? false
                if let serverLocale = settings.locale {
                    applyLocale(serverLocale)
                } else {
                    // No server preference yet: keep the boot resolution (snapshot or
                    // device detection) published, but don't persist it — a detection
                    // frozen into the snapshot would outlive a later device-language
                    // change. Mirrors the webapp's `?? fallbackLocale` computed.
                    locale = AppLocale.current
                }
                lastLoadTime = Date()
            } catch is CancellationError {
                // Task was cancelled, don't update error state
            } catch let apiError as APIError {
                self.error = apiError
            } catch {
                self.error = .networkError(error)
            }
        }

        loadTask = task
        await task.value
        if loadGeneration == currentGeneration { loadTask = nil }
    }

    /// Invalidates the cache so the next `loadIfNeeded()` will re-fetch.
    func invalidateCache() {
        lastLoadTime = nil
    }

    func reset() {
        loadTask?.cancel()
        loadTask = nil
        loadGeneration = 0
        payDayOfMonth = nil
        currency = .chf
        showCurrencySelector = false
        // Clear rather than default: the next account must not inherit this one's language
        // for the seconds between launch and the first settings response. With the
        // snapshot gone, `current` resolves from device detection, like a fresh install.
        AppLocale.clearPersisted()
        locale = AppLocale.current
        lastLoadTime = nil
        error = nil
    }

    // MARK: - Mutations

    func updateCurrency(_ newCurrency: SupportedCurrency) async {
        let previousValue = currency
        error = nil

        // Optimistic update
        currency = newCurrency

        do {
            let updated = try await service.updateSettings(UpdateUserSettings(currency: newCurrency))
            // Backend may return a partial settings payload without `currency`; keep the value we
            // just persisted instead of falling back to `.chf` (would snap the UI back on EUR, etc.).
            currency = updated.currency ?? newCurrency
            lastLoadTime = Date()
        } catch let apiError as APIError {
            currency = previousValue
            self.error = apiError
        } catch {
            currency = previousValue
            self.error = .networkError(error)
        }
    }

    func updateLocale(_ newLocale: SupportedLocale) async {
        let previousValue = locale
        error = nil

        // Optimistic update — the interface switches on this line, not on the response.
        applyLocale(newLocale)

        do {
            let updated = try await service.updateSettings(UpdateUserSettings(locale: newLocale))
            // Backend may return a partial settings payload without `locale`; keep the value we
            // just persisted instead of falling back to French and snapping the UI back.
            applyLocale(updated.locale ?? newLocale)
            lastLoadTime = Date()
        } catch let apiError as APIError {
            applyLocale(previousValue)
            self.error = apiError
        } catch {
            applyLocale(previousValue)
            self.error = .networkError(error)
        }
    }

    /// Publishing and persisting are one act: `AppLocale.current` backs every formatter and
    /// every out-of-tree lookup, so a published value it has not caught up with renders half
    /// the screen in the old language.
    private func applyLocale(_ newLocale: SupportedLocale) {
        locale = newLocale
        AppLocale.persist(newLocale)
    }

    func updateShowCurrencySelector(_ newValue: Bool) async {
        let previousValue = showCurrencySelector
        error = nil

        // Optimistic update
        showCurrencySelector = newValue

        do {
            let updated = try await service.updateSettings(
                UpdateUserSettings(showCurrencySelector: newValue)
            )
            // Backend may omit the field on partial responses; keep the value we just persisted.
            showCurrencySelector = updated.showCurrencySelector ?? newValue
            lastLoadTime = Date()
        } catch let apiError as APIError {
            showCurrencySelector = previousValue
            self.error = apiError
        } catch {
            showCurrencySelector = previousValue
            self.error = .networkError(error)
        }
    }

    func updatePayDay(_ day: Int?) async {
        if let day, !(1...31).contains(day) { return }

        let previousValue = payDayOfMonth
        error = nil

        // Optimistic update
        payDayOfMonth = day

        do {
            let updated = try await service.updateSettings(UpdateUserSettings(payDayOfMonth: day))
            payDayOfMonth = updated.payDayOfMonth
            lastLoadTime = Date()
        } catch let apiError as APIError {
            payDayOfMonth = previousValue
            self.error = apiError
        } catch {
            payDayOfMonth = previousValue
            self.error = .networkError(error)
        }
    }
}
