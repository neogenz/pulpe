using FluentAssertions;
using Pulpe.Api.Domain.Budget;

namespace Pulpe.Api.Tests.Domain.Budget;

public class BudgetPeriodTests
{
    // GetBudgetPeriodForDate — null/1 payDay → calendar month
    [Theory]
    [InlineData(null)]
    [InlineData(1)]
    public void GetBudgetPeriodForDate_NullOrOnePayDay_ReturnsCalendarMonth(int? payDay)
    {
        var date = new DateTime(2024, 3, 15);
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, payDay);
        result.Month.Should().Be(3);
        result.Year.Should().Be(2024);
    }

    // payDay <= 15: period named after START month
    // Day >= payDay → same month
    [Fact]
    public void GetBudgetPeriodForDate_PayDay5_DayAfterPayDay_ReturnsSameMonth()
    {
        var date = new DateTime(2024, 3, 10); // day 10 >= payDay 5
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 5);
        result.Month.Should().Be(3);
        result.Year.Should().Be(2024);
    }

    // Day < payDay → previous month
    [Fact]
    public void GetBudgetPeriodForDate_PayDay15_DayBeforePayDay_ReturnsPreviousMonth()
    {
        var date = new DateTime(2024, 3, 5); // day 5 < payDay 15
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 15);
        result.Month.Should().Be(2);
        result.Year.Should().Be(2024);
    }

    // Day < payDay in January → December of previous year
    [Fact]
    public void GetBudgetPeriodForDate_PayDay15_JanuaryBeforePayDay_ReturnsDecemberPreviousYear()
    {
        var date = new DateTime(2024, 1, 5); // day 5 < payDay 15
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 15);
        result.Month.Should().Be(12);
        result.Year.Should().Be(2023);
    }

    // payDay > 15: period named after END month (resultMonth+1)
    // Day >= payDay → same month + named after next month
    [Fact]
    public void GetBudgetPeriodForDate_PayDay25_DayAfterPayDay_ReturnsNextMonth()
    {
        var date = new DateTime(2024, 3, 28); // day 28 >= payDay 25
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 25);
        result.Month.Should().Be(4);
        result.Year.Should().Be(2024);
    }

    // payDay > 15, December: period named after January of next year
    [Fact]
    public void GetBudgetPeriodForDate_PayDay25_December_ReturnsJanuaryNextYear()
    {
        var date = new DateTime(2024, 12, 28); // day 28 >= payDay 25
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 25);
        result.Month.Should().Be(1);
        result.Year.Should().Be(2025);
    }

    // payDay > 15, Day < payDay → previous month result, then +1
    [Fact]
    public void GetBudgetPeriodForDate_PayDay25_DayBeforePayDay_ReturnsSameMonth()
    {
        var date = new DateTime(2024, 3, 10); // day 10 < payDay 25
        var result = BudgetPeriod.GetBudgetPeriodForDate(date, 25);
        result.Month.Should().Be(3);
        result.Year.Should().Be(2024);
    }

    // CompareBudgetPeriods
    [Fact]
    public void CompareBudgetPeriods_EarlierYear_ReturnsNegative()
    {
        var a = new BudgetPeriodInfo(6, 2023);
        var b = new BudgetPeriodInfo(1, 2024);
        BudgetPeriod.CompareBudgetPeriods(a, b).Should().Be(-1);
    }

    [Fact]
    public void CompareBudgetPeriods_SameYearEarlierMonth_ReturnsNegative()
    {
        var a = new BudgetPeriodInfo(3, 2024);
        var b = new BudgetPeriodInfo(6, 2024);
        BudgetPeriod.CompareBudgetPeriods(a, b).Should().Be(-1);
    }

    [Fact]
    public void CompareBudgetPeriods_Equal_ReturnsZero()
    {
        var a = new BudgetPeriodInfo(3, 2024);
        var b = new BudgetPeriodInfo(3, 2024);
        BudgetPeriod.CompareBudgetPeriods(a, b).Should().Be(0);
    }

    [Fact]
    public void CompareBudgetPeriods_LaterYear_ReturnsPositive()
    {
        var a = new BudgetPeriodInfo(1, 2025);
        var b = new BudgetPeriodInfo(12, 2024);
        BudgetPeriod.CompareBudgetPeriods(a, b).Should().Be(1);
    }

    // GetBudgetPeriodDates — payDay 1 → full calendar month
    [Fact]
    public void GetBudgetPeriodDates_PayDay1_ReturnsFullCalendarMonth()
    {
        var result = BudgetPeriod.GetBudgetPeriodDates(3, 2024, 1);
        result.StartDate.Should().Be(new DateTime(2024, 3, 1));
        result.EndDate.Should().Be(new DateTime(2024, 3, 31));
    }

    // payDay <= 15: starts on payDay of same month
    [Fact]
    public void GetBudgetPeriodDates_PayDay5_StartOnPayDayOfSameMonth()
    {
        var result = BudgetPeriod.GetBudgetPeriodDates(3, 2024, 5);
        result.StartDate.Should().Be(new DateTime(2024, 3, 5));
        result.EndDate.Should().Be(new DateTime(2024, 4, 4));
    }

    // payDay > 15: starts on payDay of previous month
    [Fact]
    public void GetBudgetPeriodDates_PayDay25_StartOnPayDayOfPreviousMonth()
    {
        var result = BudgetPeriod.GetBudgetPeriodDates(3, 2024, 25);
        result.StartDate.Should().Be(new DateTime(2024, 2, 25));
        result.EndDate.Should().Be(new DateTime(2024, 3, 24));
    }

    // January budget with payDay > 15 → starts in December previous year
    [Fact]
    public void GetBudgetPeriodDates_PayDay25_JanuaryBudget_StartsInDecember()
    {
        var result = BudgetPeriod.GetBudgetPeriodDates(1, 2024, 25);
        result.StartDate.Should().Be(new DateTime(2023, 12, 25));
        result.EndDate.Should().Be(new DateTime(2024, 1, 24));
    }
}
