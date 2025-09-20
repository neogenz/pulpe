# Pulpe - Project Brief

## What is Pulpe

Pulpe is a personal budget management application designed for the Swiss market. It enables users to plan their financial year using reusable monthly templates, ensuring they always know how much they can spend and how much they'll save.

## Core Philosophy

- **Planning > Tracking** - Plan ahead rather than track after the fact
- **Anticipation > Reaction** - Foresee expenses rather than react to them
- **Serenity > Control** - Achieve peace of mind over obsessive financial tracking
- **Simplicity > Completeness** - Prioritize simplicity over exhaustive features

## Value Proposition

> Pulpe allows users to plan their year with reusable month templates. Users always know how much they can spend and how much they will save.

## How It Works

1. **Templates**: Create reusable budget templates defining typical monthly income, expenses, and savings
2. **Budgets**: Generate monthly budgets from templates for yearly planning
3. **Transactions**: Track actual spending with manual transaction entry
4. **Rollover**: Automatic propagation of surplus or deficit to the following month

## Core Business Model

### Financial Flow Types

- **Income**: Money coming into the monthly budget
- **Expense**: Money going out (living costs, purchases)
- **Saving**: Planned savings treated as expenses to ensure realization

### Key Calculations

- **Available**: Total usable amount (income + rollover from previous month)
- **Remaining**: What's left to spend (available - expenses)
- **Rollover**: Automatic transfer of surplus/deficit to next month

## What Pulpe Does (V1)

**Included Features**:

- Annual planning with reusable templates
- Monthly budget tracking vs. actual spending
- Automatic rollover mechanism between months
- Budget overspending alerts at 80%, 90%, 100%
- Clear distinction between planned (budget lines) and actual (transactions)

**Not Included**:

- Multi-currency support (CHF only)
- Bank account synchronization
- Shared budgets between users
- Advanced transaction categorization
- Automatic recurring transactions
- Long-term financial projections

## Target Users

- **Primary**: Swiss residents with regular monthly income
- **Mindset**: People who prefer planning over reactive tracking
- **Need**: Users seeking simplicity in personal budget management
- **Context**: Single-user budgeting (no family/shared budgets)

## Project Context

- Developed and maintained by a single developer
- Focus on Swiss market and CHF currency
- Emphasis on YAGNI (You Aren't Gonna Need It) and KISS (Keep It Simple, Stupid) principles
- Modern web application with mobile-responsive design
