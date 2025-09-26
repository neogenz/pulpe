-- Fix security issue: Function has a role mutable search_path
-- Set search_path to empty string to prevent potential security vulnerabilities
-- Following the established pattern from migration 20250812064249

-- Fix mark_budget_line_manual_on_template_detach function
ALTER FUNCTION public.mark_budget_line_manual_on_template_detach() SET search_path = '';