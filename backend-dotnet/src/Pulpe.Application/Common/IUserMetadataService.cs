namespace Pulpe.Application.Common;

public interface IUserMetadataService
{
    Task<int> GetPayDayOfMonth(string accessToken);
}
