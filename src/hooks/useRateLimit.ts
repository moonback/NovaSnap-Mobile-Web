/**
 * useRateLimit
 *
 * Client-side hook that calls the `check-rate-limit` Edge Function before
 * performing a write operation. Returns a `checkQuota` function that resolves
 * to `true` when the action is allowed, or throws a `QuotaExceededError` when
 * the daily quota or IP rate limit has been exceeded.
 *
 * Usage:
 *   const { checkQuota, usage, refreshUsage } = useRateLimit();
 *
 *   // Before sending a message:
 *   const allowed = await checkQuota('message');
 *   if (!allowed) return; // quota exceeded — error already shown via toast
 */

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAppStore } from '../store/useAppStore';

// ── Types ─────────────────────────────────────────────────────

export type ResourceType = 'message' | 'story' | 'upload' | 'ai_session';

export interface DailyUsageRow {
  resource_type: ResourceType;
  count: number;
  daily_limit: number;
  remaining: number;
}

export class QuotaExceededError extends Error {
  constructor(
    public readonly resourceType: ResourceType,
    public readonly retryAfter: string | undefined,
    public readonly dailyLimit: number | undefined,
    public readonly currentCount: number | undefined,
  ) {
    super(`Daily ${resourceType} quota exceeded.`);
    this.name = 'QuotaExceededError';
  }
}

// ── Hook ──────────────────────────────────────────────────────

export function useRateLimit() {
  const { user } = useAppStore();
  const [usage, setUsage] = useState<DailyUsageRow[]>([]);
  const [loadingUsage, setLoadingUsage] = useState(false);

  /** Fetch the current daily usage for all resource types. */
  const refreshUsage = useCallback(async () => {
    if (!user) return;
    setLoadingUsage(true);
    try {
      const { data, error } = await supabase.rpc('get_daily_usage');
      if (!error && data) {
        setUsage(data as DailyUsageRow[]);
      }
    } finally {
      setLoadingUsage(false);
    }
  }, [user]);

  useEffect(() => {
    refreshUsage();
  }, [refreshUsage]);

  /**
   * Calls the `check-rate-limit` Edge Function.
   *
   * @returns `true` if the action is allowed.
   * @throws  `QuotaExceededError` if the quota or IP rate limit is exceeded.
   * @throws  `Error` for unexpected failures (network, auth, etc.).
   */
  const checkQuota = useCallback(
    async (resourceType: ResourceType): Promise<true> => {
      if (!user) throw new Error('Not authenticated');

      // Get the current session JWT to pass as Bearer token
      const { data: sessionData } = await supabase.auth.getSession();
      const jwt = sessionData?.session?.access_token;
      if (!jwt) throw new Error('No active session');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string;

      const response = await fetch(
        `${supabaseUrl}/functions/v1/check-rate-limit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${jwt}`,
            'apikey': supabaseAnonKey,
          },
          body: JSON.stringify({ resource_type: resourceType }),
        },
      );

      const json = await response.json() as {
        allowed: boolean;
        resource_type: string;
        reason?: string;
        retry_after?: string;
        daily_limit?: number;
        current_count?: number;
      };

      if (!json.allowed) {
        // Refresh local usage state so UI reflects the current counts
        void refreshUsage();
        throw new QuotaExceededError(
          resourceType,
          json.retry_after,
          json.daily_limit,
          json.current_count,
        );
      }

      // Optimistically update local usage state
      setUsage((prev) =>
        prev.map((row) =>
          row.resource_type === resourceType
            ? { ...row, count: row.count + 1, remaining: Math.max(0, row.remaining - 1) }
            : row,
        ),
      );

      return true;
    },
    [user, refreshUsage],
  );

  return { checkQuota, usage, loadingUsage, refreshUsage };
}
