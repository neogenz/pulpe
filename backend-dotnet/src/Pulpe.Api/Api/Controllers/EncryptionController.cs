using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.AspNetCore.RateLimiting;
using Pulpe.Api.Api.Auth;
using Pulpe.Infrastructure.Services.Encryption;
using Pulpe.Application.Encryption.Dto;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/encryption")]
[Authorize]
public class EncryptionController : ControllerBase
{
    private readonly IEncryptionAppService _encryptionService;

    public EncryptionController(IEncryptionAppService encryptionService)
    {
        _encryptionService = encryptionService;
    }

    [HttpGet("vault-status")]
    [SkipClientKey]
    public async Task<IActionResult> GetVaultStatus()
    {
        var user = HttpContext.GetUser();
        var result = await _encryptionService.GetVaultStatusAsync(user.Id);
        return Ok(result);
    }

    [HttpGet("salt")]
    [SkipClientKey]
    public async Task<IActionResult> GetSalt()
    {
        var user = HttpContext.GetUser();
        var result = await _encryptionService.GetSaltAsync(user.Id);
        return Ok(result);
    }

    [HttpPost("validate-key")]
    [SkipClientKey]
    [EnableRateLimiting("encryption-validate")]
    public async Task<IActionResult> ValidateKey([FromBody] EncryptionValidateKeyRequestDto body)
    {
        var user = HttpContext.GetUser();
        await _encryptionService.ValidateKeyAsync(user.Id, body.ClientKey);
        return NoContent();
    }

    [HttpPost("setup-recovery")]
    [EnableRateLimiting("encryption-sensitive")]
    public async Task<IActionResult> SetupRecovery()
    {
        var user = HttpContext.GetUser();
        var result = await _encryptionService.SetupRecoveryAsync(user.Id, user.ClientKey);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("regenerate-recovery")]
    [EnableRateLimiting("encryption-sensitive")]
    public async Task<IActionResult> RegenerateRecovery()
    {
        var user = HttpContext.GetUser();
        var result = await _encryptionService.RegenerateRecoveryAsync(user.Id, user.ClientKey);
        return StatusCode(StatusCodes.Status201Created, result);
    }

    [HttpPost("recover")]
    [SkipClientKey]
    [EnableRateLimiting("encryption-sensitive")]
    public async Task<IActionResult> Recover([FromBody] EncryptionRecoverRequestDto body)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _encryptionService.RecoverAsync(user.Id, body.RecoveryKey, body.NewClientKey, supabase);
        return Ok(result);
    }

    [HttpPost("change-pin")]
    [SkipClientKey]
    [EnableRateLimiting("encryption-sensitive")]
    public async Task<IActionResult> ChangePin([FromBody] EncryptionChangePinRequestDto body)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _encryptionService.ChangePinAsync(user.Id, body.OldClientKey, body.NewClientKey, supabase);
        return Ok(result);
    }
}
