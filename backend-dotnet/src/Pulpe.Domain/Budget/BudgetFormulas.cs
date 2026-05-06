using Pulpe.Domain.Common;

namespace Pulpe.Domain.Budget;

public record FinancialItem(TransactionKind Kind, decimal Amount, DateTimeOffset? CheckedAt = null);

public record FinancialItemWithId(Guid Id, TransactionKind Kind, decimal Amount, DateTimeOffset? CheckedAt = null, bool IsRollover = false);

public record TransactionWithBudgetLineId(Guid? BudgetLineId, TransactionKind Kind, decimal Amount, DateTimeOffset? CheckedAt = null);

public record BudgetMetrics(
    decimal TotalIncome,
    decimal TotalExpenses,
    decimal TotalSavings,
    decimal Available,
    decimal EndingBalance,
    decimal Remaining,
    decimal Rollover);

public record RolloverResult(decimal EndingBalance, decimal Rollover, decimal AvailableToSpend, Guid? PreviousBudgetId);

public static class BudgetFormulas
{
    private const decimal Epsilon = 0.01m;

    public static bool IsOutflowKind(TransactionKind kind) =>
        kind == TransactionKind.Expense || kind == TransactionKind.Saving;

    private static Dictionary<Guid, List<TransactionWithBudgetLineId>> IndexByLineId(
        IEnumerable<TransactionWithBudgetLineId> transactions)
    {
        var map = new Dictionary<Guid, List<TransactionWithBudgetLineId>>();
        foreach (var tx in transactions)
        {
            var key = tx.BudgetLineId ?? Guid.Empty;
            if (!map.ContainsKey(key))
                map[key] = new List<TransactionWithBudgetLineId>();
            map[key].Add(tx);
        }
        return map;
    }

    private static decimal CalculateEnvelopeTotal(
        IEnumerable<FinancialItemWithId> budgetLines,
        Dictionary<Guid, List<TransactionWithBudgetLineId>> txsByLineId,
        Func<TransactionKind, bool> kindFilter)
    {
        var total = 0m;

        foreach (var line in budgetLines)
        {
            if (!kindFilter(line.Kind)) continue;
            var consumed = (txsByLineId.TryGetValue(line.Id, out var lineTxs) ? lineTxs : new())
                .Where(tx => kindFilter(tx.Kind))
                .Sum(tx => tx.Amount);
            total += Math.Max(line.Amount, consumed);
        }

        if (txsByLineId.TryGetValue(Guid.Empty, out var freeTxs))
        {
            foreach (var tx in freeTxs)
            {
                if (kindFilter(tx.Kind))
                    total += tx.Amount;
            }
        }

        return total;
    }

    public static decimal CalculateTotalIncome(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        return CalculateEnvelopeTotal(
            budgetLines,
            IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>()),
            kind => kind == TransactionKind.Income);
    }

    public static decimal CalculateTotalExpenses(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        return CalculateEnvelopeTotal(
            budgetLines,
            IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>()),
            IsOutflowKind);
    }

    public static decimal CalculateTotalSavings(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        return CalculateEnvelopeTotal(
            budgetLines,
            IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>()),
            kind => kind == TransactionKind.Saving);
    }

    public static decimal CalculateTotalExpenseOnly(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        return CalculateEnvelopeTotal(
            budgetLines,
            IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>()),
            kind => kind == TransactionKind.Expense);
    }

    public static decimal CalculateRealizedIncome(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        var checkedBudgetIncome = budgetLines
            .Where(line => line.CheckedAt != null && line.Kind == TransactionKind.Income)
            .Sum(line => line.Amount);

        var checkedTransactionIncome = (transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>())
            .Where(t => t.CheckedAt != null && t.Kind == TransactionKind.Income)
            .Sum(t => t.Amount);

        return checkedBudgetIncome + checkedTransactionIncome;
    }

    public static decimal CalculateRealizedExpenses(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        var txsByLineId = IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>());
        var total = 0m;

        foreach (var line in budgetLines)
        {
            if (!IsOutflowKind(line.Kind)) continue;

            var consumed = (txsByLineId.TryGetValue(line.Id, out var lineTxs) ? lineTxs : new())
                .Where(tx => tx.CheckedAt != null && IsOutflowKind(tx.Kind))
                .Sum(tx => tx.Amount);

            if (line.CheckedAt != null)
                total += Math.Max(line.Amount, consumed);
            else
                total += consumed;
        }

        if (txsByLineId.TryGetValue(Guid.Empty, out var freeTxs))
        {
            foreach (var tx in freeTxs)
            {
                if (tx.CheckedAt != null && IsOutflowKind(tx.Kind))
                    total += tx.Amount;
            }
        }

        return total;
    }

    public static decimal CalculateRealizedBalance(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null)
    {
        var lines = budgetLines.ToList();
        var txs = transactions?.ToList();
        return CalculateRealizedIncome(lines, txs) - CalculateRealizedExpenses(lines, txs);
    }

    public static decimal CalculateAvailable(decimal totalIncome, decimal rollover) =>
        totalIncome + rollover;

    public static decimal CalculateEndingBalance(decimal available, decimal totalExpenses) =>
        available - totalExpenses;

    public static decimal CalculateRemaining(decimal available, decimal totalExpenses) =>
        CalculateEndingBalance(available, totalExpenses);

    public static BudgetMetrics CalculateAllMetrics(
        IEnumerable<FinancialItemWithId> budgetLines,
        IEnumerable<TransactionWithBudgetLineId>? transactions = null,
        decimal rollover = 0m)
    {
        var lines = budgetLines.ToList();
        var txsByLineId = IndexByLineId(transactions ?? Enumerable.Empty<TransactionWithBudgetLineId>());

        var totalIncome = CalculateEnvelopeTotal(lines, txsByLineId, kind => kind == TransactionKind.Income);
        var totalExpenses = CalculateEnvelopeTotal(lines, txsByLineId, IsOutflowKind);
        var totalSavings = CalculateEnvelopeTotal(lines, txsByLineId, kind => kind == TransactionKind.Saving);
        var available = CalculateAvailable(totalIncome, rollover);
        var endingBalance = CalculateEndingBalance(available, totalExpenses);

        return new BudgetMetrics(
            TotalIncome: totalIncome,
            TotalExpenses: totalExpenses,
            TotalSavings: totalSavings,
            Available: available,
            EndingBalance: endingBalance,
            Remaining: endingBalance,
            Rollover: rollover);
    }

    public static RolloverResult CalculateRollover(
        IEnumerable<(Guid Id, int Month, int Year, decimal? EndingBalance)> budgets,
        Guid targetBudgetId,
        int payDayOfMonth = 1)
    {
        var payDay = Math.Max(1, Math.Min(31, payDayOfMonth));

        var budgetsWithSortDate = budgets
            .Select(b => (
                b.Id,
                b.Month,
                b.Year,
                EndingBalance: b.EndingBalance ?? 0m,
                SortDate: CalculateBudgetStartDate(b.Year, b.Month, payDay)))
            .OrderBy(b => b.SortDate)
            .ToList();

        var targetIndex = budgetsWithSortDate.FindIndex(b => b.Id == targetBudgetId);
        if (targetIndex == -1)
            return new RolloverResult(0m, 0m, 0m, null);

        var target = budgetsWithSortDate[targetIndex];

        var rollover = 0m;
        for (var i = 0; i < targetIndex; i++)
            rollover += budgetsWithSortDate[i].EndingBalance;

        var availableToSpend = 0m;
        for (var i = 0; i <= targetIndex; i++)
            availableToSpend += budgetsWithSortDate[i].EndingBalance;

        Guid? previousBudgetId = targetIndex > 0 ? budgetsWithSortDate[targetIndex - 1].Id : null;

        return new RolloverResult(target.EndingBalance, rollover, availableToSpend, previousBudgetId);
    }

    private static DateTime CalculateBudgetStartDate(int year, int month, int payDay)
    {
        if (payDay <= 15)
        {
            var lastDayOfMonth = DateTime.DaysInMonth(year, month);
            var clampedDay = Math.Min(payDay, lastDayOfMonth);
            return new DateTime(year, month, clampedDay);
        }

        var prevMonth = month == 1 ? 12 : month - 1;
        var prevYear = month == 1 ? year - 1 : year;
        var lastDayOfPrevMonth = DateTime.DaysInMonth(prevYear, prevMonth);
        var clampedPrevDay = Math.Min(payDay, lastDayOfPrevMonth);
        return new DateTime(prevYear, prevMonth, clampedPrevDay);
    }

    public static bool ValidateMetricsCoherence(BudgetMetrics metrics)
    {
        if (metrics.TotalIncome < 0) return false;
        if (metrics.TotalExpenses < 0) return false;

        var expectedAvailable = metrics.TotalIncome + metrics.Rollover;
        if (Math.Abs(metrics.Available - expectedAvailable) > Epsilon) return false;

        var expectedEndingBalance = metrics.Available - metrics.TotalExpenses;
        if (Math.Abs(metrics.EndingBalance - expectedEndingBalance) > Epsilon) return false;

        if (Math.Abs(metrics.Remaining - metrics.EndingBalance) > Epsilon) return false;

        return true;
    }
}
