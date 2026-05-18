-- ========== MIGRATION V12: PUSH NOTIFICATIONS SYSTEM ==========

-- 1. Table pour stocker les tokens de push notification (Web Push subscriptions)
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  endpoint    TEXT NOT NULL,
  p256dh      TEXT NOT NULL,  -- clé publique du client
  auth        TEXT NOT NULL,  -- secret d'authentification
  user_agent  TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, endpoint)
);

-- Index pour les lookups par user_id
CREATE INDEX IF NOT EXISTS idx_push_subscriptions_user
  ON public.push_subscriptions(user_id);

-- RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own push subscriptions"
  ON public.push_subscriptions
  FOR ALL
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- 2. Table pour les notifications in-app (badge + historique)
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (type IN (
                'NEW_MESSAGE', 'SNAP_OPENED', 'FRIEND_REQUEST',
                'FRIEND_ACCEPTED', 'NEW_STORY', 'SNAP_SCREENSHOT'
              )),
  title       TEXT NOT NULL,
  body        TEXT NOT NULL,
  data        JSONB DEFAULT '{}',   -- payload arbitraire (conversation_id, sender_id, etc.)
  is_read     BOOLEAN DEFAULT FALSE,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON public.notifications(user_id, is_read, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read their own notifications"
  ON public.notifications FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "Users can mark their notifications as read"
  ON public.notifications FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "System can insert notifications"
  ON public.notifications FOR INSERT
  WITH CHECK (true);  -- Les triggers SECURITY DEFINER peuvent insérer

-- 3. Fonction utilitaire : créer une notification
CREATE OR REPLACE FUNCTION public.create_notification(
  p_user_id   UUID,
  p_type      TEXT,
  p_title     TEXT,
  p_body      TEXT,
  p_data      JSONB DEFAULT '{}'
)
RETURNS UUID AS $$
DECLARE
  v_id UUID;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, body, data)
  VALUES (p_user_id, p_type, p_title, p_body, p_data)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Trigger : notification lors d'un nouveau message
CREATE OR REPLACE FUNCTION public.notify_new_message()
RETURNS TRIGGER AS $$
DECLARE
  v_member    RECORD;
  v_sender    RECORD;
  v_conv      RECORD;
  v_title     TEXT;
  v_body      TEXT;
BEGIN
  -- Récupérer le profil de l'expéditeur
  SELECT display_name, username INTO v_sender
  FROM public.users WHERE id = NEW.sender_id;

  -- Récupérer le titre de la conversation
  SELECT title, is_group INTO v_conv
  FROM public.conversations WHERE id = NEW.conversation_id;

  -- Construire le message de notification
  v_title := COALESCE(v_sender.display_name, v_sender.username, 'Quelqu''un');
  IF NEW.message_type = 'IMAGE' THEN
    v_body := '📸 T''a envoyé un Snap photo';
  ELSIF NEW.message_type = 'VIDEO' THEN
    v_body := '🎥 T''a envoyé un Snap vidéo';
  ELSIF NEW.message_type = 'AUDIO' THEN
    v_body := '🎤 T''a envoyé un message vocal';
  ELSE
    v_body := COALESCE(NEW.content, 'Nouveau message');
    IF char_length(v_body) > 80 THEN
      v_body := left(v_body, 80) || '…';
    END IF;
  END IF;

  -- Notifier tous les membres sauf l'expéditeur
  FOR v_member IN
    SELECT user_id FROM public.conversation_members
    WHERE conversation_id = NEW.conversation_id
      AND user_id <> NEW.sender_id
  LOOP
    PERFORM public.create_notification(
      v_member.user_id,
      'NEW_MESSAGE',
      v_title,
      v_body,
      jsonb_build_object(
        'conversation_id', NEW.conversation_id,
        'sender_id',       NEW.sender_id,
        'message_id',      NEW.id,
        'message_type',    NEW.message_type
      )
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_message ON public.messages;
CREATE TRIGGER trigger_notify_new_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_message();

-- 5. Trigger : notification quand un snap est ouvert
CREATE OR REPLACE FUNCTION public.notify_snap_opened()
RETURNS TRIGGER AS $$
DECLARE
  v_msg       RECORD;
  v_opener    RECORD;
BEGIN
  -- Seulement pour les transitions vers OPENED
  IF NEW.status <> 'OPENED' THEN RETURN NEW; END IF;
  IF OLD.status = 'OPENED' THEN RETURN NEW; END IF;

  -- Récupérer le message
  SELECT sender_id, message_type INTO v_msg
  FROM public.messages WHERE id = NEW.message_id;

  -- Récupérer le profil de celui qui a ouvert
  SELECT display_name, username INTO v_opener
  FROM public.users WHERE id = NEW.user_id;

  -- Notifier l'expéditeur original
  IF v_msg.sender_id IS NOT NULL AND v_msg.sender_id <> NEW.user_id THEN
    PERFORM public.create_notification(
      v_msg.sender_id,
      'SNAP_OPENED',
      COALESCE(v_opener.display_name, v_opener.username, 'Quelqu''un') || ' a ouvert ton Snap',
      CASE v_msg.message_type
        WHEN 'IMAGE' THEN '👀 Ton Snap photo a été ouvert'
        WHEN 'VIDEO' THEN '👀 Ton Snap vidéo a été ouvert'
        ELSE '👀 Ton message a été lu'
      END,
      jsonb_build_object(
        'message_id', NEW.message_id,
        'opener_id',  NEW.user_id
      )
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_snap_opened ON public.message_status;
CREATE TRIGGER trigger_notify_snap_opened
  AFTER INSERT OR UPDATE ON public.message_status
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_snap_opened();

-- 6. Trigger : notification de demande d'ami
CREATE OR REPLACE FUNCTION public.notify_friend_request()
RETURNS TRIGGER AS $$
DECLARE
  v_requester RECORD;
BEGIN
  IF NEW.status = 'PENDING' AND (TG_OP = 'INSERT') THEN
    SELECT display_name, username INTO v_requester
    FROM public.users WHERE id = NEW.user_id;

    PERFORM public.create_notification(
      NEW.friend_id,
      'FRIEND_REQUEST',
      COALESCE(v_requester.display_name, v_requester.username, 'Quelqu''un') || ' veut t''ajouter',
      '👋 Nouvelle demande d''ami',
      jsonb_build_object('requester_id', NEW.user_id, 'friendship_id', NEW.id)
    );

  ELSIF NEW.status = 'ACCEPTED' AND OLD.status = 'PENDING' THEN
    SELECT display_name, username INTO v_requester
    FROM public.users WHERE id = NEW.friend_id;

    PERFORM public.create_notification(
      NEW.user_id,
      'FRIEND_ACCEPTED',
      COALESCE(v_requester.display_name, v_requester.username, 'Quelqu''un') || ' a accepté ta demande',
      '🤝 Vous êtes maintenant amis',
      jsonb_build_object('friend_id', NEW.friend_id, 'friendship_id', NEW.id)
    );
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_friend_request ON public.friendships;
CREATE TRIGGER trigger_notify_friend_request
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_friend_request();

-- 7. Trigger : notification de nouvelle story d'un ami
CREATE OR REPLACE FUNCTION public.notify_new_story()
RETURNS TRIGGER AS $$
DECLARE
  v_author    RECORD;
  v_friend    RECORD;
BEGIN
  SELECT display_name, username INTO v_author
  FROM public.users WHERE id = NEW.user_id;

  -- Notifier tous les amis acceptés
  FOR v_friend IN
    SELECT
      CASE WHEN user_id = NEW.user_id THEN friend_id ELSE user_id END AS friend_user_id
    FROM public.friendships
    WHERE status = 'ACCEPTED'
      AND (user_id = NEW.user_id OR friend_id = NEW.user_id)
  LOOP
    PERFORM public.create_notification(
      v_friend.friend_user_id,
      'NEW_STORY',
      COALESCE(v_author.display_name, v_author.username, 'Un ami') || ' a posté une story',
      '✨ Nouvelle story disponible 24h',
      jsonb_build_object('story_id', NEW.id, 'author_id', NEW.user_id)
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_notify_new_story ON public.stories;
CREATE TRIGGER trigger_notify_new_story
  AFTER INSERT ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_new_story();

-- 8. Fonction pour compter les notifications non lues (pour le badge)
CREATE OR REPLACE FUNCTION public.get_unread_notification_count()
RETURNS BIGINT AS $$
  SELECT COUNT(*) FROM public.notifications
  WHERE user_id = auth.uid() AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- 9. Fonction pour marquer toutes les notifications comme lues
CREATE OR REPLACE FUNCTION public.mark_all_notifications_read()
RETURNS void AS $$
  UPDATE public.notifications
  SET is_read = TRUE
  WHERE user_id = auth.uid() AND is_read = FALSE;
$$ LANGUAGE sql SECURITY DEFINER;

-- 10. Activer realtime sur la table notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.push_subscriptions;

COMMENT ON TABLE public.push_subscriptions IS 'Subscriptions Web Push API par utilisateur';
COMMENT ON TABLE public.notifications IS 'Notifications in-app et push pour tous les événements NovaSnap';
