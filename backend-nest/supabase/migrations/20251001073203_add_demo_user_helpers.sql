-- Migration: Add helper functions for demo user cleanup
-- Description: Creates utility functions to identify and manage demo users
-- Date: 2025-10-01

-- Function to get demo users that need to be cleaned up (older than specified hours)
-- Returns user_id and created_at for demo users older than the cutoff
CREATE OR REPLACE FUNCTION get_demo_users_to_cleanup(max_age_hours INTEGER DEFAULT 24)
RETURNS TABLE(user_id UUID, created_at TIMESTAMPTZ, email TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    id::UUID as user_id,
    au.created_at,
    au.email
  FROM auth.users au
  WHERE
    (au.raw_user_meta_data->>'is_demo')::BOOLEAN = TRUE
    AND au.created_at < NOW() - (max_age_hours || ' hours')::INTERVAL
  ORDER BY au.created_at ASC;
END;
$$;

-- Function to count current demo users
CREATE OR REPLACE FUNCTION count_demo_users()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  demo_count INTEGER;
BEGIN
  SELECT COUNT(*)::INTEGER INTO demo_count
  FROM auth.users
  WHERE (raw_user_meta_data->>'is_demo')::BOOLEAN = TRUE;

  RETURN demo_count;
END;
$$;

-- Function to get demo user statistics
CREATE OR REPLACE FUNCTION get_demo_user_stats()
RETURNS TABLE(
  total_demo_users INTEGER,
  demo_users_last_24h INTEGER,
  demo_users_to_cleanup INTEGER
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER
     FROM auth.users
     WHERE (raw_user_meta_data->>'is_demo')::BOOLEAN = TRUE) as total_demo_users,

    (SELECT COUNT(*)::INTEGER
     FROM auth.users
     WHERE (raw_user_meta_data->>'is_demo')::BOOLEAN = TRUE
     AND created_at >= NOW() - INTERVAL '24 hours') as demo_users_last_24h,

    (SELECT COUNT(*)::INTEGER
     FROM auth.users
     WHERE (raw_user_meta_data->>'is_demo')::BOOLEAN = TRUE
     AND created_at < NOW() - INTERVAL '24 hours') as demo_users_to_cleanup;
END;
$$;

-- Add comments for documentation
COMMENT ON FUNCTION get_demo_users_to_cleanup IS
'Returns demo users older than max_age_hours (default 24) that need to be cleaned up';

COMMENT ON FUNCTION count_demo_users IS
'Returns the total count of active demo users';

COMMENT ON FUNCTION get_demo_user_stats IS
'Returns statistics about demo users including total, recent, and pending cleanup';
