# Task: Fix List Spacing Issues on iOS 26

## Problem Statement
Excessive spacing appears below lists in CurrentMonthView and BudgetDetailsView on iOS 26.

## Root Cause Analysis

### The Current Pattern is an ANTIPATTERN

The codebase uses `List` embedded in `ScrollView` with `.scrollDisabled(true)` and fixed `.frame(height:)`:

```swift
// RecurringExpensesList.swift:67-69
.listStyle(.plain)
.scrollDisabled(true)
.frame(height: CGFloat(items.count) * 76) // Fixed height per row
```

**Apple explicitly recommends AGAINST embedding List in ScrollView** because:
- List already has built-in scrolling (equivalent to UITableView)
- Both views attempting to manage scrolling creates conflicts
- Fixed height calculations don't adapt to iOS version changes

### Why It Breaks on iOS 26

iOS 17+ changed default List spacing behavior. The hardcoded multipliers (76pt, 70pt per row) were calculated for older iOS versions and don't account for:
- New default list row spacing
- New default list container padding
- Changes in `.listStyle(.plain)` behavior

## Key Files

| File | Line | Issue |
|------|------|-------|
| `RecurringExpensesList.swift` | 67-69 | `.scrollDisabled(true)` + `.frame(height: count * 76)` |
| `OneTimeExpensesList.swift` | 60-62 | `.scrollDisabled(true)` + `.frame(height: count * 70)` |
| `CurrentMonthView.swift` | 115-130 | `ScrollView` containing multiple List components |
| `CurrentMonthView.swift` | 191 | `Spacer(minLength: 100)` adds to perceived spacing |
| `BudgetDetailsView.swift` | 38-116 | Same pattern as CurrentMonthView |

## Official Apple Recommendations

### Option A: Use a Single List (Simplest)
Put everything in ONE List with Sections. No ScrollView parent.
- ✅ Native swipe actions work
- ✅ Dynamic height handled automatically
- ✅ Best performance
- ❌ Sticky section headers by default (can't disable in List)

### Option B: Use LazyVStack + Third-Party Swipe Library
Replace List with `ScrollView` > `LazyVStack` and use a swipe library.
- ✅ Full layout control
- ✅ No sticky headers
- ✅ Dynamic height
- ❌ Requires third-party library for swipe actions

## iOS 17+ Modifiers to Use

```swift
// Control content margins (replaces hacky Spacer)
.contentMargins(.vertical, 16, for: .scrollContent)

// Control section spacing in List
.listSectionSpacing(.compact) // or .listSectionSpacing(0)

// Hide system background
.scrollContentBackground(.hidden)

// Reserve space for FAB properly
.safeAreaInset(edge: .bottom) {
    Color.clear.frame(height: 80)
}
```

## Recommended Solution

### For This Codebase: Option A - Single List

Since swipe actions are required and the app targets iOS 17+, use a **single List** for the entire screen:

```swift
List {
    // Hero card as first section (non-sticky)
    Section {
        HeroBalanceCard(...)
    }
    .listRowBackground(Color.clear)
    .listRowSeparator(.hidden)

    // Budget lines sections
    Section {
        ForEach(recurringLines) { line in
            BudgetLineRow(line: line)
                .swipeActions { ... }
        }
    } header: {
        SectionHeader(title: "Dépenses récurrentes", ...)
    }

    // More sections...
}
.listStyle(.plain)
.listSectionSpacing(.compact) // iOS 17+
.scrollContentBackground(.hidden)
.safeAreaInset(edge: .bottom) {
    Color.clear.frame(height: 80) // FAB clearance
}
```

### To Disable Sticky Headers

If sticky headers are unacceptable, the ONLY clean options are:

1. **Put header inside Section content** (not as `header:` parameter) - workaround
2. **Use LazyVStack** with third-party swipe library - proper solution

## Third-Party Swipe Libraries (if needed)

- [SwipeActions](https://github.com/c-villain/SwipeActions) - Works with any view
- [Swipy](https://github.com/rohanrhu/Swipy) - Clean implementation (iOS 15+)
- [SwipeCellSUI](https://github.com/nickstefan/SwipeCellSUI) - Comprehensive

## Decision Required

Before implementing, decide:

1. **Are sticky section headers acceptable?**
   - YES → Use single List with `header:` parameter (cleanest)
   - NO → Use single List with header as first row (workaround) OR LazyVStack + library

2. **Is adding a third-party dependency acceptable?**
   - YES → LazyVStack + SwipeActions library (most flexible)
   - NO → Must use List (with sticky header tradeoff)

## Sources

- [Apple Developer Forums - List in ScrollView](https://developer.apple.com/forums/thread/126898)
- [Apple Docs - scrollDisabled](https://developer.apple.com/documentation/swiftui/view/scrolldisabled(_:))
- [Apple Docs - contentMargins](https://developer.apple.com/documentation/swiftui/view/contentmargins(_:for:))
- [Apple Docs - listSectionSpacing](https://developer.apple.com/documentation/SwiftUI/View/listSectionSpacing(_:))
- [fatbobman - List vs LazyVStack](https://fatbobman.com/en/posts/list-or-lazyvstack/)
