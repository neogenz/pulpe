using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Pulpe.Api.Api.Auth;
using Pulpe.Api.Application.Transaction;
using Pulpe.Api.Application.Transaction.Dto;
using Pulpe.Api.Infrastructure.Supabase;

namespace Pulpe.Api.Api.Controllers;

[ApiController]
[Route("api/v1/transactions")]
[Authorize]
public class TransactionsController : ControllerBase
{
    private readonly ITransactionService _transactionService;

    public TransactionsController(ITransactionService transactionService)
    {
        _transactionService = transactionService;
    }

    [HttpGet("budget/{budgetId:guid}")]
    public async Task<IActionResult> FindByBudget(Guid budgetId)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.FindByBudgetAsync(budgetId, user, supabase);
        return Ok(result);
    }

    [HttpGet("budget-line/{budgetLineId:guid}")]
    public async Task<IActionResult> FindByBudgetLine(Guid budgetLineId)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.FindByBudgetLineAsync(budgetLineId, user, supabase);
        return Ok(result);
    }

    [HttpGet("search")]
    public async Task<IActionResult> Search([FromQuery] string q, [FromQuery] int[]? years)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.SearchAsync(q, years, user, supabase);
        return Ok(result);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] TransactionCreateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.CreateAsync(dto, user, supabase);
        return Created(string.Empty, result);
    }

    [HttpGet("{id:guid}")]
    public async Task<IActionResult> FindOne(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.FindOneAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpPatch("{id:guid}")]
    public async Task<IActionResult> Update(Guid id, [FromBody] TransactionUpdateDto dto)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.UpdateAsync(id, dto, user, supabase);
        return Ok(result);
    }

    [HttpDelete("{id:guid}")]
    public async Task<IActionResult> Remove(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.RemoveAsync(id, user, supabase);
        return Ok(result);
    }

    [HttpPost("{id:guid}/toggle-check")]
    public async Task<IActionResult> ToggleCheck(Guid id)
    {
        var user = HttpContext.GetUser();
        var supabase = (SupabaseRestClient)HttpContext.GetSupabaseClient();
        var result = await _transactionService.ToggleCheckAsync(id, user, supabase);
        return Ok(result);
    }
}
