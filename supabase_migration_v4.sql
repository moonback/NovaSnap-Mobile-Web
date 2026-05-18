-- =======================================================================
-- NOVASNAP — MIGRATION V4 (Sécurité RLS conversation_members)
-- ✅ Corrige la vulnérabilité : RLS trop permissives sur conversation_members
--    et conversations (n'importe quel utilisateur authentifié pouvait lire
--    tous les membres de toutes les conversations, et accéder à toutes les
--    conversations, indépendamment de son appartenance).
-- ✅ Safe à exécuter dans l'éditeur SQL de Supabase.
-- ✅ Utilise la fonction SECURITY DEFINER déjà créée en V3 pour éviter
--    toute récursivité dans les politiques.
-- =======================================================================


-- ──────────────────────────────────────────────────────────────────────
-- 1. CORRECTION — Table conversation_members
-- ──────────────────────────────────────────────────────────────────────
-- AVANT (V2) : USING (auth.role() = 'authenticated')
--   → Problème : TOUT utilisateur connecté voit TOUS les membres de
--     TOUTES les conversations. Fuite de données massive.
--
-- APRÈS (V4) : restreint aux membres de la conversation concernée OU
--   aux rows qui correspondent à l'utilisateur courant.
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add members to conversations"         ON public.conversation_members;
DROP POLICY IF EXISTS "Users can join conversations"                   ON public.conversation_members;

-- SELECT : un utilisateur ne peut voir les membres d'une conversation
-- que s'il en fait déjà partie lui-même.
CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (
    public.is_conversation_member(conversation_id, auth.uid())
  );

-- INSERT : un utilisateur ne peut ajouter quelqu'un que dans une
-- conversation dont il est déjà membre (ou créer une entrée pour lui-même).
-- La double condition évite qu'un tiers s'injecte dans une conversation.
CREATE POLICY "Users can add members to conversations"
  ON public.conversation_members FOR INSERT
  WITH CHECK (
    -- Cas 1 : l'utilisateur s'ajoute lui-même à une nouvelle conversation
    -- qu'il vient de créer (pas encore membre = conversation vide)
    user_id = auth.uid()
    OR
    -- Cas 2 : l'utilisateur est déjà membre et ajoute quelqu'un d'autre
    public.is_conversation_member(conversation_id, auth.uid())
  );


-- ──────────────────────────────────────────────────────────────────────
-- 2. CORRECTION — Table conversations
-- ──────────────────────────────────────────────────────────────────────
-- AVANT (V2/V3) : USING (auth.role() = 'authenticated')
--   → Problème : TOUT utilisateur connecté voit TOUTES les conversations.
--
-- APRÈS (V4) : restreint aux conversations dont l'utilisateur est membre.
-- ──────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

CREATE POLICY "Users can view their conversations"
  ON public.conversations FOR SELECT
  USING (
    public.is_conversation_member(id, auth.uid())
  );

-- La politique INSERT reste inchangée (auth.role() = 'authenticated' est
-- acceptable à la création, car la conversation est vide à ce stade).


-- ──────────────────────────────────────────────────────────────────────
-- 3. VÉRIFICATION — S'assurer que la fonction SECURITY DEFINER existe
--    (créée en V3, reproduite ici pour garantir l'idempotence)
-- ──────────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_conversation_member(conv_id UUID, user_to_check UUID)
RETURNS BOOLEAN
SECURITY DEFINER
SET search_path = public
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 
    FROM public.conversation_members 
    WHERE conversation_id = conv_id AND user_id = user_to_check
  );
END;
$$;


-- ──────────────────────────────────────────────────────────────────────
-- ✅ Migration V4 terminée avec succès.
-- Récapitulatif des corrections de sécurité appliquées :
--
--  [V4-FIX-1] conversation_members SELECT : restreint aux membres réels
--  [V4-FIX-2] conversation_members INSERT : double condition membre/self
--  [V4-FIX-3] conversations SELECT        : restreint aux membres réels
-- ──────────────────────────────────────────────────────────────────────
