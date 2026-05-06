using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Application.Currency;
using Pulpe.Application.Currency.Dto;
using Pulpe.Domain.Currency;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/currency")]
[Authorize]
public class CurrencyController : ControllerBase
{
    private readonly ICurrencyService _currencyService;

    public CurrencyController(ICurrencyService currencyService)
    {
        _currencyService = currencyService;
    }

    [HttpGet("rate")]
    public async Task<IActionResult> GetRate(
        [FromQuery] string baseCurrency,
        [FromQuery] string targetCurrency,
        CancellationToken ct)
    {
        var baseEnum = CurrencyExtensions.FromIsoCode(baseCurrency);
        var targetEnum = CurrencyExtensions.FromIsoCode(targetCurrency);

        if (baseEnum is null || targetEnum is null)
            return BadRequest(new { error = "Unsupported currency code" });

        var result = await _currencyService.GetRate(baseEnum.Value, targetEnum.Value, ct);
        return Ok(new CurrencyRateResponseDto(result.Base, result.Target, result.Rate, result.Date));
    }
}
