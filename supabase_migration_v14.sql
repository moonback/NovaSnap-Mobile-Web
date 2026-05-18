-- ========== MIGRATION V14: MEMORIES (Galerie personnelle) ==========
-- Crée la table memories, le bucket de stockage et les politiques RLS

-- 1. Table memories
CREATE TABLE IF NOT EXISTS public.memories (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  media_url   TEXT NOT NULL,
  media_type  TEXT NOT NULL CHECK (media_type IN ('IMAGE', 'VIDEO')),
  caption     TEXT,
  source      TEXT NOT NULL DEFAULT 'camera' CHECK (source IN ('camera', 'story', 'chat')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Index pour les requêtes par utilisateur
CREATE INDEX IF NOT EXISTS memories_user_id_idx ON public.memories(user_id);
CREATE INDEX IF NOT EXISTS memories_created_at_idx ON public.memories(created_at DESC);

-- 3. RLS
ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;

-- Lecture : uniquement ses propres souvenirs
CREATE POLICY "memories_select_own"
  ON public.memories FOR SELECT
  USING (auth.uid() = user_id);

-- Insertion : uniquement pour soi-même
CREATE POLICY "memories_insert_own"
  ON public.memories FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Suppression : uniquement ses propres souvenirs
CREATE POLICY "memories_delete_own"
  ON public.memories FOR DELETE
  USING (auth.uid() = user_id);

-- Mise à jour (caption) : uniquement ses propres souvenirs
CREATE POLICY "memories_update_own"
  ON public.memories FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 4. Bucket de stockage "memories" (privé, signed URLs)
-- À exécuter dans le Dashboard Supabase > Storage > New Bucket
-- Nom : memories | Public : false | File size limit : 50MB
-- Ou via SQL (si l'extension storage est disponible) :
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'memories',
  'memories',
  false,
  52428800,  -- 50 MB
  ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'video/webm', 'video/mp4']
)
ON CONFLICT (id) DO NOTHING;

-- 5. Politiques de stockage pour le bucket "memories"
CREATE POLICY "memories_storage_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "memories_storage_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

CREATE POLICY "memories_storage_delete"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'memories' AND auth.uid()::text = (storage.foldername(name))[1]);

COMMENT ON TABLE public.memories IS 'Galerie personnelle de chaque utilisateur — snaps sauvegardés sans expiration';
