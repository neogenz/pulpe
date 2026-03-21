namespace Pulpe.Api.Tests.Integration.Fixtures;

/// <summary>
/// xUnit FactAttribute marker for integration tests that require Supabase.
/// Tests call fixture.SkipIfUnavailable() directly which throws Xunit.Sdk.SkipException
/// — xUnit marks these as skipped when Supabase is not reachable.
/// </summary>
[AttributeUsage(AttributeTargets.Method)]
public sealed class IntegrationFactAttribute : FactAttribute
{
}
