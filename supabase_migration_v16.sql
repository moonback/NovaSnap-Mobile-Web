-- ========== MIGRATION V16: GROUP MEMBER ROLES & MEMBER LIMIT ==========
-- Ajoute la colonne role à la table conversation_members pour gérer les admins
ALTER TABLE public.conversation_members
  ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'MEMBER' CHECK (role IN ('ADMIN', 'MEMBER'));

COMMENT ON COLUMN public.conversation_members.role IS 'Rôle du membre dans la conversation (ADMIN ou MEMBER)';

-- Par défaut, le premier membre inséré (souvent le créateur) ou les membres actuels
-- peuvent être mis à jour si nécessaire.
