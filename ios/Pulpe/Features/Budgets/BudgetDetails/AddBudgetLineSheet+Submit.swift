import SwiftUI

// MARK: - Logic

extension AddBudgetLineSheet {
    /// Routes to the withdrawal, spread, or single-line flow.
    func submit() async {
        if isSavingsWithdrawalMode {
            routeToSavingsWithdrawal()
        } else if isSpreadMode {
            await addSpread()
        } else {
            await addBudgetLine()
        }
    }

    /// Hands a prefilled withdrawal intent to the router (PUL-292).
    func routeToSavingsWithdrawal() {
        guard let amount, amount > 0 else { return }
        let trimmed = name.trimmingCharacters(in: .whitespaces)
        onRequestSavingsWithdrawal?(
            SavingsWithdrawalPrefill(
                budgetId: budgetId,
                anchorMonth: anchorMonth,
                anchorYear: anchorYear,
                amount: amount,
                inputCurrency: inputCurrency,
                source: trimmed.isEmpty ? nil : trimmed,
                startsAtPreview: true
            )
        )
    }

    func addBudgetLine() async {
        guard let amount else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )

            let data = BudgetLineCreate(
                budgetId: budgetId,
                name: name.trimmingCharacters(in: .whitespaces),
                amount: conversion?.convertedAmount ?? amount,
                kind: kind,
                recurrence: .oneOff,
                savingsGoalId: kind.savingsGoalLink(savingsGoalId),
                checkedAt: isChecked ? Date() : nil,
                originalAmount: conversion?.originalAmount,
                originalCurrency: conversion?.originalCurrency,
                targetCurrency: conversion?.targetCurrency,
                exchangeRate: conversion?.exchangeRate,
                tagIds: TagPickerField.createdTagIds(from: selectedTagIds)
            )

            let budgetLine = try await dependencies.createBudgetLine(data)
            submitSuccessTrigger.toggle()
            onAdd(budgetLine)
            toastManager.show("Prévision ajoutée")
            dismiss()
        } catch {
            self.error = error
        }
    }

    /// Fans the per-month amount over every SELECTED month (PUL-17, interp. B).
    /// FX frozen once (one shared `exchangeRate`). Cross-budget caches are
    /// invalidated OUTSIDE any coordinator (a spread touches N months it doesn't
    /// own); the occurrence in the open budget is fed back via `onAdd`.
    func addSpread() async {
        guard let amount, spreadCalculator.isValid else { return }

        isLoading = true
        defer { isLoading = false }
        error = nil

        do {
            let conversion = try await conversionService.convert(
                amount: amount,
                from: inputCurrency,
                to: userSettingsStore.currency
            )
            let data = AddBudgetLineSpreadLogic.buildCreate(
                calculator: spreadCalculator,
                input: AddBudgetLineSpreadLogic.SubmitInput(
                    name: name,
                    kind: kind,
                    amount: amount,
                    mode: amountMode,
                    conversion: conversion,
                    spreadGroupId: spreadGroupId,
                    savingsGoalId: savingsGoalId
                )
            )

            let response = try await dependencies.createSpread(data)

            // Refresh the active screen via the single-line `onAdd` seam when an
            // occurrence landed in the open budget (PUL-270).
            if let openLine = response.lines.first(where: { $0.budgetId == budgetId }) {
                onAdd(openLine)
            }

            // Cross-budget invalidation OUTSIDE the coordinator, for the OTHER
            // months it doesn't own (PUL-17).
            dependencies.invalidateCrossBudgetCaches(budgetListStore)

            submitSuccessTrigger.toggle()
            toastManager.show(AddBudgetLineSpreadLogic.successMessage(for: response))
            dismiss()
        } catch {
            self.error = error
        }
    }
}
