using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Domain.Budget;

public record BudgetPeriodInfo(int Month, int Year);

public record BudgetPeriodDates(DateTime StartDate, DateTime EndDate);

public static class BudgetPeriod
{
    /// <summary>
    /// Determines the budget period for a given date using the quinzaine rule:
    /// - payDay &lt;= 15: budget is named after the month where the period STARTS
    /// - payDay &gt; 15: budget is named after the month where the period ENDS
    /// </summary>
    public static BudgetPeriodInfo GetBudgetPeriodForDate(DateTime date, int? payDayOfMonth = null)
    {
        var calendarMonth = date.Month;
        var calendarYear = date.Year;
        var dayOfMonth = date.Day;

        if (payDayOfMonth is null or 1)
            return new BudgetPeriodInfo(calendarMonth, calendarYear);

        var validPayDay = Math.Max(Constants.PayDayMin, Math.Min(Constants.PayDayMax, payDayOfMonth.Value));

        int resultMonth;
        int resultYear;

        if (dayOfMonth >= validPayDay)
        {
            resultMonth = calendarMonth;
            resultYear = calendarYear;
        }
        else
        {
            if (calendarMonth == 1)
            {
                resultMonth = 12;
                resultYear = calendarYear - 1;
            }
            else
            {
                resultMonth = calendarMonth - 1;
                resultYear = calendarYear;
            }
        }

        if (validPayDay > 15)
        {
            if (resultMonth == 12)
            {
                resultMonth = 1;
                resultYear += 1;
            }
            else
            {
                resultMonth += 1;
            }
        }

        return new BudgetPeriodInfo(resultMonth, resultYear);
    }

    public static bool IsInCurrentBudgetPeriod(DateTime date, int? payDayOfMonth = null)
    {
        var currentPeriod = GetBudgetPeriodForDate(DateTime.UtcNow, payDayOfMonth);
        var datePeriod = GetBudgetPeriodForDate(date, payDayOfMonth);
        return currentPeriod.Month == datePeriod.Month && currentPeriod.Year == datePeriod.Year;
    }

    public static int CompareBudgetPeriods(BudgetPeriodInfo a, BudgetPeriodInfo b)
    {
        if (a.Year != b.Year) return a.Year < b.Year ? -1 : 1;
        if (a.Month != b.Month) return a.Month < b.Month ? -1 : 1;
        return 0;
    }

    public static bool IsPastBudgetPeriod(BudgetPeriodInfo period, int? payDayOfMonth = null)
    {
        var currentPeriod = GetBudgetPeriodForDate(DateTime.UtcNow, payDayOfMonth);
        return CompareBudgetPeriods(period, currentPeriod) < 0;
    }

    public static BudgetPeriodDates GetBudgetPeriodDates(int month, int year, int? payDayOfMonth = null)
    {
        var payDay = payDayOfMonth is > 1
            ? Math.Max(Constants.PayDayMin, Math.Min(Constants.PayDayMax, payDayOfMonth.Value))
            : 1;

        int startMonth;
        int startYear;

        if (payDay == 1)
        {
            startMonth = month;
            startYear = year;
        }
        else if (payDay <= 15)
        {
            startMonth = month;
            startYear = year;
        }
        else
        {
            if (month == 1)
            {
                startMonth = 12;
                startYear = year - 1;
            }
            else
            {
                startMonth = month - 1;
                startYear = year;
            }
        }

        var lastDayOfStartMonth = DateTime.DaysInMonth(startYear, startMonth);
        var actualStartDay = Math.Min(payDay, lastDayOfStartMonth);
        var startDate = new DateTime(startYear, startMonth, actualStartDay);

        DateTime endDate;

        if (payDay == 1)
        {
            var lastDay = DateTime.DaysInMonth(year, month);
            endDate = new DateTime(year, month, lastDay);
        }
        else
        {
            int endMonth;
            int endYear;

            if (startMonth == 12)
            {
                endMonth = 1;
                endYear = startYear + 1;
            }
            else
            {
                endMonth = startMonth + 1;
                endYear = startYear;
            }

            var lastDayOfEndMonth = DateTime.DaysInMonth(endYear, endMonth);
            var actualEndDay = Math.Min(payDay - 1, lastDayOfEndMonth);

            if (actualEndDay <= 0)
                endDate = new DateTime(startYear, startMonth, lastDayOfStartMonth);
            else
                endDate = new DateTime(endYear, endMonth, actualEndDay);
        }

        return new BudgetPeriodDates(startDate, endDate);
    }

    public static string FormatBudgetPeriod(int month, int year, int? payDayOfMonth = null, string? locale = null)
    {
        var dates = GetBudgetPeriodDates(month, year, payDayOfMonth);
        var culture = locale != null
            ? new System.Globalization.CultureInfo(locale)
            : new System.Globalization.CultureInfo("fr-CH");

        var startStr = dates.StartDate.ToString("d MMM", culture);
        var endStr = dates.EndDate.ToString("d MMM", culture);

        return $"{startStr} - {endStr}";
    }
}
