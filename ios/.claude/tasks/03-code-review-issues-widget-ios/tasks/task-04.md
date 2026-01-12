# Task: Optimize DateFormatter Usage in Budget Model

## Problem

The `Budget` model creates new `DateFormatter` instances inline in computed properties `monthYear` and `shortMonthYear`. DateFormatter is expensive to instantiate, and the codebase already has a `Formatters` enum with cached static formatters.

This causes unnecessary object allocation on every property access, impacting performance especially in list views.

## Proposed Solution

Refactor the computed properties to use the existing static formatters from `Formatters` enum (`Formatters.monthYear` and `Formatters.shortMonthYear`) instead of creating new instances.

## Dependencies

- None (can start immediately)
- Independent of other tasks

## Context

- Key files:
  - `ios/Pulpe/Domain/Models/Budget.swift:20-50` - Inline DateFormatter creation
  - `ios/Pulpe/Shared/Formatters/Formatters.swift:32-44` - Existing cached formatters
- Existing formatters available:
  - `Formatters.monthYear` - "MMMM yyyy" format with fr_FR locale
  - `Formatters.shortMonthYear` - "MMM yyyy" format with fr_FR locale
- Pattern: Create Date from month/year components, then use formatter

## Success Criteria

- `Budget.monthYear` uses `Formatters.monthYear`
- `Budget.shortMonthYear` uses `Formatters.shortMonthYear`
- No inline DateFormatter instantiation in Budget.swift
- Build succeeds
- Budget list views render correctly with formatted dates
