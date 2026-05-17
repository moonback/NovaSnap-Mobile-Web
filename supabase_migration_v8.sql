-- =======================================================================
-- NOVASNAP — MIGRATION V8 (Temporary snaps TTL cleanup)
-- ✅ Ajoute une fonction de purge des objets et rows expirés
-- ✅ Prépare une exécution planifiée (pg_cron) si disponible
-- =======================================================================

-- Purge DB rows + storage objects for expired temporary snaps.
-- Assumption: media_url stores Supabase object path or signed URL that embeds path.
CREATE OR REPLACE FUNCTION public.purge_expired_temporary_snaps()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  snap_record RECORD;
  deleted_count INTEGER := 0;
  object_path TEXT;
BEGIN
  FOR snap_record IN
    SELECT id, media_url
    FROM public.messages
    WHERE is_ephemeral = TRUE
      AND message_type IN ('IMAGE', 'VIDEO')
      AND (created_at + make_interval(secs => COALESCE(expires_in_seconds, 10))) < NOW()
  LOOP
    -- Extract storage path heuristically when URL is signed/full URL.
    object_path := snap_record.media_url;

    IF object_path LIKE '%/storage/v1/object/%' THEN
      object_path := split_part(object_path, '/storage/v1/object/', 2);
      object_path := regexp_replace(object_path, '^sign/temporary_snaps/', '');
      object_path := regexp_replace(object_path, '^public/temporary_snaps/', '');
      object_path := split_part(object_path, '?', 1);
    END IF;

    BEGIN
      -- Best-effort delete in storage metadata table (actual file cleanup handled by Storage API backend).
      DELETE FROM storage.objects
      WHERE bucket_id = 'temporary_snaps'
        AND name = object_path;
    EXCEPTION WHEN OTHERS THEN
      -- Keep purge resilient; continue with DB row deletion.
      NULL;
    END;

    DELETE FROM public.messages WHERE id = snap_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- Optional scheduler (requires pg_cron enabled in Supabase project):
-- SELECT cron.schedule(
--   'purge-expired-temporary-snaps-every-5m',
--   '*/5 * * * *',
--   $$SELECT public.purge_expired_temporary_snaps();$$
-- );
