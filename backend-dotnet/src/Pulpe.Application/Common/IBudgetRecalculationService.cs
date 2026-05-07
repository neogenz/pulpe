namespace Pulpe.Application.Common;

public interface IBudgetRecalculationService
{
    Task RecalculateBalances(Guid budgetId, byte[] clientKey);
}
