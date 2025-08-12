-- Fix function search_path security warnings
-- Set search_path to empty string for security functions

-- Fix auto_confirm_user function
ALTER FUNCTION public.auto_confirm_user() SET search_path = '';

-- Fix bulk_update_template_lines function  
ALTER FUNCTION public.bulk_update_template_lines(
    template_id UUID,
    lines JSONB
) SET search_path = '';