using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Application.Budget.Dto;
using Pulpe.Infrastructure.Services.Budget;
using Pulpe.Infrastructure.Supabase;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/budgets")]
[Authorize]
public class BudgetsController : ControllerBase
{
    private readonly IBudgetService _budgetService;

    public BudgetsController(IBudgetService budgetService)
    {
        _budgetService = budgetService;
    }

    [HttpGet]
    public async Task<IActionResult> FindAll([FromQuery] ListBudgetsQueryDto query)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.FindAllAsync(user, supabase, query);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] BudgetCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.CreateAsync(dto, user, supabase);
        return Created(string.Empty, result);
    }

    [HttpGet("export")]
    public async Task<IActionResult> ExportAll()
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.ExportAllAsync(user, supabase);
        return Ok(result);
    }

    [HttpGet("exists")]
    public async Task<IActionResult> CheckExists()
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var hasBudget = await _budgetService.HasBudgetsAsync(user, supabase);
        return Ok(new { hasBudget });
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.FindOneAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpGet("{id:guid}/details")]
    public async Task<IActionResult> FindOneWithDetails(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.FindOneWithDetailsAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] BudgetUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.UpdateAsync(id, dto, user, supabase);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _budgetService.RemoveAsync(id, user, supabase);
        return Ok(result);
    }
}
