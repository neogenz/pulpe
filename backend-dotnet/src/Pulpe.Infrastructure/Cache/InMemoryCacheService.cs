using Microsoft.Extensions.Logging;
using System.Collections.Concurrent;
using Microsoft.Extensions.Caching.Memory;
using Pulpe.Application.Common;

namespace Pulpe.Infrastructure.Cache;

public sealed class InMemoryCacheService : ICacheService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<InMemoryCacheService> _logger;
    private readonly ConcurrentDictionary<string, HashSet<string>> _userKeys = new();
    private const int MaxTrackedKeysPerUser = 50;

    public InMemoryCacheService(IMemoryCache cache, ILogger<InMemoryCacheService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    public async Task<T> GetOrSet<T>(string userId, string key, TimeSpan ttl, Func<Task<T>> fetcher)
    {
        var fullKey = $"cache:{userId}:{key}";

        if (_cache.TryGetValue(fullKey, out T? cached) && cached is not null)
        {
            _logger.LogDebug("Cache hit for user {UserId} key {Key}", userId, key);
            return cached;
        }

        _logger.LogDebug("Cache miss for user {UserId} key {Key}", userId, key);
        var result = await fetcher();
        _cache.Set(fullKey, result, ttl);
        TrackKey(userId, fullKey);
        return result;
    }

    public Task InvalidateForUser(string userId)
    {
        if (!_userKeys.TryGetValue(userId, out var keys) || keys.Count == 0)
            return Task.CompletedTask;

        List<string> snapshot;
        lock (keys)
        {
            snapshot = new List<string>(keys);
            keys.Clear();
        }

        _userKeys.TryRemove(userId, out _);
        foreach (var k in snapshot)
            _cache.Remove(k);

        _logger.LogDebug("Cache invalidated for user {UserId}, {KeyCount} keys cleared", userId, snapshot.Count);
        return Task.CompletedTask;
    }

    private void TrackKey(string userId, string fullKey)
    {
        var keys = _userKeys.GetOrAdd(userId, _ => new HashSet<string>());
        lock (keys)
        {
            if (keys.Count >= MaxTrackedKeysPerUser)
                keys.Clear();
            keys.Add(fullKey);
        }
    }
}
