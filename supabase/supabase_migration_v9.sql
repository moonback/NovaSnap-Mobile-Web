-- =======================================================================
-- NOVASNAP — MIGRATION V9 (Ephemeral text messages + save feature)
-- ✅ Ajoute is_saved sur messages (sauvegarde manuelle style Snapchat)
-- ✅ Ajoute opened_by (tableau des user_ids ayant ouvert le message)
-- ✅ Met à jour la fonction de purge pour respecter is_saved
-- =======================================================================

-- 1. Colonne is_saved : message épinglé manuellement (long-press)
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS is_saved BOOLEAN NOT NULL DEFAULT FALSE;

-- 2. Colonne opened_by : liste des user_ids qui ont lu le message
--    Permet de déclencher la suppression côté client après lecture
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS opened_by UUID[] NOT NULL DEFAULT '{}';

-- 3. Index pour accélérer les requêtes de purge
CREATE INDEX IF NOT EXISTS idx_messages_ephemeral_unsaved
  ON public.messages (is_ephemeral, is_saved, created_at)
  WHERE is_ephemeral = TRUE AND is_saved = FALSE;

-- 4. Mise à jour de la fonction de purge pour exclure les messages sauvegardés
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
      AND is_saved = FALSE
      AND message_type IN ('IMAGE', 'VIDEO')
      AND (created_at + make_interval(secs => COALESCE(expires_in_seconds, 10))) < NOW()
  LOOP
    object_path := snap_record.media_url;

    IF object_path LIKE '%/storage/v1/object/%' THEN
      object_path := split_part(object_path, '/storage/v1/object/', 2);
      object_path := regexp_replace(object_path, '^sign/temporary_snaps/', '');
      object_path := regexp_replace(object_path, '^public/temporary_snaps/', '');
      object_path := split_part(object_path, '?', 1);
    END IF;

    BEGIN
      DELETE FROM storage.objects
      WHERE bucket_id = 'temporary_snaps'
        AND name = object_path;
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;

    DELETE FROM public.messages WHERE id = snap_record.id;
    deleted_count := deleted_count + 1;
  END LOOP;

  RETURN deleted_count;
END;
$$;

-- 5. Politique RLS : autoriser la mise à jour de is_saved et opened_by
--    par les membres de la conversation
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'messages' AND policyname = 'Members can update message save state'
  ) THEN
    CREATE POLICY "Members can update message save state"
      ON public.messages
      FOR UPDATE
      USING (
        EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.conversation_members cm
          WHERE cm.conversation_id = messages.conversation_id
            AND cm.user_id = auth.uid()
        )
      );
  END IF;
END $$;
