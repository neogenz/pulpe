using System.Text.Json;
using System.Text.Json.Serialization;

namespace Pulpe.Domain.Common;

[JsonConverter(typeof(JsonStringEnumConverter<TransactionKind>))]
public enum TransactionKind
{
    [JsonStringEnumMemberName("income")]
    Income,
    [JsonStringEnumMemberName("expense")]
    Expense,
    [JsonStringEnumMemberName("saving")]
    Saving
}

[JsonConverter(typeof(JsonStringEnumConverter<TransactionRecurrence>))]
public enum TransactionRecurrence
{
    [JsonStringEnumMemberName("fixed")]
    Fixed,
    [JsonStringEnumMemberName("one_off")]
    OneOff
}

[JsonConverter(typeof(JsonStringEnumConverter<PriorityLevel>))]
public enum PriorityLevel
{
    [JsonStringEnumMemberName("HIGH")]
    High,
    [JsonStringEnumMemberName("MEDIUM")]
    Medium,
    [JsonStringEnumMemberName("LOW")]
    Low
}

[JsonConverter(typeof(JsonStringEnumConverter<SavingsGoalStatus>))]
public enum SavingsGoalStatus
{
    [JsonStringEnumMemberName("ACTIVE")]
    Active,
    [JsonStringEnumMemberName("COMPLETED")]
    Completed,
    [JsonStringEnumMemberName("PAUSED")]
    Paused
}
