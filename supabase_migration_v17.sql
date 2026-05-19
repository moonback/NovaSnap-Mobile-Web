-- ========== MIGRATION V17: SNAP SCORE PROGRESSION ==========
-- Implémentation de l'incrémentation automatique du "snap_score" 
-- pour que le système de progression Nova fonctionne.

-- 1. Incrémenter le score à l'envoi d'un message (+1 point)
CREATE OR REPLACE FUNCTION public.increment_snap_score_on_message()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.sender_id IS NOT NULL THEN
    UPDATE public.users
    SET snap_score = COALESCE(snap_score, 0) + 1
    WHERE id = NEW.sender_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_snap_score_on_message ON public.messages;
CREATE TRIGGER trg_increment_snap_score_on_message
  AFTER INSERT ON public.messages
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_snap_score_on_message();

-- 2. Incrémenter le score à la création d'une Story (+1 point)
CREATE OR REPLACE FUNCTION public.increment_snap_score_on_story()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.user_id IS NOT NULL THEN
    UPDATE public.users
    SET snap_score = COALESCE(snap_score, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_snap_score_on_story ON public.stories;
CREATE TRIGGER trg_increment_snap_score_on_story
  AFTER INSERT ON public.stories
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_snap_score_on_story();

-- 3. Incrémenter le score à l'ouverture d'un snap (+1 point)
CREATE OR REPLACE FUNCTION public.increment_snap_score_on_snap_opened()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'OPENED' AND (TG_OP = 'INSERT' OR OLD.status != 'OPENED') THEN
    UPDATE public.users
    SET snap_score = COALESCE(snap_score, 0) + 1
    WHERE id = NEW.user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_snap_score_on_snap_opened ON public.message_status;
CREATE TRIGGER trg_increment_snap_score_on_snap_opened
  AFTER INSERT OR UPDATE ON public.message_status
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_snap_score_on_snap_opened();

-- 4. Incrémenter le score quand on devient ami (+5 points chacun)
CREATE OR REPLACE FUNCTION public.increment_snap_score_on_friend_accept()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status = 'ACCEPTED' AND (TG_OP = 'INSERT' OR OLD.status != 'ACCEPTED') THEN
    UPDATE public.users SET snap_score = COALESCE(snap_score, 0) + 5 WHERE id = NEW.user_id;
    UPDATE public.users SET snap_score = COALESCE(snap_score, 0) + 5 WHERE id = NEW.friend_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_increment_snap_score_on_friend_accept ON public.friendships;
CREATE TRIGGER trg_increment_snap_score_on_friend_accept
  AFTER INSERT OR UPDATE ON public.friendships
  FOR EACH ROW
  EXECUTE FUNCTION public.increment_snap_score_on_friend_accept();
