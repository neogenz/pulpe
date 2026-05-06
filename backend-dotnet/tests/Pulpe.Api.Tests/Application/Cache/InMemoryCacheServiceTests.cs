using FluentAssertions;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Pulpe.Infrastructure.Cache;

namespace Pulpe.Api.Tests.Application.Cache;

public class InMemoryCacheServiceTests : IDisposable
{
    private readonly IMemoryCache _memoryCache = new MemoryCache(new MemoryCacheOptions());
    private readonly InMemoryCacheService _sut;

    public InMemoryCacheServiceTests()
    {
        _sut = new InMemoryCacheService(_memoryCache, NullLogger<InMemoryCacheService>.Instance);
    }

    // --- GetOrSet ---

    [Fact]
    public async Task GetOrSet_Miss_CallsFetcherAndCaches()
    {
        var callCount = 0;

        var result = await _sut.GetOrSet("user-1", "key-1", TimeSpan.FromMinutes(5), () =>
        {
            callCount++;
            return Task.FromResult("value-1");
        });

        result.Should().Be("value-1");
        callCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOrSet_Hit_DoesNotCallFetcherAgain()
    {
        var callCount = 0;

        await _sut.GetOrSet("user-1", "key-hit", TimeSpan.FromMinutes(5), () =>
        {
            callCount++;
            return Task.FromResult("cached");
        });

        // Second call — should hit cache
        var result = await _sut.GetOrSet("user-1", "key-hit", TimeSpan.FromMinutes(5), () =>
        {
            callCount++;
            return Task.FromResult("should-not-be-called");
        });

        result.Should().Be("cached");
        callCount.Should().Be(1);
    }

    [Fact]
    public async Task GetOrSet_DifferentUsers_Isolated()
    {
        await _sut.GetOrSet("user-a", "same-key", TimeSpan.FromMinutes(5), () => Task.FromResult("value-a"));
        var resultB = await _sut.GetOrSet("user-b", "same-key", TimeSpan.FromMinutes(5), () => Task.FromResult("value-b"));

        resultB.Should().Be("value-b");
    }

    // --- InvalidateForUser ---

    [Fact]
    public async Task InvalidateForUser_ClearsUserEntries()
    {
        var callCount = 0;

        await _sut.GetOrSet("user-1", "key-a", TimeSpan.FromMinutes(5), () =>
        {
            callCount++;
            return Task.FromResult("val");
        });

        await _sut.InvalidateForUser("user-1");

        // After invalidation, fetcher should be called again
        await _sut.GetOrSet("user-1", "key-a", TimeSpan.FromMinutes(5), () =>
        {
            callCount++;
            return Task.FromResult("val2");
        });

        callCount.Should().Be(2);
    }

    [Fact]
    public async Task InvalidateForUser_UnknownUser_DoesNotThrow()
    {
        await _sut.Invoking(s => s.InvalidateForUser("unknown-user"))
            .Should().NotThrowAsync();
    }

    [Fact]
    public async Task InvalidateForUser_OtherUserCacheUntouched()
    {
        var otherCallCount = 0;

        await _sut.GetOrSet("user-keep", "key", TimeSpan.FromMinutes(5), () =>
        {
            otherCallCount++;
            return Task.FromResult("keep");
        });

        await _sut.InvalidateForUser("user-evict");

        // user-keep cache still intact
        await _sut.GetOrSet("user-keep", "key", TimeSpan.FromMinutes(5), () =>
        {
            otherCallCount++;
            return Task.FromResult("should-not-call");
        });

        otherCallCount.Should().Be(1);
    }

    public void Dispose() => _memoryCache.Dispose();
}
