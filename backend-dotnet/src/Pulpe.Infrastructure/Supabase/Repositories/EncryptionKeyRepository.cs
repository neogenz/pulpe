using Pulpe.Application.Common;
using Pulpe.Domain.Encryption;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;

namespace Pulpe.Infrastructure.Supabase.Repositories;

public sealed class EncryptionKeyRepository : IEncryptionKeyRepository
{
    private readonly ISupabaseClientFactory _factory;

    public EncryptionKeyRepository(ISupabaseClientFactory factory)
    {
        _factory = factory;
    }

    public async Task<EncryptionKey?> GetByUserId(string userId)
    {
        // Always use service role to bypass RLS
        var client = _factory.CreateAdminClient();
        var response = await client.Table<EncryptionKeyRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Single();

        return response is null ? null : MapToEncryptionKey(response);
    }

    public async Task<string> UpsertSalt(string userId, string salt, int kdfIterations)
    {
        var client = _factory.CreateAdminClient();
        var row = new EncryptionKeyRow
        {
            UserId = Guid.Parse(userId),
            Salt = salt,
            KdfIterations = kdfIterations,
            UpdatedAt = DateTimeOffset.UtcNow
        };

        await client.Table<EncryptionKeyRow>().Insert(row,
            new global::Supabase.Postgrest.QueryOptions { DuplicateResolution = global::Supabase.Postgrest.QueryOptions.DuplicateResolutionType.IgnoreDuplicates });

        var stored = await GetByUserId(userId);
        return stored?.Salt ?? salt;
    }

    public async Task UpdateKeyCheck(string userId, string keyCheck)
    {
        var client = _factory.CreateAdminClient();
        await client.Table<EncryptionKeyRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Set(r => r.KeyCheck, keyCheck)
            .Set(r => r.UpdatedAt, DateTimeOffset.UtcNow)
            .Update();
    }

    public async Task UpdateWrappedDek(string userId, string? wrappedDek)
    {
        var client = _factory.CreateAdminClient();
        await client.Table<EncryptionKeyRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Set(r => r.WrappedDek, wrappedDek)
            .Set(r => r.UpdatedAt, DateTimeOffset.UtcNow)
            .Update();
    }

    public async Task<bool> HasWrappedDek(string userId)
    {
        var key = await GetByUserId(userId);
        return key?.WrappedDek is not null;
    }

    private static EncryptionKey MapToEncryptionKey(EncryptionKeyRow row) => new()
    {
        UserId = row.UserId,
        Salt = row.Salt ?? string.Empty,
        KdfIterations = row.KdfIterations,
        WrappedDek = row.WrappedDek,
        KeyCheck = row.KeyCheck,
        CreatedAt = row.CreatedAt,
        UpdatedAt = row.UpdatedAt
    };

    [Table("user_encryption_key")]
    private sealed class EncryptionKeyRow : BaseModel
    {
        [PrimaryKey("user_id", false)]
        public Guid UserId { get; set; }

        [Column("salt")]
        public string? Salt { get; set; }

        [Column("kdf_iterations")]
        public int KdfIterations { get; set; } = 600_000;

        [Column("wrapped_dek")]
        public string? WrappedDek { get; set; }

        [Column("key_check")]
        public string? KeyCheck { get; set; }

        [Column("created_at")]
        public DateTimeOffset CreatedAt { get; set; }

        [Column("updated_at")]
        public DateTimeOffset UpdatedAt { get; set; }
    }
}
