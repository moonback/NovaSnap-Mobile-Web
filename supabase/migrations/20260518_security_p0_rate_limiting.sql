-- Security P0: Rate limiting, daily quotas, and structured security event logging
-- Date: 2026-05-18

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. SECURITY EVENTS TABLE
--    Persists structured security events from both the WS server and DB layer.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.security_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    timestamptz NOT NULL DEFAULT now(),
  event_type    text        NOT NULL,          -- e.g. 'ws_rate_limit_ip', 'quota_exceeded', 'abuse_detected'
  severity      text        NOT NULL DEFAULT 'warn' CHECK (severity IN ('info', 'warn', 'error', 'critical')),
  user_id       uuid        REFERENCES auth.users(id) ON DELETE SET NULL,
  ip_address    text,
  resource_type text,                          -- 'message' | 'story' | 'upload' | 'ai_session'
  details       jsonb       NOT NULL DEFAULT '{}'::jsonb
);

-- Index for dashboard queries
CREATE INDEX IF NOT EXISTS security_events_created_at_idx  ON public.security_events (created_at DESC);
CREATE INDEX IF NOT EXISTS security_events_event_type_idx  ON public.security_events (event_type);
CREATE INDEX IF NOT EXISTS security_events_user_id_idx     ON public.security_events (user_id) WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS security_events_severity_idx    ON public.security_events (severity);

-- RLS: only service role can insert; authenticated users can read their own events
ALTER TABLE public.security_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access security_events"
ON public.security_events
USING (auth.role() = 'service_role');

CREATE POLICY "Users read own security events"
ON public.security_events FOR SELECT
USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 2. DAILY USAGE TABLE
--    Tracks per-user daily counts for messages, stories, uploads, and AI sessions.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.daily_usage (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date      date        NOT NULL DEFAULT CURRENT_DATE,
  resource_type   text        NOT NULL CHECK (resource_type IN ('message', 'story', 'upload', 'ai_session')),
  count           integer     NOT NULL DEFAULT 0 CHECK (count >= 0),
  UNIQUE (user_id, usage_date, resource_type)
);

CREATE INDEX IF NOT EXISTS daily_usage_user_date_idx ON public.daily_usage (user_id, usage_date);

-- RLS: users can only see their own usage; service role has full access
ALTER TABLE public.daily_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access daily_usage"
ON public.daily_usage
USING (auth.role() = 'service_role');

CREATE POLICY "Users read own daily usage"
ON public.daily_usage FOR SELECT
USING (auth.uid() = user_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- 3. QUOTA CONFIGURATION TABLE
--    Allows per-resource-type daily limits to be adjusted without code changes.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.quota_config (
  resource_type   text    PRIMARY KEY CHECK (resource_type IN ('message', 'story', 'upload', 'ai_session')),
  daily_limit     integer NOT NULL CHECK (daily_limit > 0),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- Default quotas (conservative anti-abuse values)
INSERT INTO public.quota_config (resource_type, daily_limit) VALUES
  ('message',    500),
  ('story',      20),
  ('upload',     100),
  ('ai_session', 30)
ON CONFLICT (resource_type) DO NOTHING;

-- Only service role can modify quotas
ALTER TABLE public.quota_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access quota_config"
ON public.quota_config
USING (auth.role() = 'service_role');

CREATE POLICY "Authenticated read quota_config"
ON public.quota_config FOR SELECT
USING (auth.role() = 'authenticated');


-- ─────────────────────────────────────────────────────────────────────────────
-- 4. CORE FUNCTION: check_and_increment_quota
--    Atomically checks the daily quota and increments the counter.
--    Returns TRUE if the action is allowed, FALSE if the quota is exceeded.
--    SECURITY DEFINER so it can bypass RLS on daily_usage while still
--    enforcing the quota for the calling user.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_and_increment_quota(
  p_resource_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     uuid := auth.uid();
  v_today       date := CURRENT_DATE;
  v_current     integer;
  v_limit       integer;
BEGIN
  -- Must be authenticated
  IF v_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  -- Get the configured daily limit for this resource type
  SELECT daily_limit INTO v_limit
  FROM public.quota_config
  WHERE resource_type = p_resource_type;

  IF v_limit IS NULL THEN
    -- Unknown resource type — deny by default
    RETURN FALSE;
  END IF;

  -- Upsert the daily usage row and get the new count atomically
  INSERT INTO public.daily_usage (user_id, usage_date, resource_type, count)
  VALUES (v_user_id, v_today, p_resource_type, 1)
  ON CONFLICT (user_id, usage_date, resource_type)
  DO UPDATE SET count = daily_usage.count + 1
  RETURNING count INTO v_current;

  IF v_current > v_limit THEN
    -- Roll back the increment — quota exceeded
    UPDATE public.daily_usage
    SET count = count - 1
    WHERE user_id = v_user_id
      AND usage_date = v_today
      AND resource_type = p_resource_type;

    -- Log the abuse event
    INSERT INTO public.security_events (event_type, severity, user_id, resource_type, details)
    VALUES (
      'quota_exceeded',
      'warn',
      v_user_id,
      p_resource_type,
      jsonb_build_object(
        'current_count', v_current,
        'daily_limit',   v_limit,
        'date',          v_today
      )
    );

    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

-- Grant execute to authenticated users (they call this via RPC)
GRANT EXECUTE ON FUNCTION public.check_and_increment_quota(text) TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 4b. SERVICE-ROLE VARIANT: check_and_increment_quota_for_user
--     Called by the Node WS server (service role) to enforce AI session quotas.
--     Accepts an explicit user_id instead of relying on auth.uid().
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.check_and_increment_quota_for_user(
  p_user_id       uuid,
  p_resource_type text
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today   date    := CURRENT_DATE;
  v_current integer;
  v_limit   integer;
BEGIN
  IF p_user_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT daily_limit INTO v_limit
  FROM public.quota_config
  WHERE resource_type = p_resource_type;

  IF v_limit IS NULL THEN
    RETURN FALSE;
  END IF;

  INSERT INTO public.daily_usage (user_id, usage_date, resource_type, count)
  VALUES (p_user_id, v_today, p_resource_type, 1)
  ON CONFLICT (user_id, usage_date, resource_type)
  DO UPDATE SET count = daily_usage.count + 1
  RETURNING count INTO v_current;

  IF v_current > v_limit THEN
    UPDATE public.daily_usage
    SET count = count - 1
    WHERE user_id = p_user_id
      AND usage_date = v_today
      AND resource_type = p_resource_type;

    INSERT INTO public.security_events (event_type, severity, user_id, resource_type, details)
    VALUES (
      'quota_exceeded',
      'warn',
      p_user_id,
      p_resource_type,
      jsonb_build_object(
        'current_count', v_current,
        'daily_limit',   v_limit,
        'date',          v_today,
        'source',        'ws_server'
      )
    );

    RETURN FALSE;
  END IF;

  RETURN TRUE;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.check_and_increment_quota_for_user(uuid, text) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.check_and_increment_quota_for_user(uuid, text) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 5. HELPER FUNCTION: get_daily_usage
--    Returns the current usage counts for the calling user today.
--    Used by the client to display quota status.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.get_daily_usage()
RETURNS TABLE (
  resource_type text,
  count         integer,
  daily_limit   integer,
  remaining     integer
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    qc.resource_type,
    COALESCE(du.count, 0)                          AS count,
    qc.daily_limit,
    GREATEST(0, qc.daily_limit - COALESCE(du.count, 0)) AS remaining
  FROM public.quota_config qc
  LEFT JOIN public.daily_usage du
    ON du.user_id = auth.uid()
   AND du.usage_date = CURRENT_DATE
   AND du.resource_type = qc.resource_type
  ORDER BY qc.resource_type;
$$;

GRANT EXECUTE ON FUNCTION public.get_daily_usage() TO authenticated;


-- ─────────────────────────────────────────────────────────────────────────────
-- 6. HELPER FUNCTION: log_security_event
--    Called by the Node WS server (via service role) to persist security events.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.log_security_event(
  p_event_type    text,
  p_severity      text DEFAULT 'warn',
  p_user_id       uuid DEFAULT NULL,
  p_ip_address    text DEFAULT NULL,
  p_resource_type text DEFAULT NULL,
  p_details       jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  INSERT INTO public.security_events (event_type, severity, user_id, ip_address, resource_type, details)
  VALUES (p_event_type, p_severity, p_user_id, p_ip_address, p_resource_type, p_details)
  RETURNING id;
$$;

-- Only service role should call this directly (WS server uses service role key)
REVOKE EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, text, text, jsonb) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.log_security_event(text, text, uuid, text, text, jsonb) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 7. MONITORING VIEW: security_events_dashboard
--    Aggregated view for abuse monitoring — last 24h event counts by type.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.security_events_dashboard AS
SELECT
  event_type,
  severity,
  resource_type,
  COUNT(*)                                          AS event_count,
  COUNT(DISTINCT user_id)                           AS unique_users,
  COUNT(DISTINCT ip_address)                        AS unique_ips,
  MAX(created_at)                                   AS last_seen,
  MIN(created_at)                                   AS first_seen
FROM public.security_events
WHERE created_at >= now() - INTERVAL '24 hours'
GROUP BY event_type, severity, resource_type
ORDER BY event_count DESC;

-- Only service role can query the dashboard view
REVOKE ALL ON public.security_events_dashboard FROM PUBLIC;
GRANT  SELECT ON public.security_events_dashboard TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 8. CLEANUP FUNCTION: purge_old_security_events
--    Keeps the security_events table from growing unbounded.
--    Call via pg_cron or a scheduled Edge Function.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_old_security_events(
  p_retention_days integer DEFAULT 30
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.security_events
    WHERE created_at < now() - (p_retention_days || ' days')::interval
    RETURNING id
  )
  SELECT COUNT(*)::integer FROM deleted;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_security_events(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.purge_old_security_events(integer) TO service_role;


-- ─────────────────────────────────────────────────────────────────────────────
-- 9. CLEANUP FUNCTION: purge_old_daily_usage
--    Removes daily_usage rows older than 7 days (only today's data is needed
--    for quota enforcement; historical data is in security_events).
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.purge_old_daily_usage(
  p_retention_days integer DEFAULT 7
)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  WITH deleted AS (
    DELETE FROM public.daily_usage
    WHERE usage_date < CURRENT_DATE - p_retention_days
    RETURNING id
  )
  SELECT COUNT(*)::integer FROM deleted;
$$;

REVOKE EXECUTE ON FUNCTION public.purge_old_daily_usage(integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.purge_old_daily_usage(integer) TO service_role;

COMMIT;
