-- Fix: Remove the trigger that automatically marks budget lines as manually adjusted
-- when their template_line_id becomes NULL due to template line deletion.
--
-- Context: Migration 20250925000000 creates this trigger, but it causes an issue:
-- When users delete a template line with "template-only" mode (no propagation),
-- the FK constraint sets template_line_id to NULL, which triggers is_manually_adjusted = true.
-- This is incorrect - the flag should only be true for explicit user modifications.
--
-- Solution: Remove the trigger to align with business rule RG-001:
-- - "Ne rien propager": Only modifies template, existing budgets remain unchanged
-- - "Propager": Modifies template AND propagates to current/future budgets

-- Drop the existing trigger
DROP TRIGGER IF EXISTS mark_budget_line_manual_on_template_detach ON public.budget_line;

-- Drop the trigger function
DROP FUNCTION IF EXISTS public.mark_budget_line_manual_on_template_detach();

-- Note: The is_manually_adjusted flag should only be set to true when:
-- 1. The user explicitly modifies a budget line's amount or description
-- 2. The user explicitly detaches a budget line from its template
-- It should NOT be set automatically when a template line is deleted without propagation.