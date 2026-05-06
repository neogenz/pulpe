using System.Collections.Concurrent;
using System.Globalization;
using System.Security.Cryptography;
using System.Text;
using Microsoft.Extensions.Logging;
using Microsoft.Extensions.Options;
using Pulpe.Domain.Common;
using Pulpe.Domain.Encryption;
using Pulpe.Application.Common;
using Supabase.Postgrest.Attributes;
using Supabase.Postgrest.Models;
using static Supabase.Postgrest.Constants;
using PgClient = global::Supabase.Postgrest.Client;

namespace Pulpe.Infrastructure.Encryption;

public sealed class AesGcmEncryptionService : IEncryptionService
{
    private readonly EncryptionOptions _options;
    private readonly IEncryptionKeyRepository _keyRepository;
    private readonly ISupabaseClientFactory _clientFactory;
    private readonly ILogger<AesGcmEncryptionService> _logger;

    private static readonly byte[] DemoClientKeyBuffer = new byte[32]; // fixed 32 zero bytes

    // Cache: key = "userId:hex(sha256(clientKey))", value = (dek, expiry)
    private readonly ConcurrentDictionary<string, (byte[] Dek, DateTimeOffset Expiry)> _dekCache = new();

    // Per-user semaphores to prevent concurrent DEK initialisation races
    private readonly ConcurrentDictionary<string, SemaphoreSlim> _dekLocks = new();

    private const int NonceSizeBytes = 12;
    private const int TagSizeBytes = 16;
    private const int DekSizeBytes = 32;
    private static readonly TimeSpan DekCacheDuration = TimeSpan.FromMinutes(5);

    // Base32 alphabet (RFC 4648)
    private const string Base32Alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

    public AesGcmEncryptionService(
        IOptions<EncryptionOptions> options,
        IEncryptionKeyRepository keyRepository,
        ISupabaseClientFactory clientFactory,
        ILogger<AesGcmEncryptionService> logger)
    {
        _options = options.Value;
        _keyRepository = keyRepository;
        _clientFactory = clientFactory;
        _logger = logger;
    }

    // --- Core encrypt/decrypt ---

    public string EncryptAmount(decimal amount, byte[] dek)
    {
        var plaintext = Encoding.UTF8.GetBytes(amount.ToString(CultureInfo.InvariantCulture));
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var ciphertext = new byte[plaintext.Length];
        var tag = new byte[TagSizeBytes];

        using var aesGcm = new AesGcm(dek, TagSizeBytes);
        aesGcm.Encrypt(nonce, plaintext, ciphertext, tag);
        CryptographicOperations.ZeroMemory(plaintext);

        // Layout: [nonce(12)][tag(16)][ciphertext]
        var result = new byte[NonceSizeBytes + TagSizeBytes + ciphertext.Length];
        nonce.CopyTo(result, 0);
        tag.CopyTo(result, NonceSizeBytes);
        ciphertext.CopyTo(result, NonceSizeBytes + TagSizeBytes);

        return Convert.ToBase64String(result);
    }

    public decimal DecryptAmount(string ciphertext, byte[] dek)
    {
        var raw = Convert.FromBase64String(ciphertext);
        if (raw.Length < NonceSizeBytes + TagSizeBytes)
            throw new BusinessException(ErrorCodes.DecryptionFailed, "Invalid ciphertext length");

        var nonce = raw[..NonceSizeBytes];
        var tag = raw[NonceSizeBytes..(NonceSizeBytes + TagSizeBytes)];
        var encryptedData = raw[(NonceSizeBytes + TagSizeBytes)..];
        var plaintext = new byte[encryptedData.Length];

        using var aesGcm = new AesGcm(dek, TagSizeBytes);
        aesGcm.Decrypt(nonce, encryptedData, tag, plaintext);

        var str = Encoding.UTF8.GetString(plaintext);
        CryptographicOperations.ZeroMemory(plaintext);
        if (!decimal.TryParse(str, System.Globalization.NumberStyles.Any,
                System.Globalization.CultureInfo.InvariantCulture, out var result))
            throw new BusinessException(ErrorCodes.DecryptionFailed, "Failed to parse decrypted amount");

        return result;
    }

    public decimal TryDecryptAmount(string? ciphertext, byte[] dek, decimal fallback = 0m)
    {
        if (string.IsNullOrEmpty(ciphertext))
            return fallback;

        try { return DecryptAmount(ciphertext, dek); }
        catch { return fallback; }
    }

    public async Task<string> PrepareAmountData(decimal amount, string userId, byte[] clientKey)
    {
        var dek = await EnsureUserDek(userId, clientKey);
        try { return EncryptAmount(amount, dek); }
        finally { CryptographicOperations.ZeroMemory(dek); }
    }

    // --- DEK management ---

    public async Task<byte[]> EnsureUserDek(string userId, byte[] clientKey)
    {
        var cacheKey = GetCacheKey(userId, clientKey);

        if (_dekCache.TryGetValue(cacheKey, out var cached) && cached.Expiry > DateTimeOffset.UtcNow)
            return cached.Dek.ToArray();

        var semaphore = _dekLocks.GetOrAdd(userId, _ => new SemaphoreSlim(1, 1));
        await semaphore.WaitAsync();
        try
        {
            // Re-check cache after acquiring the lock
            if (_dekCache.TryGetValue(cacheKey, out cached) && cached.Expiry > DateTimeOffset.UtcNow)
                return cached.Dek.ToArray();

            var keyRecord = await _keyRepository.GetByUserId(userId);

            string salt;

            if (keyRecord is null)
            {
                var generatedSalt = GenerateSalt();
                // INSERT ... ON CONFLICT DO NOTHING — returns the salt that actually won
                salt = await _keyRepository.UpsertSalt(userId, generatedSalt, 600_000);
                // Reload to get key_check if another request already stored a record
                keyRecord = await _keyRepository.GetByUserId(userId);
            }
            else
            {
                salt = keyRecord.Salt;
            }

            var dek = DeriveDek(userId, clientKey, salt);

            if (keyRecord?.KeyCheck is not null)
            {
                if (!ValidateKeyCheck(keyRecord.KeyCheck, dek))
                {
                    CryptographicOperations.ZeroMemory(dek);
                    throw new BusinessException(ErrorCodes.EncryptionInvalidKey, "Invalid client key", 401);
                }
            }

            _dekCache[cacheKey] = (dek.ToArray(), DateTimeOffset.UtcNow.Add(DekCacheDuration));
            return dek;
        }
        finally
        {
            semaphore.Release();
        }
    }

    public async Task<byte[]> GetUserDek(string userId, byte[] clientKey)
    {
        var cacheKey = GetCacheKey(userId, clientKey);

        if (_dekCache.TryGetValue(cacheKey, out var cached) && cached.Expiry > DateTimeOffset.UtcNow)
            return cached.Dek.ToArray();

        var keyRecord = await _keyRepository.GetByUserId(userId);
        if (keyRecord is null)
            throw new BusinessException(ErrorCodes.EncryptionKeyNotFound, "Encryption key not found", 404);

        var dek = DeriveDek(userId, clientKey, keyRecord.Salt);

        if (keyRecord.KeyCheck is not null && !ValidateKeyCheck(keyRecord.KeyCheck, dek))
        {
            CryptographicOperations.ZeroMemory(dek);
            throw new BusinessException(ErrorCodes.EncryptionInvalidKey, "Invalid client key", 401);
        }

        _dekCache[cacheKey] = (dek.ToArray(), DateTimeOffset.UtcNow.Add(DekCacheDuration));
        return dek;
    }

    public async Task<VaultStatus> GetVaultStatus(string userId)
    {
        var keyRecord = await _keyRepository.GetByUserId(userId);
        return new VaultStatus(
            PinCodeConfigured: keyRecord?.KeyCheck is not null,
            RecoveryKeyConfigured: keyRecord?.WrappedDek is not null,
            VaultCodeConfigured: keyRecord is not null
        );
    }

    public async Task<SaltInfo> GetUserSalt(string userId)
    {
        var keyRecord = await _keyRepository.GetByUserId(userId);
        if (keyRecord is null)
            throw new BusinessException(ErrorCodes.EncryptionKeyNotFound, "Encryption key not found", 404);

        return new SaltInfo(keyRecord.Salt, keyRecord.KdfIterations, keyRecord.WrappedDek is not null);
    }

    // --- Key check ---

    public string GenerateKeyCheck(byte[] dek)
    {
        return EncryptAmount(0m, dek);
    }

    public bool ValidateKeyCheck(string keyCheck, byte[] dek)
    {
        try
        {
            DecryptAmount(keyCheck, dek);
            return true;
        }
        catch
        {
            return false;
        }
    }

    public async Task<bool> VerifyAndEnsureKeyCheck(string userId, byte[] clientKey)
    {
        var keyRecord = await _keyRepository.GetByUserId(userId);
        if (keyRecord is null)
            return false;

        var dek = DeriveDek(userId, clientKey, keyRecord.Salt);
        try
        {
            if (keyRecord.KeyCheck is null)
            {
                var keyCheck = GenerateKeyCheck(dek);
                await _keyRepository.UpdateKeyCheck(userId, keyCheck);
                return true;
            }

            return ValidateKeyCheck(keyRecord.KeyCheck, dek);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dek);
        }
    }

    // --- Recovery key ---

    public (byte[] Raw, string Formatted) GenerateRecoveryKey()
    {
        var raw = RandomNumberGenerator.GetBytes(DekSizeBytes);
        var encoded = Base32Encode(raw);
        // Group into 4-char segments separated by dashes
        var segments = Enumerable.Range(0, encoded.Length / 4)
            .Select(i => encoded.Substring(i * 4, 4));
        var formatted = string.Join("-", segments);
        return (raw, formatted);
    }

    public string WrapDek(byte[] dek, byte[] recoveryKey)
    {
        var nonce = RandomNumberGenerator.GetBytes(NonceSizeBytes);
        var ciphertext = new byte[dek.Length];
        var tag = new byte[TagSizeBytes];

        using var aesGcm = new AesGcm(recoveryKey, TagSizeBytes);
        aesGcm.Encrypt(nonce, dek, ciphertext, tag);

        var result = new byte[NonceSizeBytes + TagSizeBytes + ciphertext.Length];
        nonce.CopyTo(result, 0);
        tag.CopyTo(result, NonceSizeBytes);
        ciphertext.CopyTo(result, NonceSizeBytes + TagSizeBytes);

        return Convert.ToBase64String(result);
    }

    public byte[] UnwrapDek(string wrappedDek, byte[] recoveryKey)
    {
        var raw = Convert.FromBase64String(wrappedDek);
        var nonce = raw[..NonceSizeBytes];
        var tag = raw[NonceSizeBytes..(NonceSizeBytes + TagSizeBytes)];
        var encrypted = raw[(NonceSizeBytes + TagSizeBytes)..];
        var dek = new byte[encrypted.Length];

        using var aesGcm = new AesGcm(recoveryKey, TagSizeBytes);
        aesGcm.Decrypt(nonce, encrypted, tag, dek);

        return dek;
    }

    public async Task<string> CreateRecoveryKey(string userId, byte[] clientKey)
    {
        var hasWrappedDek = await _keyRepository.HasWrappedDek(userId);
        if (hasWrappedDek)
            throw new BusinessException(ErrorCodes.EncryptionRecoveryAlreadySetup, "Recovery key already configured", 409);

        var dek = await EnsureUserDek(userId, clientKey);
        try
        {
            var (raw, formatted) = GenerateRecoveryKey();
            try
            {
                var wrappedDek = WrapDek(dek, raw);
                await _keyRepository.UpdateWrappedDek(userId, wrappedDek);
                return formatted;
            }
            finally
            {
                CryptographicOperations.ZeroMemory(raw);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dek);
        }
    }

    public async Task<string> RegenerateRecoveryKey(string userId, byte[] clientKey)
    {
        var dek = await EnsureUserDek(userId, clientKey);
        try
        {
            var (raw, formatted) = GenerateRecoveryKey();
            try
            {
                var wrappedDek = WrapDek(dek, raw);
                await _keyRepository.UpdateWrappedDek(userId, wrappedDek);
                return formatted;
            }
            finally
            {
                CryptographicOperations.ZeroMemory(raw);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(dek);
        }
    }

    // --- Recovery ---

    public async Task RecoverWithKey(string userId, string recoveryKey, byte[] newClientKey)
    {
        var keyRecord = await _keyRepository.GetByUserId(userId);
        if (keyRecord?.WrappedDek is null)
            throw new BusinessException(ErrorCodes.EncryptionRecoveryFailed, "No wrapped DEK found", 400);

        var oldWrappedDek = keyRecord.WrappedDek;
        var recoveryKeyBytes = ParseRecoveryKey(recoveryKey);
        var oldDek = UnwrapDek(keyRecord.WrappedDek, recoveryKeyBytes);

        try
        {
            var newDek = DeriveDek(userId, newClientKey, keyRecord.Salt);
            try
            {
                string newKeyCheck;
                try
                {
                    newKeyCheck = await ReEncryptAllUserData(userId, oldDek, newDek);
                }
                catch (Exception)
                {
                    try { await _keyRepository.UpdateWrappedDek(userId, oldWrappedDek); }
                    catch (Exception restoreEx) { _logger.LogWarning(restoreEx, "Failed to restore wrapped DEK for user {UserId} after rekey failure", userId); }
                    throw;
                }

                // Invalidate cache immediately after successful re-encryption, before writing new wrapped DEK.
                InvalidateDekCache(userId);

                // Re-wrap the old DEK structure (same recovery key wraps new DEK)
                var newWrappedDek = WrapDek(newDek, recoveryKeyBytes);
                await _keyRepository.UpdateWrappedDek(userId, newWrappedDek);
                await _keyRepository.UpdateKeyCheck(userId, newKeyCheck);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(newDek);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(oldDek);
        }
    }

    public async Task<ChangePinResult> ChangePinRekey(string userId, byte[] oldClientKey, byte[] newClientKey)
    {
        var keyRecord = await _keyRepository.GetByUserId(userId);
        if (keyRecord is null)
            throw new BusinessException(ErrorCodes.EncryptionKeyNotFound, "Encryption key not found", 404);

        var oldWrappedDek = keyRecord.WrappedDek;
        var oldDek = DeriveDek(userId, oldClientKey, keyRecord.Salt);
        try
        {
            // Validate old key
            if (keyRecord.KeyCheck is not null && !ValidateKeyCheck(keyRecord.KeyCheck, oldDek))
                throw new BusinessException(ErrorCodes.EncryptionInvalidKey, "Invalid current PIN", 401);

            // Same-key check (prevent oracle)
            var newDek = DeriveDek(userId, newClientKey, keyRecord.Salt);
            try
            {
                if (oldDek.SequenceEqual(newDek))
                    throw new BusinessException(ErrorCodes.EncryptionSameKey, "New PIN must be different from current PIN", 400);

                string newKeyCheck;
                try
                {
                    newKeyCheck = await ReEncryptAllUserData(userId, oldDek, newDek);
                }
                catch (Exception)
                {
                    if (oldWrappedDek is not null)
                    {
                        try { await _keyRepository.UpdateWrappedDek(userId, oldWrappedDek); }
                        catch (Exception restoreEx) { _logger.LogWarning(restoreEx, "Failed to restore wrapped DEK for user {UserId} after rekey failure", userId); }
                    }
                    throw;
                }

                // Invalidate cache immediately after successful re-encryption, before writing new wrapped DEK.
                InvalidateDekCache(userId);

                // Generate new recovery key
                var (recoveryRaw, recoveryFormatted) = GenerateRecoveryKey();
                var wrappedDek = WrapDek(newDek, recoveryRaw);

                await _keyRepository.UpdateWrappedDek(userId, wrappedDek);
                await _keyRepository.UpdateKeyCheck(userId, newKeyCheck);

                return new ChangePinResult(newKeyCheck, recoveryFormatted);
            }
            finally
            {
                CryptographicOperations.ZeroMemory(newDek);
            }
        }
        finally
        {
            CryptographicOperations.ZeroMemory(oldDek);
        }
    }

    public async Task<string> ReEncryptAllUserData(string userId, byte[] oldDek, byte[] newDek)
    {
        // Use admin client for cross-user rekey operations
        var client = _clientFactory.CreateAdminClient();

        var budgetLinesTask = client.Table<EncryptedAmountRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        var transactionsTask = client.Table<TransactionAmountRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        var templateLinesTask = client.Table<TemplateLineAmountRow>()
            .Filter("template_id", Operator.In, new List<string>())  // joined via user via RPC
            .Get();

        var savingsGoalsTask = client.Table<SavingsGoalAmountRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        var monthlyBudgetsTask = client.Table<BudgetBalanceRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        await Task.WhenAll(budgetLinesTask, transactionsTask, savingsGoalsTask, monthlyBudgetsTask);

        var budgetLineUpdates = budgetLinesTask.Result.Models
            .Where(r => !string.IsNullOrEmpty(r.Amount))
            .Select(r => new { id = r.Id.ToString(), amount = ReEncrypt(r.Amount!, oldDek, newDek) })
            .ToList();

        var transactionUpdates = transactionsTask.Result.Models
            .Where(r => !string.IsNullOrEmpty(r.Amount))
            .Select(r => new { id = r.Id.ToString(), amount = ReEncrypt(r.Amount!, oldDek, newDek) })
            .ToList();

        // For template lines, we need to fetch via admin and filter by user's templates
        var templateLines = await FetchUserTemplateLines(userId, client);
        var templateLineUpdates = templateLines
            .Where(r => !string.IsNullOrEmpty(r.Amount))
            .Select(r => new { id = r.Id.ToString(), amount = ReEncrypt(r.Amount!, oldDek, newDek) })
            .ToList();

        var savingsGoalUpdates = savingsGoalsTask.Result.Models
            .Where(r => !string.IsNullOrEmpty(r.TargetAmount))
            .Select(r => new { id = r.Id.ToString(), target_amount = ReEncrypt(r.TargetAmount!, oldDek, newDek) })
            .ToList();

        var monthlyBudgetUpdates = monthlyBudgetsTask.Result.Models
            .Where(r => !string.IsNullOrEmpty(r.EndingBalance))
            .Select(r => new { id = r.Id.ToString(), ending_balance = ReEncrypt(r.EndingBalance!, oldDek, newDek) })
            .ToList();

        // Call atomic RPC to update all data at once
        await client.Rpc("rekey_user_encrypted_data", new
        {
            p_user_id = userId,
            p_budget_lines = budgetLineUpdates,
            p_transactions = transactionUpdates,
            p_template_lines = templateLineUpdates,
            p_savings_goals = savingsGoalUpdates,
            p_monthly_budgets = monthlyBudgetUpdates
        });

        return GenerateKeyCheck(newDek);
    }

    private async Task<List<TemplateLineAmountRow>> FetchUserTemplateLines(
        string userId, PgClient client)
    {
        // Get all template IDs for user first
        var templates = await client.Table<UserTemplateRow>()
            .Filter("user_id", Operator.Equals, userId)
            .Get();

        if (templates.Models.Count == 0)
            return [];

        var templateIds = templates.Models.Select(t => t.Id.ToString()).ToList();

        var lines = await client.Table<TemplateLineAmountRow>()
            .Filter("template_id", Operator.In, templateIds)
            .Get();

        return lines.Models;
    }

    // --- Private helpers ---

    private byte[] DeriveDek(string userId, byte[] clientKey, string salt)
    {
        var masterKey = Convert.FromHexString(_options.MasterKey);
        var ikm = new byte[clientKey.Length + masterKey.Length];
        try
        {
            // IKM = clientKey || masterKey
            Buffer.BlockCopy(clientKey, 0, ikm, 0, clientKey.Length);
            Buffer.BlockCopy(masterKey, 0, ikm, clientKey.Length, masterKey.Length);

            var saltBytes = Convert.FromHexString(salt);
            var info = Encoding.UTF8.GetBytes($"pulpe-dek-{userId}");

            return HKDF.DeriveKey(HashAlgorithmName.SHA256, ikm, DekSizeBytes, saltBytes, info);
        }
        finally
        {
            CryptographicOperations.ZeroMemory(masterKey);
            CryptographicOperations.ZeroMemory(ikm);
        }
    }

    private static string GenerateSalt()
    {
        var saltBytes = RandomNumberGenerator.GetBytes(32);
        return Convert.ToHexString(saltBytes).ToLowerInvariant();
    }

    private string ReEncrypt(string ciphertext, byte[] oldDek, byte[] newDek)
    {
        var amount = DecryptAmount(ciphertext, oldDek);
        return EncryptAmount(amount, newDek);
    }

    private static byte[] ParseRecoveryKey(string recoveryKey)
    {
        var cleaned = recoveryKey.Replace("-", "").Replace(" ", "").ToUpperInvariant();
        return Base32Decode(cleaned);
    }

    private string GetCacheKey(string userId, byte[] clientKey) =>
        $"{userId}:{Convert.ToHexString(SHA256.HashData(clientKey))}";

    private void InvalidateDekCache(string userId)
    {
        var keysToRemove = _dekCache.Keys.Where(k => k.StartsWith($"{userId}:")).ToList();
        foreach (var key in keysToRemove)
        {
            if (_dekCache.TryRemove(key, out var old))
                CryptographicOperations.ZeroMemory(old.Dek);
        }
    }

    private static string Base32Encode(byte[] data)
    {
        var sb = new StringBuilder();
        var buffer = 0;
        var bitsLeft = 0;

        foreach (var b in data)
        {
            buffer <<= 8;
            buffer |= b;
            bitsLeft += 8;

            while (bitsLeft >= 5)
            {
                bitsLeft -= 5;
                sb.Append(Base32Alphabet[(buffer >> bitsLeft) & 0x1F]);
            }
        }

        if (bitsLeft > 0)
        {
            buffer <<= 5 - bitsLeft;
            sb.Append(Base32Alphabet[buffer & 0x1F]);
        }

        return sb.ToString();
    }

    private static byte[] Base32Decode(string encoded)
    {
        var result = new List<byte>();
        var buffer = 0;
        var bitsLeft = 0;

        foreach (var c in encoded)
        {
            var idx = Base32Alphabet.IndexOf(c);
            if (idx < 0) continue;

            buffer <<= 5;
            buffer |= idx;
            bitsLeft += 5;

            if (bitsLeft >= 8)
            {
                bitsLeft -= 8;
                result.Add((byte)((buffer >> bitsLeft) & 0xFF));
            }
        }

        return [.. result];
    }

    [Table("budget_line")]
    private sealed class EncryptedAmountRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }
    }

    [Table("transaction")]
    private sealed class TransactionAmountRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }
    }

    [Table("template_line")]
    private sealed class TemplateLineAmountRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("template_id")]
        public Guid TemplateId { get; set; }

        [Column("amount")]
        public string? Amount { get; set; }
    }

    [Table("template")]
    private sealed class UserTemplateRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("user_id")]
        public Guid UserId { get; set; }
    }

    [Table("savings_goal")]
    private sealed class SavingsGoalAmountRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("target_amount")]
        public string? TargetAmount { get; set; }
    }

    [Table("monthly_budget")]
    private sealed class BudgetBalanceRow : BaseModel
    {
        [PrimaryKey("id", false)]
        public Guid Id { get; set; }

        [Column("ending_balance")]
        public string? EndingBalance { get; set; }
    }
}
