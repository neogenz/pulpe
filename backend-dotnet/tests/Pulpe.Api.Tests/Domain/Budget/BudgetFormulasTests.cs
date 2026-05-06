using FluentAssertions;
using Pulpe.Domain.Budget;
using Pulpe.Domain.Common;

namespace Pulpe.Api.Tests.Domain.Budget;

public class BudgetFormulasTests
{
    private static FinancialItemWithId Line(TransactionKind kind, decimal amount, DateTimeOffset? checkedAt = null) =>
        new(Guid.NewGuid(), kind, amount, checkedAt);

    private static TransactionWithBudgetLineId FreeTx(TransactionKind kind, decimal amount, DateTimeOffset? checkedAt = null) =>
        new(null, kind, amount, checkedAt);

    private static TransactionWithBudgetLineId LinkedTx(Guid lineId, TransactionKind kind, decimal amount, DateTimeOffset? checkedAt = null) =>
        new(lineId, kind, amount, checkedAt);

    // --- CalculateTotalIncome ---

    [Fact]
    public void CalculateTotalIncome_NoLines_ReturnsZero()
    {
        var result = BudgetFormulas.CalculateTotalIncome(Array.Empty<FinancialItemWithId>());
        result.Should().Be(0m);
    }

    [Fact]
    public void CalculateTotalIncome_IncomeLineOnly_ReturnsLineAmount()
    {
        var lines = new[] { Line(TransactionKind.Income, 3000m) };
        var result = BudgetFormulas.CalculateTotalIncome(lines);
        result.Should().Be(3000m);
    }

    [Fact]
    public void CalculateTotalIncome_ExpenseLinesIgnored()
    {
        var lines = new[]
        {
            Line(TransactionKind.Income, 3000m),
            Line(TransactionKind.Expense, 500m),
            Line(TransactionKind.Saving, 200m)
        };
        var result = BudgetFormulas.CalculateTotalIncome(lines);
        result.Should().Be(3000m);
    }

    // When a transaction exceeds the line amount, use the transaction sum
    [Fact]
    public void CalculateTotalIncome_TransactionExceedsLine_UsesTransactionSum()
    {
        var lineId = Guid.NewGuid();
        var line = new FinancialItemWithId(lineId, TransactionKind.Income, 1000m);
        var tx = LinkedTx(lineId, TransactionKind.Income, 1500m);

        var result = BudgetFormulas.CalculateTotalIncome(new[] { line }, new[] { tx });
        result.Should().Be(1500m);
    }

    // Free transaction (no budget line) adds directly
    [Fact]
    public void CalculateTotalIncome_FreeTransaction_AddsToTotal()
    {
        var lines = new[] { Line(TransactionKind.Income, 1000m) };
        var tx = FreeTx(TransactionKind.Income, 500m);

        var result = BudgetFormulas.CalculateTotalIncome(lines, new[] { tx });
        result.Should().Be(1500m);
    }

    // --- CalculateTotalExpenses ---

    [Fact]
    public void CalculateTotalExpenses_ExpenseAndSaving_SumsOutflow()
    {
        var lines = new[]
        {
            Line(TransactionKind.Expense, 400m),
            Line(TransactionKind.Saving, 200m),
            Line(TransactionKind.Income, 3000m)
        };
        var result = BudgetFormulas.CalculateTotalExpenses(lines);
        result.Should().Be(600m);
    }

    // --- CalculateAllMetrics ---

    [Fact]
    public void CalculateAllMetrics_BasicScenario_CalculatesCorrectly()
    {
        var lines = new[]
        {
            Line(TransactionKind.Income, 3000m),
            Line(TransactionKind.Expense, 1000m),
            Line(TransactionKind.Saving, 500m)
        };

        var metrics = BudgetFormulas.CalculateAllMetrics(lines);

        metrics.TotalIncome.Should().Be(3000m);
        metrics.TotalExpenses.Should().Be(1500m);
        metrics.TotalSavings.Should().Be(500m);
        metrics.Available.Should().Be(3000m); // income + 0 rollover
        metrics.EndingBalance.Should().Be(1500m); // 3000 - 1500
        metrics.Remaining.Should().Be(metrics.EndingBalance);
    }

    [Fact]
    public void CalculateAllMetrics_WithRollover_AddsToAvailable()
    {
        var lines = new[] { Line(TransactionKind.Income, 2000m) };

        var metrics = BudgetFormulas.CalculateAllMetrics(lines, rollover: 300m);

        metrics.Available.Should().Be(2300m);
        metrics.Rollover.Should().Be(300m);
    }

    [Fact]
    public void CalculateAllMetrics_EmptyBudget_AllZero()
    {
        var metrics = BudgetFormulas.CalculateAllMetrics(Array.Empty<FinancialItemWithId>());

        metrics.TotalIncome.Should().Be(0m);
        metrics.TotalExpenses.Should().Be(0m);
        metrics.EndingBalance.Should().Be(0m);
    }

    // --- ValidateMetricsCoherence ---

    [Fact]
    public void ValidateMetricsCoherence_ValidMetrics_ReturnsTrue()
    {
        var metrics = new BudgetMetrics(
            TotalIncome: 3000m,
            TotalExpenses: 1500m,
            TotalSavings: 500m,
            Available: 3000m,
            EndingBalance: 1500m,
            Remaining: 1500m,
            Rollover: 0m);

        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeTrue();
    }

    [Fact]
    public void ValidateMetricsCoherence_NegativeIncome_ReturnsFalse()
    {
        var metrics = new BudgetMetrics(-1m, 0m, 0m, -1m, -1m, -1m, 0m);
        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeFalse();
    }

    [Fact]
    public void ValidateMetricsCoherence_NegativeExpenses_ReturnsFalse()
    {
        var metrics = new BudgetMetrics(0m, -1m, 0m, 0m, 1m, 1m, 0m);
        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeFalse();
    }

    [Fact]
    public void ValidateMetricsCoherence_WrongAvailable_ReturnsFalse()
    {
        // Available should be TotalIncome + Rollover = 3000 + 0 = 3000, but we set 2999
        var metrics = new BudgetMetrics(3000m, 1500m, 500m, 2999m, 1499m, 1499m, 0m);
        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeFalse();
    }

    [Fact]
    public void ValidateMetricsCoherence_WrongEndingBalance_ReturnsFalse()
    {
        // Available=3000, TotalExpenses=1500, so EndingBalance should be 1500, not 1000
        var metrics = new BudgetMetrics(3000m, 1500m, 500m, 3000m, 1000m, 1000m, 0m);
        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeFalse();
    }

    [Fact]
    public void ValidateMetricsCoherence_RemainingMismatch_ReturnsFalse()
    {
        // Remaining must equal EndingBalance
        var metrics = new BudgetMetrics(3000m, 1500m, 500m, 3000m, 1500m, 999m, 0m);
        BudgetFormulas.ValidateMetricsCoherence(metrics).Should().BeFalse();
    }

    // --- CalculateRollover ---

    [Fact]
    public void CalculateRollover_SingleBudgetNoHistory_ReturnsZeroRollover()
    {
        var budgetId = Guid.NewGuid();
        var budgets = new[] { (budgetId, 3, 2024, (decimal?)500m) };

        var result = BudgetFormulas.CalculateRollover(budgets, budgetId, payDayOfMonth: 1);

        result.Rollover.Should().Be(0m);
        result.EndingBalance.Should().Be(500m);
        result.AvailableToSpend.Should().Be(500m);
        result.PreviousBudgetId.Should().BeNull();
    }

    [Fact]
    public void CalculateRollover_TwoBudgets_SecondGetsFirstAsRollover()
    {
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var budgets = new[]
        {
            (id1, 2, 2024, (decimal?)300m),
            (id2, 3, 2024, (decimal?)200m)
        };

        var result = BudgetFormulas.CalculateRollover(budgets, id2, payDayOfMonth: 1);

        result.Rollover.Should().Be(300m);         // previous budget's ending balance
        result.EndingBalance.Should().Be(200m);    // target's own ending balance
        result.AvailableToSpend.Should().Be(500m); // sum of both
        result.PreviousBudgetId.Should().Be(id1);
    }

    [Fact]
    public void CalculateRollover_TargetNotFound_ReturnsAllZero()
    {
        var budgets = new[] { (Guid.NewGuid(), 3, 2024, (decimal?)100m) };
        var result = BudgetFormulas.CalculateRollover(budgets, Guid.NewGuid());
        result.Rollover.Should().Be(0m);
        result.EndingBalance.Should().Be(0m);
        result.AvailableToSpend.Should().Be(0m);
        result.PreviousBudgetId.Should().BeNull();
    }

    [Fact]
    public void CalculateRollover_NullEndingBalance_TreatedAsZero()
    {
        var id1 = Guid.NewGuid();
        var id2 = Guid.NewGuid();
        var budgets = new[]
        {
            (id1, 2, 2024, (decimal?)null),
            (id2, 3, 2024, (decimal?)400m)
        };

        var result = BudgetFormulas.CalculateRollover(budgets, id2, payDayOfMonth: 1);

        result.Rollover.Should().Be(0m); // null treated as 0
        result.EndingBalance.Should().Be(400m);
    }

    // --- IsOutflowKind ---

    [Theory]
    [InlineData(TransactionKind.Expense, true)]
    [InlineData(TransactionKind.Saving, true)]
    [InlineData(TransactionKind.Income, false)]
    public void IsOutflowKind_ReturnsExpectedResult(TransactionKind kind, bool expected)
    {
        BudgetFormulas.IsOutflowKind(kind).Should().Be(expected);
    }

    // --- CalculateRealizedBalance ---

    [Fact]
    public void CalculateRealizedBalance_CheckedTransactions_ReturnsCheckedIncomeMinusCheckedExpense()
    {
        var incomeLineId = Guid.NewGuid();
        var expLineId = Guid.NewGuid();
        var now = DateTimeOffset.UtcNow;

        var lines = new[]
        {
            new FinancialItemWithId(incomeLineId, TransactionKind.Income, 2000m, now),
            new FinancialItemWithId(expLineId, TransactionKind.Expense, 800m, now)
        };

        var result = BudgetFormulas.CalculateRealizedBalance(lines);
        result.Should().Be(1200m);
    }

    [Fact]
    public void CalculateRealizedBalance_UncheckedLines_ReturnsZero()
    {
        var lines = new[]
        {
            Line(TransactionKind.Income, 2000m),   // no checkedAt
            Line(TransactionKind.Expense, 800m)
        };

        var result = BudgetFormulas.CalculateRealizedBalance(lines);
        result.Should().Be(0m);
    }
}
