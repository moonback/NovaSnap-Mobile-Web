-- Migration: Ajouter les colonnes GPS à la table stories
-- Date: 2026-05-18
-- Description: Permet de stocker la position GPS réelle où chaque story a été créée

-- 1. Ajouter les colonnes latitude et longitude
ALTER TABLE stories 
ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION,
ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Créer un index pour les requêtes géospatiales
-- Cet index améliore les performances pour les requêtes de proximité
CREATE INDEX IF NOT EXISTS idx_stories_location 
ON stories(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 3. Ajouter des commentaires pour la documentation
COMMENT ON COLUMN stories.latitude IS 'Latitude GPS (WGS84) où la story a été créée';
COMMENT ON COLUMN stories.longitude IS 'Longitude GPS (WGS84) où la story a été créée';

-- 4. Optionnel: Créer une vue pour les stories géolocalisées
CREATE OR REPLACE VIEW stories_with_location AS
SELECT 
  s.*,
  u.username,
  u.avatar_url,
  u.display_name
FROM stories s
JOIN users u ON s.user_id = u.id
WHERE s.latitude IS NOT NULL 
  AND s.longitude IS NOT NULL
  AND s.expires_at > NOW();

COMMENT ON VIEW stories_with_location IS 'Stories actives avec position GPS valide';

-- 5. Fonction helper pour calculer la distance entre deux points GPS
CREATE OR REPLACE FUNCTION calculate_distance_km(
  lat1 DOUBLE PRECISION,
  lon1 DOUBLE PRECISION,
  lat2 DOUBLE PRECISION,
  lon2 DOUBLE PRECISION
)
RETURNS DOUBLE PRECISION AS $$
DECLARE
  earth_radius_km CONSTANT DOUBLE PRECISION := 6371.0;
  dlat DOUBLE PRECISION;
  dlon DOUBLE PRECISION;
  a DOUBLE PRECISION;
  c DOUBLE PRECISION;
BEGIN
  -- Formule de Haversine pour calculer la distance entre deux points GPS
  dlat := RADIANS(lat2 - lat1);
  dlon := RADIANS(lon2 - lon1);
  
  a := SIN(dlat / 2) * SIN(dlat / 2) +
       COS(RADIANS(lat1)) * COS(RADIANS(lat2)) *
       SIN(dlon / 2) * SIN(dlon / 2);
  
  c := 2 * ATAN2(SQRT(a), SQRT(1 - a));
  
  RETURN earth_radius_km * c;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

COMMENT ON FUNCTION calculate_distance_km IS 'Calcule la distance en km entre deux points GPS (formule de Haversine)';

-- 6. Fonction pour récupérer les stories proches d'une position
CREATE OR REPLACE FUNCTION get_nearby_stories(
  p_lat DOUBLE PRECISION,
  p_lng DOUBLE PRECISION,
  p_radius_km DOUBLE PRECISION DEFAULT 10.0,
  p_limit INT DEFAULT 50
)
RETURNS TABLE (
  id UUID,
  user_id UUID,
  username TEXT,
  avatar_url TEXT,
  media_url TEXT,
  media_type TEXT,
  latitude DOUBLE PRECISION,
  longitude DOUBLE PRECISION,
  distance_km DOUBLE PRECISION,
  created_at TIMESTAMPTZ,
  expires_at TIMESTAMPTZ
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.user_id,
    u.username,
    u.avatar_url,
    s.media_url,
    s.media_type,
    s.latitude,
    s.longitude,
    calculate_distance_km(p_lat, p_lng, s.latitude, s.longitude) AS distance_km,
    s.created_at,
    s.expires_at
  FROM stories s
  JOIN users u ON s.user_id = u.id
  WHERE s.latitude IS NOT NULL
    AND s.longitude IS NOT NULL
    AND s.expires_at > NOW()
    AND calculate_distance_km(p_lat, p_lng, s.latitude, s.longitude) <= p_radius_km
  ORDER BY distance_km ASC
  LIMIT p_limit;
END;
$$ LANGUAGE plpgsql STABLE;

COMMENT ON FUNCTION get_nearby_stories IS 'Récupère les stories actives dans un rayon donné (en km) autour d''une position GPS';

-- 7. Politique RLS pour les stories géolocalisées (si RLS activé)
-- Les utilisateurs peuvent voir les stories géolocalisées de leurs amis ou publiques
-- (À adapter selon votre logique de confidentialité)

-- Exemple de politique (à décommenter si nécessaire):
-- CREATE POLICY "Users can view geolocated stories from friends"
-- ON stories FOR SELECT
-- USING (
--   latitude IS NOT NULL 
--   AND longitude IS NOT NULL
--   AND (
--     user_id = auth.uid() -- Ses propres stories
--     OR EXISTS ( -- Stories de ses amis
--       SELECT 1 FROM friendships
--       WHERE (user_id = auth.uid() AND friend_id = stories.user_id)
--          OR (friend_id = auth.uid() AND user_id = stories.user_id)
--       AND status = 'ACCEPTED'
--     )
--   )
-- );

-- 8. Vérification de la migration
DO $$
BEGIN
  -- Vérifier que les colonnes existent
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'stories' 
    AND column_name IN ('latitude', 'longitude')
  ) THEN
    RAISE NOTICE '✅ Migration réussie: colonnes GPS ajoutées à la table stories';
  ELSE
    RAISE EXCEPTION '❌ Échec de la migration: colonnes GPS non créées';
  END IF;
  
  -- Vérifier que l'index existe
  IF EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'stories' 
    AND indexname = 'idx_stories_location'
  ) THEN
    RAISE NOTICE '✅ Index idx_stories_location créé avec succès';
  ELSE
    RAISE WARNING '⚠️ Index idx_stories_location non créé';
  END IF;
END $$;
