-- =======================================================================
-- NOVASNAP — MIGRATION V3 (Résolution Récursivité RLS Messages)
-- ✅ Ce fichier résout le bug RLS où les messages ne s'affichent pas.
-- ✅ Utilise une fonction SECURITY DEFINER pour contourner la récursivité.
-- ✅ Safe à exécuter dans l'éditeur SQL de Supabase.
-- =======================================================================


-- ──────────────────────────────────────────────────────────────────────
-- 1. FONCTION DE VÉRIFICATION SÉCURISÉE (SECURITY DEFINER)
-- ──────────────────────────────────────────────────────────────────────
-- Cette fonction s'exécute avec les privilèges administrateur (bypass RLS)
-- et permet de vérifier instantanément et de façon ultra-performante
-- si un utilisateur fait partie d'une conversation.
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
-- 2. RE-CRÉATION DES POLITIQUES SUR LA TABLE 'messages'
-- ──────────────────────────────────────────────────────────────────────
-- Suppression des anciennes politiques potentiellement récursives
DROP POLICY IF EXISTS "Users can read conversation messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;

-- Politique de LECTURE : Un utilisateur peut lire un message s'il fait partie de la conversation
CREATE POLICY "Users can read conversation messages" 
  ON public.messages FOR SELECT
  USING (public.is_conversation_member(conversation_id, auth.uid()));

-- Politique d'ÉCRITURE : Un utilisateur peut envoyer un message s'il fait partie de la conversation
CREATE POLICY "Users can send messages" 
  ON public.messages FOR INSERT
  WITH CHECK (
    sender_id = auth.uid() AND
    public.is_conversation_member(conversation_id, auth.uid())
  );


-- ──────────────────────────────────────────────────────────────────────
-- 3. RE-CRÉATION DES POLITIQUES SUR LA TABLE 'conversations'
-- ──────────────────────────────────────────────────────────────────────
-- Suppression des anciennes politiques
DROP POLICY IF EXISTS "Users can view their conversations" ON public.conversations;

-- Politique de LECTURE : Un utilisateur peut voir la conversation s'il en est membre
CREATE POLICY "Users can view their conversations" 
  ON public.conversations FOR SELECT
  USING (public.is_conversation_member(id, auth.uid()));


-- ──────────────────────────────────────────────────────────────────────
-- 4. VÉRIFICATION DES POLITIQUES SUR 'conversation_members'
-- ──────────────────────────────────────────────────────────────────────
-- S'assure que tout utilisateur connecté peut voir les membres et ajouter
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;
DROP POLICY IF EXISTS "Users can add members to conversations" ON public.conversation_members;

CREATE POLICY "Users can view members of their conversations"
  ON public.conversation_members FOR SELECT
  USING (auth.role() = 'authenticated');

CREATE POLICY "Users can add members to conversations"
  ON public.conversation_members FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');


-- ──────────────────────────────────────────────────────────────────────
-- ✅ Migration V3 terminée avec succès. 
-- Copiez-collez l'intégralité de ce script dans l'éditeur SQL Supabase et cliquez sur RUN !
