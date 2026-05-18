-- ========== MIGRATION V11: ONLINE STATUS SYSTEM ==========
-- Ajoute le système de statut en ligne avec contrôle de confidentialité

-- 1. Ajouter les colonnes de présence à la table users
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ DEFAULT NOW(),
  ADD COLUMN IF NOT EXISTS online_status_visibility TEXT DEFAULT 'FRIENDS' CHECK (online_status_visibility IN ('EVERYONE', 'FRIENDS', 'NOBODY'));

-- 2. Index pour optimiser les requêtes de statut en ligne
CREATE INDEX IF NOT EXISTS idx_users_last_seen
  ON public.users(last_seen_at DESC);

-- 3. Fonction pour mettre à jour le heartbeat (last_seen_at)
CREATE OR REPLACE FUNCTION public.update_user_heartbeat()
RETURNS void AS $$
BEGIN
  UPDATE public.users
  SET last_seen_at = NOW()
  WHERE id = auth.uid();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Fonction pour obtenir le statut en ligne d'un utilisateur (avec respect de la confidentialité)
CREATE OR REPLACE FUNCTION public.get_user_online_status(target_user_id UUID)
RETURNS TABLE(
  is_online BOOLEAN,
  last_seen_at TIMESTAMPTZ,
  can_view BOOLEAN
) AS $$
DECLARE
  target_visibility TEXT;
  is_friend BOOLEAN;
BEGIN
  -- Récupérer les paramètres de confidentialité de l'utilisateur cible
  SELECT online_status_visibility INTO target_visibility
  FROM public.users
  WHERE id = target_user_id;

  -- Vérifier si l'utilisateur actuel est ami avec la cible
  SELECT EXISTS(
    SELECT 1 FROM public.friendships
    WHERE status = 'ACCEPTED'
      AND ((user_id = auth.uid() AND friend_id = target_user_id)
        OR (user_id = target_user_id AND friend_id = auth.uid()))
  ) INTO is_friend;

  -- Déterminer si l'utilisateur peut voir le statut
  IF target_visibility = 'NOBODY' THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, false;
  ELSIF target_visibility = 'FRIENDS' AND NOT is_friend THEN
    RETURN QUERY SELECT false, NULL::TIMESTAMPTZ, false;
  ELSE
    -- L'utilisateur peut voir le statut
    RETURN QUERY
    SELECT
      (u.last_seen_at > NOW() - INTERVAL '5 minutes') AS is_online,
      u.last_seen_at,
      true AS can_view
    FROM public.users u
    WHERE u.id = target_user_id;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Fonction pour obtenir les statuts en ligne de plusieurs utilisateurs (batch)
CREATE OR REPLACE FUNCTION public.get_batch_online_status(user_ids UUID[])
RETURNS TABLE(
  user_id UUID,
  is_online BOOLEAN,
  last_seen_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    u.id AS user_id,
    (u.last_seen_at > NOW() - INTERVAL '5 minutes') AS is_online,
    CASE
      WHEN u.online_status_visibility = 'NOBODY' THEN NULL
      WHEN u.online_status_visibility = 'FRIENDS' AND NOT EXISTS(
        SELECT 1 FROM public.friendships f
        WHERE f.status = 'ACCEPTED'
          AND ((f.user_id = auth.uid() AND f.friend_id = u.id)
            OR (f.user_id = u.id AND f.friend_id = auth.uid()))
      ) THEN NULL
      ELSE u.last_seen_at
    END AS last_seen_at
  FROM public.users u
  WHERE u.id = ANY(user_ids);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger pour mettre à jour updated_at lors de la modification de last_seen_at
CREATE OR REPLACE FUNCTION public.update_users_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_update_users_updated_at ON public.users;
CREATE TRIGGER trigger_update_users_updated_at
  BEFORE UPDATE ON public.users
  FOR EACH ROW
  EXECUTE FUNCTION public.update_users_updated_at();

-- 7. Ajouter la publication realtime pour les changements de statut en ligne
-- (Optionnel : permet aux clients de s'abonner aux changements de last_seen_at)
ALTER PUBLICATION supabase_realtime ADD TABLE public.users;

COMMENT ON COLUMN public.users.last_seen_at IS 'Dernière activité de l''utilisateur (mise à jour toutes les 30s)';
COMMENT ON COLUMN public.users.online_status_visibility IS 'Qui peut voir le statut en ligne: EVERYONE, FRIENDS, NOBODY';
COMMENT ON FUNCTION public.update_user_heartbeat() IS 'Met à jour le heartbeat de l''utilisateur connecté';
COMMENT ON FUNCTION public.get_user_online_status(UUID) IS 'Récupère le statut en ligne d''un utilisateur avec respect de la confidentialité';
COMMENT ON FUNCTION public.get_batch_online_status(UUID[]) IS 'Récupère les statuts en ligne de plusieurs utilisateurs en batch';
