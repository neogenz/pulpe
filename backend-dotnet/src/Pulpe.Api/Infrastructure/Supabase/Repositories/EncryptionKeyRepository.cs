using Pulpe.Api.Domain.Encryption;

namespace Pulpe.Api.Infrastructure.Supabase.Repositories;

public sealed class EncryptionKeyRepository : IEncryptionKeyRepository
{
    private readonly SupabaseClientFactory _factory;

    public EncryptionKeyRepository(SupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<EncryptionKey?> GetByUserId(string userId)
    {
        // Always use service role to bypass RLS
        var client = _factory.GetServiceRole();
        var builder = client.From("user_encryption_key")
            .Select("*")
            .Eq("user_id", userId)
            .Single();

        var response = await client.Execute<EncryptionKeyRow>(builder);
        return response.Data is null ? null : MapToEncryptionKey(response.Data);
    }

    public async Task UpsertSalt(string userId, string salt, int kdfIterations)
    {
        var client = _factory.GetServiceRole();
        var data = new
        {
            user_id = userId,
            salt,
            kdf_iterations = kdfIterations,
            updated_at = DateTimeOffset.UtcNow
        };

        var builder = client.From("user_encryption_key").Insert(data);
        // Use upsert by setting Prefer header — handled via Insert with on_conflict
        var response = await client.Execute<object>(builder);

        if (!response.IsSuccess)
        {
            // Conflict (23505) = row exists, try UPDATE
            var updateBuilder = client.From("user_encryption_key")
                .Eq("user_id", userId)
                .Update(new { salt, kdf_iterations = kdfIterations, updated_at = DateTimeOffset.UtcNow });
            await client.Execute<object>(updateBuilder);
        }
    }

    public async Task UpdateKeyCheck(string userId, string keyCheck)
    {
        var client = _factory.GetServiceRole();
        var builder = client.From("user_encryption_key")
            .Eq("user_id", userId)
            .Update(new { key_check = keyCheck, updated_at = DateTimeOffset.UtcNow });

        await client.Execute<object>(builder);
    }

    public async Task UpdateWrappedDek(string userId, string? wrappedDek)
    {
        var client = _factory.GetServiceRole();
        var builder = client.From("user_encryption_key")
            .Eq("user_id", userId)
            .Update(new { wrapped_dek = wrappedDek, updated_at = DateTimeOffset.UtcNow });

        await client.Execute<object>(builder);
    }

    public async Task<bool> HasWrappedDek(string userId)
    {
        var key = await GetByUserId(userId);
        return key?.WrappedDek is not null;
    }

    private static EncryptionKey MapToEncryptionKey(EncryptionKeyRow row) => new()
    {
        UserId = Guid.Parse(row.UserId),
        Salt = row.Salt ?? string.Empty,
        KdfIterations = row.KdfIterations,
        WrappedDek = row.WrappedDek,
        KeyCheck = row.KeyCheck,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    private sealed class EncryptionKeyRow
    {
        public string UserId { get; set; } = string.Empty;
        public string? Salt { get; set; }
        public int KdfIterations { get; set; } = 600_000;
        public string? WrappedDek { get; set; }
        public string? KeyCheck { get; set; }
        public DateTimeOffset CreatedAt { get; set; }
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
