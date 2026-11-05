import SwiftUI

/// What the movement sheet sends: the conversion preview, the creation, the edit.
extension MovementSheet {
    /// Keeps the previews on the amount the backend will actually book. The rate is cached
    /// for a day, so retyping does not hit the network.
    func refreshConvertedAmount() async {
        guard let amount, amount > 0 else {
            convertedAmount = nil
            hasConversionFailed = false
            return
        }
        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            convertedAmount = conversion?.convertedAmount ?? amount
            hasConversionFailed = false
        } catch {
            // No rate, no trustworthy comparison — the goal picker stays blocked and says so.
            convertedAmount = nil
            hasConversionFailed = true
        }
    }

    /// Copies the announced withdrawal into the form ONCE. Re-running it after a refused
    /// submit would overwrite what the user just corrected.
    func prefillRealization() async {
        guard let realization, !didPrefillRealization else { return }
        didPrefillRealization = true
        name = realization.name
        isChecked = true
        if let remaining = realization.remainingAmount {
            amount = remaining
            amountText = "\(remaining)"
        }
        await refreshConfirmedBalance()
    }

    /// The goal balance shown next to the entry. Re-read after a refusal too: the figure the
    /// user was typing against is provably stale by then.
    func refreshConfirmedBalance() async {
        guard case .active(let goalId, _)? = realization?.goalSource else { return }
        confirmedBalance = try? await savingsGoalStore.getProgress(id: goalId).confirmed
    }

    func submit() async {
        guard let amount else { return }
        if let tx = context.editing {
            await save(tx, amount: amount)
            return
        }
        if routesToWithdrawal {
            let trimmed = name.trimmingCharacters(in: .whitespaces)
            onRequestSavingsWithdrawal?(amount, inputCurrency, trimmed.isEmpty ? nil : trimmed)
            dismiss()
            return
        }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let data = TransactionCreate(
                budgetId: context.budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                budgetLineId: selectedLineId,
                transactionDate: transactionDate,
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate,
                tagIds: TagPickerField.createdTagIds(from: selectedTagIds),
                sourceSavingsGoalId: savingsOriginRule.sourceSavingsGoalId
            )

            let transaction = try await dependencies.createTransaction(data)
            if data.sourceSavingsGoalId != nil { savingsGoalStore.invalidateFromBudgetMutation() }
            FirstTransactionTracker.shared.recordCreated(kind: kind, source: context.source)
            submitSuccessTrigger.toggle()
            onAdd(transaction)
            toastManager.show(AppLocale.string("Enregistré"))
            dismiss()
        } catch {
            self.error = error
            // A refused balance is provably stale: re-read the options in place, keeping every
            // input so the user only re-confirms.
            if let apiError = error as? APIError, apiError.requiresWithdrawalOptionsRefresh {
                withdrawalRefreshToken += 1
            }
            await refreshConfirmedBalance()
        }
    }

    private func save(_ tx: Transaction, amount: Decimal) async {
        guard let editActions else { return }
        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let isAlternateCurrency = EditTransactionLogic.shouldShowAlternateCurrency(
                for: tx,
                userCurrency: userSettingsStore.currency
            )
            let conversion = isAlternateCurrency
                ? try await conversionService.convert(
                    amount: amount,
                    from: inputCurrency,
                    to: userSettingsStore.currency
                )
                : nil
            let data = EditTransactionLogic.buildUpdate(
                name: name.trimmingCharacters(in: .whitespaces),
                amount: amount,
                kind: kind,
                transactionDate: transactionDate,
                conversion: conversion,
                tagIds: TagPickerField.updatedTagIds(initial: initialTagIds, current: selectedTagIds)
            )
            try await editActions.save(tx.id, data)
            submitSuccessTrigger.toggle()
            toastManager.show(AppLocale.string("Modifié"))
            dismiss()
        } catch {
            self.error = error
        }
    }
}
