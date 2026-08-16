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
    /// Only the latest optimistic locale mutation may publish its completion.
    private var localeUpdateGeneration = 0
    /// Serializes locale writes so the latest choice is also the last PUT sent.
    private var localeUpdateTask: Task<SupportedLocale, Never>?

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
        while let pendingLocaleUpdate = localeUpdateTask {
            let pendingGeneration = localeUpdateGeneration
            _ = await pendingLocaleUpdate.value
            if localeUpdateGeneration == pendingGeneration { break }
        }

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
        localeUpdateGeneration += 1
        localeUpdateTask?.cancel()
        localeUpdateTask = nil
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
        loadTask?.cancel()
        loadTask = nil
        loadGeneration += 1

        localeUpdateGeneration += 1
        let currentGeneration = localeUpdateGeneration
        let previousValue = locale
        error = nil

        // Optimistic update — the interface switches on this line, not on the response.
        applyLocale(newLocale)

        let previousTask = localeUpdateTask
        let task = Task(name: "UserSettings.updateLocale") {
            let confirmedLocale = await previousTask?.value ?? previousValue
            guard !Task.isCancelled else { return confirmedLocale }

            do {
                let updated = try await service.updateSettings(UpdateUserSettings(locale: newLocale))
                let persistedLocale = updated.locale ?? newLocale
                guard localeUpdateGeneration == currentGeneration else { return persistedLocale }
                // Backend may return a partial settings payload without `locale`; keep the value we
                // just persisted instead of falling back to French and snapping the UI back.
                applyLocale(persistedLocale)
                lastLoadTime = nil
                return persistedLocale
            } catch let apiError as APIError {
                guard localeUpdateGeneration == currentGeneration else { return confirmedLocale }
                applyLocale(confirmedLocale)
                self.error = apiError
                return confirmedLocale
            } catch {
                guard localeUpdateGeneration == currentGeneration else { return confirmedLocale }
                applyLocale(confirmedLocale)
                self.error = .networkError(error)
                return confirmedLocale
            }
        }

        localeUpdateTask = task
        _ = await task.value
        if localeUpdateGeneration == currentGeneration { localeUpdateTask = nil }
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
