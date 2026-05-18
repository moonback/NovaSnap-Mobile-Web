-- ========== MIGRATION V13: TRIGGER DB → EDGE FUNCTION (pg_net) ==========
-- Connecte les triggers de notifications à l'Edge Function send-push-notification
-- Prérequis : extension pg_net activée dans Supabase (Dashboard > Extensions)

-- 1. Activer pg_net (si pas déjà fait)
CREATE EXTENSION IF NOT EXISTS pg_net;

-- 2. Fonction qui appelle l'Edge Function via HTTP (pg_net)
CREATE OR REPLACE FUNCTION public.trigger_push_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_edge_url  TEXT;
  v_anon_key  TEXT;
BEGIN
  -- Ces valeurs sont injectées via les secrets Supabase (Vault)
  -- ou configurées directement ici pour les projets auto-hébergés
  v_edge_url := current_setting('app.edge_function_url', true);
  
  -- Prevent crash if edge function URL is not set
  IF v_edge_url IS NULL OR v_edge_url = '' THEN
    RETURN NEW;
  END IF;

  v_edge_url := v_edge_url || '/send-push-notification';
  v_anon_key := current_setting('app.supabase_anon_key', true);

  -- Appel HTTP asynchrone vers l'Edge Function
  PERFORM net.http_post(
    url     := v_edge_url,
    headers := jsonb_build_object(
      'Content-Type',  'application/json',
      'Authorization', 'Bearer ' || v_anon_key
    ),
    body    := jsonb_build_object(
      'user_id', NEW.user_id,
      'title',   NEW.title,
      'body',    NEW.body,
      'type',    NEW.type,
      'data',    NEW.data
    )
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Trigger sur la table notifications → appelle l'Edge Function
DROP TRIGGER IF EXISTS trigger_send_push ON public.notifications;
CREATE TRIGGER trigger_send_push
  AFTER INSERT ON public.notifications
  FOR EACH ROW
  EXECUTE FUNCTION public.trigger_push_notification();

-- 4. Configurer les paramètres de l'app (à adapter avec tes vraies valeurs)
-- Exécute ces commandes dans le SQL Editor de Supabase avec tes valeurs réelles :
--
-- ALTER DATABASE postgres SET app.edge_function_url = 'https://YOUR_PROJECT_ID.supabase.co/functions/v1';
-- ALTER DATABASE postgres SET app.supabase_anon_key = 'YOUR_ANON_KEY';
--
-- OU utilise les secrets Supabase Vault (recommandé pour la production) :
-- SELECT vault.create_secret('edge_function_url', 'https://YOUR_PROJECT_ID.supabase.co/functions/v1');
-- SELECT vault.create_secret('supabase_anon_key', 'YOUR_ANON_KEY');

COMMENT ON FUNCTION public.trigger_push_notification() IS
  'Appelle l''Edge Function send-push-notification via pg_net lors de chaque nouvelle notification';
