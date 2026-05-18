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
  -- Remplacement des variables de configuration par les valeurs en dur 
  -- pour contourner les erreurs de permissions (ERROR 42501) sur Supabase Cloud
  v_edge_url := 'https://ivaevasbinqcswgwdipa.supabase.co/functions/v1';
  v_anon_key := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Iml2YWV2YXNiaW5xY3N3Z3dkaXBhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkwMTQxMDAsImV4cCI6MjA5NDU5MDEwMH0.LBXUMrDZra2zOnthuZOVRfd68D0fYRw9AQNwSzmJd2A';

  -- Prevent crash if edge function URL is not set
  IF v_edge_url IS NULL OR v_edge_url = '' THEN
    RETURN NEW;
  END IF;

  v_edge_url := v_edge_url || '/send-push-notification';

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
