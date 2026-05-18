-- Migration: Corriger les politiques RLS pour story_views
-- Date: 2026-05-18
-- Description: Permet aux utilisateurs authentifiés d'enregistrer et de consulter les vues de stories

-- 1. Activer RLS sur story_views si ce n'est pas déjà fait
ALTER TABLE story_views ENABLE ROW LEVEL SECURITY;

-- 2. Supprimer les anciennes politiques si elles existent
DROP POLICY IF EXISTS "Users can insert their own story views" ON story_views;
DROP POLICY IF EXISTS "Users can view story views" ON story_views;
DROP POLICY IF EXISTS "Story authors can view their story views" ON story_views;

-- 3. Politique INSERT: Les utilisateurs authentifiés peuvent enregistrer leurs propres vues
CREATE POLICY "Users can insert their own story views"
ON story_views
FOR INSERT
TO authenticated
WITH CHECK (
  viewer_id = auth.uid()
);

-- 4. Politique SELECT: Les utilisateurs peuvent voir les vues de leurs propres stories
CREATE POLICY "Story authors can view their story views"
ON story_views
FOR SELECT
TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM stories
    WHERE stories.id = story_views.story_id
    AND stories.user_id = auth.uid()
  )
);

-- 5. Politique SELECT: Les utilisateurs peuvent voir leurs propres vues
CREATE POLICY "Users can view their own views"
ON story_views
FOR SELECT
TO authenticated
USING (
  viewer_id = auth.uid()
);

-- 6. Ajouter des commentaires pour la documentation
COMMENT ON POLICY "Users can insert their own story views" ON story_views IS 
'Permet aux utilisateurs authentifiés d''enregistrer qu''ils ont vu une story';

COMMENT ON POLICY "Story authors can view their story views" ON story_views IS 
'Permet aux auteurs de stories de voir qui a vu leurs stories';

COMMENT ON POLICY "Users can view their own views" ON story_views IS 
'Permet aux utilisateurs de voir quelles stories ils ont vues';

-- 7. Vérification de la migration
DO $$
BEGIN
  -- Vérifier que RLS est activé
  IF EXISTS (
    SELECT 1 FROM pg_tables 
    WHERE tablename = 'story_views' 
    AND rowsecurity = true
  ) THEN
    RAISE NOTICE '✅ RLS activé sur story_views';
  ELSE
    RAISE WARNING '⚠️ RLS non activé sur story_views';
  END IF;
  
  -- Vérifier que les politiques existent
  IF EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'story_views' 
    AND policyname IN (
      'Users can insert their own story views',
      'Story authors can view their story views',
      'Users can view their own views'
    )
  ) THEN
    RAISE NOTICE '✅ Politiques RLS créées avec succès';
  ELSE
    RAISE WARNING '⚠️ Certaines politiques RLS n''ont pas été créées';
  END IF;
END $$;
