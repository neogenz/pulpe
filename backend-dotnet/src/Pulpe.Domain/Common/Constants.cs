namespace Pulpe.Domain.Common;

public static class Constants
{
    public const int PayDayMin = 1;
    public const int PayDayMax = 31;
    public const int MinYear = 2020;
    public static readonly int MaxYear = DateTime.UtcNow.Year + 10;
    public const int MonthMin = 1;
    public const int MonthMax = 12;
    public const int MaxTemplatesPerUser = 5;
    public const int DescriptionMaxLength = 500;
    public const int NameMaxLength = 100;
    public const decimal MaxAmount = 999_999_999.99m;
    public const int MaxBulkOperations = 200;
    public const int BulkOperationsMaxPayloadSize = 1_048_576; // 1 MB
    public const int MaxTrackedKeysPerUser = 50;
    public const int DekCacheTtlMinutes = 5;
    public const int DefaultCacheTtlSeconds = 30;
    public const int GracePeriodDays = 3;
    public const int MaxPages = 100;
    public const int SearchResultLimit = 50;
    public const int SearchMinQueryLength = 2;
    public const int SearchPerSourceLimit = 25;
    public const int KdfIterations = 600_000;
}
