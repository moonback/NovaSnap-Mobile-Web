-- SCHEMA POUR NOVASNAP

-- Activer les extensions nécessaires
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "postgis"; -- (Optionnel, si besoin de géolocalisation pour la carte Snapchat)

-- 1. Table Users
CREATE TABLE public.users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT UNIQUE NOT NULL CHECK (char_length(username) >= 3),
  display_name TEXT,
  avatar_url TEXT,
  bio TEXT,
  snap_score BIGINT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Friendships
CREATE TABLE public.friendships (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('PENDING', 'ACCEPTED', 'BLOCKED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- 3. Conversations (Chats)
CREATE TABLE public.conversations (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  is_group BOOLEAN DEFAULT FALSE,
  title TEXT, -- Null pour les conversations 1v1
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Conversation Members
CREATE TABLE public.conversation_members (
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (conversation_id, user_id)
);

-- 5. Messages (Texts, Snaps Vidéo/Photo)
CREATE TABLE public.messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  sender_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  message_type TEXT CHECK (message_type IN ('TEXT', 'IMAGE', 'VIDEO', 'AUDIO')),
  content TEXT, -- Le texte ou l'URL du media
  media_url TEXT,
  is_ephemeral BOOLEAN DEFAULT TRUE,
  expires_in_seconds INT DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Message Status (Vu, Replay)
CREATE TABLE public.message_status (
  message_id UUID REFERENCES public.messages(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('DELIVERED', 'OPENED', 'REPLAYED', 'SCREENSHOTTED')),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (message_id, user_id)
);

-- 7. Stories
CREATE TABLE public.stories (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  media_type TEXT CHECK (media_type IN ('IMAGE', 'VIDEO')),
  duration_seconds INT DEFAULT 10,
  expires_at TIMESTAMPTZ DEFAULT NOW() + INTERVAL '24 hours',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Story Views
CREATE TABLE public.story_views (
  story_id UUID REFERENCES public.stories(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  viewed_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (story_id, viewer_id)
);

-- 9. Notification Tokens
CREATE TABLE public.notification_tokens (
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT CHECK (platform IN ('IOS', 'ANDROID', 'WEB')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (user_id, token)
);

-- ========== RLS POLICIES ==========
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.friendships ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.conversation_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.stories ENABLE ROW LEVEL SECURITY;

-- Exemples de Policies Basic:
-- Users peuvent lire les profils des autres
CREATE POLICY "Public profiles are viewable by everyone." 
ON public.users FOR SELECT USING (true);

-- Users peuvent modifier leur propre profil
CREATE POLICY "Users can insert their own profile." 
ON public.users FOR INSERT WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile." 
ON public.users FOR UPDATE USING (auth.uid() = id);

-- Messages RLS
-- Un utilisateur peut lire les messages si il fait parti de la conversation
CREATE POLICY "Users can read conversation messages" 
ON public.messages FOR SELECT
USING (
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- Create message if part of conversation
CREATE POLICY "Users can send messages" 
ON public.messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  conversation_id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

-- Friendships RLS
CREATE POLICY "Users can view their own friendships" 
ON public.friendships FOR SELECT 
USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can initiate friendships" 
ON public.friendships FOR INSERT 
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update their own friendships" 
ON public.friendships FOR UPDATE 
USING (user_id = auth.uid() OR friend_id = auth.uid());

CREATE POLICY "Users can delete their own friendships" 
ON public.friendships FOR DELETE 
USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Conversations RLS
CREATE POLICY "Users can view their conversations" 
ON public.conversations FOR SELECT 
USING (
  id IN (
    SELECT conversation_id FROM public.conversation_members WHERE user_id = auth.uid()
  )
);

CREATE POLICY "Authenticated users can create conversations" 
ON public.conversations FOR INSERT 
WITH CHECK (auth.uid() IS NOT NULL);

-- Conversation Members RLS
CREATE POLICY "Users can view members of their conversations" 
ON public.conversation_members FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can join conversations" 
ON public.conversation_members FOR INSERT 
WITH CHECK (user_id = auth.uid());

-- Stories RLS
CREATE POLICY "Stories are viewable by authenticated users" 
ON public.stories FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Users can insert their own stories" 
ON public.stories FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own stories" 
ON public.stories FOR DELETE 
USING (auth.uid() = user_id);


-- ========== REALTIME PUBLICATION ==========
DROP PUBLICATION IF EXISTS supabase_realtime;
CREATE PUBLICATION supabase_realtime FOR TABLE public.messages, public.message_status, public.conversations, public.conversation_members;

-- ========== STORAGE POLICIES ==========
-- Assurez-vous de créer manuellement les buckets 'avatars', 'chats', 'stories', 'temporary_snaps' dans le dashboard Supabase.

-- ========== TRIGGER AUTO PROFILE ON SIGNUP ==========
-- Ce déclencheur crée automatiquement un profil dans public.users lors de l'inscription dans auth.users
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, username, display_name, avatar_url, snap_score)
  VALUES (
    new.id,
    COALESCE(new.raw_user_meta_data->>'username', 'user_' || substr(new.id::text, 1, 8)),
    COALESCE(new.raw_user_meta_data->>'display_name', new.raw_user_meta_data->>'username', 'User ' || substr(new.id::text, 1, 8)),
    new.raw_user_meta_data->>'avatar_url',
    0
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


-- 1. Drop the recursive policy if it exists
DROP POLICY IF EXISTS "Users can view members of their conversations" ON public.conversation_members;

-- 2. Create the new clean, flat, high-performance policy
CREATE POLICY "Users can view members of their conversations" 
ON public.conversation_members FOR SELECT 
USING (auth.uid() IS NOT NULL);


-- ========== BUCKETS DE STOCKAGE & POLITIQUES ==========
-- ✅ Buckets PRIVES — les médias ne sont pas accessibles sans URL signée.
-- Côté client, utiliser: supabase.storage.from('bucket').createSignedUrl(path, 3600)
INSERT INTO storage.buckets (id, name, public)
VALUES 
  ('avatars',         'avatars',         false),
  ('chats',           'chats',           false),
  ('stories',         'stories',         false),
  ('temporary_snaps', 'temporary_snaps', false)
ON CONFLICT (id) DO UPDATE SET public = EXCLUDED.public;

-- Politiques : lecture et écriture uniquement pour utilisateurs authentifiés
CREATE POLICY "Auth read avatars"   ON storage.objects FOR SELECT USING (bucket_id = 'avatars'         AND auth.role() = 'authenticated');
CREATE POLICY "Auth insert avatars" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'avatars'    AND auth.role() = 'authenticated');

CREATE POLICY "Auth read chats"     ON storage.objects FOR SELECT USING (bucket_id = 'chats'           AND auth.role() = 'authenticated');
CREATE POLICY "Auth insert chats"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'chats'      AND auth.role() = 'authenticated');

CREATE POLICY "Auth read stories"   ON storage.objects FOR SELECT USING (bucket_id = 'stories'         AND auth.role() = 'authenticated');
CREATE POLICY "Auth insert stories" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'stories'    AND auth.role() = 'authenticated');

CREATE POLICY "Auth read snaps"     ON storage.objects FOR SELECT USING (bucket_id = 'temporary_snaps' AND auth.role() = 'authenticated');
CREATE POLICY "Auth insert snaps"   ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'temporary_snaps' AND auth.role() = 'authenticated');


-- ========== INDEXES DE PERFORMANCE (FIX #12) ==========
CREATE INDEX IF NOT EXISTS idx_messages_conversation_created
  ON public.messages(conversation_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_stories_expires
  ON public.stories(expires_at);

CREATE INDEX IF NOT EXISTS idx_stories_user_created
  ON public.stories(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_friendships_user
  ON public.friendships(user_id);

CREATE INDEX IF NOT EXISTS idx_friendships_friend
  ON public.friendships(friend_id);

CREATE INDEX IF NOT EXISTS idx_message_status_user
  ON public.message_status(user_id, updated_at DESC);

CREATE INDEX IF NOT EXISTS idx_conversation_members_user
  ON public.conversation_members(user_id);

CREATE INDEX IF NOT EXISTS idx_conversation_members_conversation
  ON public.conversation_members(conversation_id);


-- ========== UNICITÉ DES CONVERSATIONS 1v1 (FIX #13) ==========
-- Ajoute un hash canonique pour empêcher les doublons entre 2 utilisateurs.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS unique_hash TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_unique_hash
  ON public.conversations(unique_hash)
  WHERE unique_hash IS NOT NULL;