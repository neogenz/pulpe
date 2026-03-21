using Pulpe.Api.Application.Common;
using Pulpe.Api.Domain.Common;

namespace Pulpe.Api.Infrastructure.Supabase;

public sealed class SupabaseUserMetadataService : IUserMetadataService
{
    private readonly SupabaseAuthClient _authClient;

    public SupabaseUserMetadataService(SupabaseAuthClient authClient)
    {
        _authClient = authClient;
    }

    public async Task<int> GetPayDayOfMonth(string accessToken)
    {
        var response = await _authClient.GetUser<SupabaseUserWithPayDay>(accessToken);
        var payDay = response?.UserMetadata?.PayDayOfMonth;

        if (payDay is >= Constants.PayDayMin and <= Constants.PayDayMax)
            return payDay.Value;

        return Constants.PayDayMin;
    }

    private sealed class SupabaseUserWithPayDay
    {
        public SupabasePayDayMetadata? UserMetadata { get; init; }
    }

    private sealed class SupabasePayDayMetadata
    {
        public int? PayDayOfMonth { get; init; }
    }
}
