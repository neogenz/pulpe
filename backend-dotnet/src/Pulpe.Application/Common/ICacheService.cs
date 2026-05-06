namespace Pulpe.Application.Common;

public interface ICacheService
{
    Task<T> GetOrSet<T>(string userId, string key, TimeSpan ttl, Func<Task<T>> fetcher);
    Task InvalidateForUser(string userId);
}
