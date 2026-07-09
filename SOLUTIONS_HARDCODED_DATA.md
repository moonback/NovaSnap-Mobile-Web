# 🔧 Solutions — Données hardcodées / approximations non réelles

Ce document détaille les solutions pour corriger les problèmes de données hardcodées identifiés dans l'audit.

---

## 1. 🔴 MapScreen.tsx — Positions de stories fictives

### Problème
**Fichier**: `src/screens/MapScreen.tsx`  
**Lignes**: ~410–412, ~380–400

- Les marqueurs de stories sont positionnés artificiellement avec un offset angulaire calculé
- Les zones de heatmap utilisent des offsets fictifs
- La table `stories` n'a pas de colonnes `lat`/`lng`

### Impact
- ❌ Positions de stories ne correspondent pas à la réalité
- ❌ Heatmap d'activité trompeuse
- ❌ Expérience utilisateur dégradée

### Solution

#### Étape 1: Migration de base de données

Ajouter les colonnes GPS à la table `stories`:

```sql
-- Migration: add_gps_to_stories.sql
ALTER TABLE stories 
ADD COLUMN latitude DOUBLE PRECISION,
ADD COLUMN longitude DOUBLE PRECISION;

-- Index pour les requêtes géospatiales
CREATE INDEX idx_stories_location ON stories(latitude, longitude) 
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- Commentaires
COMMENT ON COLUMN stories.latitude IS 'Latitude GPS où la story a été créée';
COMMENT ON COLUMN stories.longitude IS 'Longitude GPS où la story a été créée';
```

#### Étape 2: Mise à jour du schéma TypeScript

```typescript
// src/lib/types.ts
export interface StoryRow {
  id: string;
  user_id: string;
  media_url: string;
  media_type: 'IMAGE' | 'VIDEO';
  duration_seconds: number;
  expires_at: string;
  created_at: string;
  latitude?: number | null;   // ✅ Nouveau
  longitude?: number | null;  // ✅ Nouveau
  users?: {
    username: string | null;
    avatar_url: string | null;
  };
}
```


#### Étape 3: Capture GPS lors de la création de story

```typescript
// src/components/camera/SnapEditor.tsx (ou CameraView.tsx)
const captureGPSLocation = async (): Promise<{ lat: number; lng: number } | null> => {
  if (!navigator.geolocation) return null;
  
  return new Promise((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        console.warn('GPS capture failed:', error);
        resolve(null);
      },
      { 
        enableHighAccuracy: true, 
        timeout: 5000, 
        maximumAge: 30000 
      }
    );
  });
};

// Lors de la création de la story
const handlePublishStory = async () => {
  const gpsLocation = await captureGPSLocation();
  
  const { data, error } = await supabase
    .from('stories')
    .insert({
      user_id: user.id,
      media_url: uploadedPath,
      media_type: 'IMAGE',
      duration_seconds: 10,
      expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      latitude: gpsLocation?.lat ?? null,
      longitude: gpsLocation?.lng ?? null,
    });
    
  if (error) throw error;
  toast('Story publiée avec succès ! 🎉', 'success');
};
```


#### Étape 4: Affichage réel sur la carte

```typescript
// src/screens/MapScreen.tsx
// ❌ AVANT (positions fictives)
storyAuthors.forEach((story, index) => {
  const angle = (index / Math.max(storyAuthors.length, 1)) * 2 * Math.PI;
  const offsetLat = 0.003 * Math.cos(angle);
  const offsetLng = 0.003 * Math.sin(angle);
  const markerCoords: [number, number] = [
    userCoords[0] + offsetLat,
    userCoords[1] + offsetLng,
  ];
  // ...
});

// ✅ APRÈS (positions réelles)
storyAuthors.forEach((story) => {
  // Skip si pas de coordonnées GPS
  if (!story.latitude || !story.longitude) {
    console.log(`Story ${story.id} sans GPS, ignorée sur la carte`);
    return;
  }
  
  const markerCoords: [number, number] = [story.latitude, story.longitude];
  
  const username = story.users?.username || 'User';
  const avatarUrl = story.users?.avatar_url;

  const html = avatarUrl
    ? `<img src="${avatarUrl}" style="width:28px;height:28px;border-radius:50%;border:2px solid #FFC0CB;" />`
    : `<div style="width:28px;height:28px;border-radius:50%;background:linear-gradient(135deg,#eab308,#f97316);display:flex;align-items:center;justify-content:center;font-weight:900;color:black;font-size:11px;border:2px solid #FFC0CB;">${username.substring(0,1).toUpperCase()}</div>`;

  const storyIcon = L.divIcon({
    className: 'landmark-glowing-ring',
    html,
    iconSize: [32, 32],
    iconAnchor: [16, 16],
  });

  const marker = L.marker(markerCoords, { icon: storyIcon }).addTo(map);
  marker.bindTooltip(`📍 Story de ${username}`, {
    permanent: false,
    direction: 'top',
    offset: [0, -16],
  });
  marker.on('click', () => {
    openAuthorStories(story.user_id);
  });
  landmarkMarkersRef.current.push(marker);
});
```


#### Étape 5: Heatmap basée sur données réelles

```typescript
// src/screens/MapScreen.tsx
// Mise à jour de la heatmap pour utiliser les vraies positions
if (showHeatmap) {
  const heatPoints: Array<{ lat: number; lng: number; weight: number }> = [];

  // 1. Positions des amis (données réelles)
  friendLocations.forEach((friend) => {
    const nearby = friendLocations.filter(
      (f) => f.user_id !== friend.user_id && distM([friend.lat, friend.lng], [f.lat, f.lng]) < 500
    ).length;
    heatPoints.push({ lat: friend.lat, lng: friend.lng, weight: 1 + nearby });
  });

  // 2. Positions des stories (données réelles uniquement)
  storyAuthors.forEach((story) => {
    if (story.latitude && story.longitude) {
      heatPoints.push({ 
        lat: story.latitude, 
        lng: story.longitude, 
        weight: 0.8 // Poids pour activité story
      });
    }
  });

  // 3. Position de l'utilisateur (si pas en mode fantôme)
  if (!isGhostMode) {
    heatPoints.push({ 
      lat: userCoords[0], 
      lng: userCoords[1], 
      weight: 1.5 
    });
  }

  // Affichage des zones de chaleur
  heatPoints.forEach(({ lat, lng, weight }) => {
    const size = Math.round(120 + weight * 60);
    const opacity = Math.min(0.35 + weight * 0.15, 0.85);
    const heatmapIcon = L.divIcon({
      className: 'heatmap-core',
      html: `<div class="heatmap-activity-zone" style="opacity:${opacity};width:${size}px;height:${size}px;"></div>`,
      iconSize: [size, size],
      iconAnchor: [size / 2, size / 2],
    });
    const layer = L.marker([lat, lng], { icon: heatmapIcon }).addTo(map);
    heatmapLayerRef.current.push(layer);
  });
}
```

---

## 2. 🔴 MapScreen.tsx — Coordonnées par défaut hardcodées

### Problème
**Fichier**: `src/screens/MapScreen.tsx`  
**Ligne**: ~139

- Coordonnées par défaut : `[48.8566, 2.3522]` (Paris)
- Non documenté pour l'utilisateur
- Pas de feedback clair sur l'échec de géolocalisation

### Solution

```typescript
// src/screens/MapScreen.tsx
const [userCoords, setUserCoords] = useState<[number, number]>([48.8566, 2.3522]);
const [isDefaultLocation, setIsDefaultLocation] = useState(true); // ✅ Nouveau flag

useEffect(() => {
  if (!navigator.geolocation) {
    toast('📍 Géolocalisation non disponible. Position par défaut utilisée.', 'info');
    return;
  }
  
  setCoordsLoading(true);
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      setUserCoords([pos.coords.latitude, pos.coords.longitude]);
      setIsDefaultLocation(false); // ✅ Position réelle obtenue
      setCoordsLoading(false);
      toast('📍 Position GPS activée !', 'success');
    },
    (err) => {
      console.warn('Geolocation denied or unavailable:', err);
      toast('📍 Géolocalisation refusée. Position par défaut (Paris) utilisée.', 'warning');
      setIsDefaultLocation(true); // ✅ Reste en position par défaut
      setCoordsLoading(false);
    },
    { enableHighAccuracy: true, timeout: 5000 }
  );
}, []);

// Badge d'avertissement si position par défaut
{isDefaultLocation && (
  <div className="absolute top-28 left-1/2 -translate-x-1/2 z-40 bg-orange-500/90 backdrop-blur-md text-white text-[10px] font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg animate-pulse">
    <MapPin size={12} />
    Position approximative (Paris)
    <button 
      onClick={handleRetryGeolocation}
      className="ml-1 underline hover:text-yellow-200"
    >
      Réessayer
    </button>
  </div>
)}
```


---

## 3. 🔴 ProfileScreen.tsx — Suppression de compte non fonctionnelle

### Problème
**Fichier**: `src/screens/ProfileScreen.tsx`  
**Ligne**: ~299

- `supabase.auth.admin.deleteUser()` nécessite des droits admin
- Échoue silencieusement côté client
- **CRITIQUE**: Violation RGPD — le compte n'est pas réellement supprimé

### Impact
- ❌ Non-conformité légale (RGPD)
- ❌ Données auth persistent dans Supabase
- ❌ Utilisateur trompé sur la suppression

### Solution

#### Étape 1: Créer une Edge Function Supabase

```typescript
// supabase/functions/delete-account/index.ts
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  try {
    // Client admin avec service role key
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // Vérifier l'authentification
    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabaseAdmin.auth.getUser(token)
    
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[DeleteAccount] Starting deletion for user ${user.id}`)

    // 1. Supprimer les données utilisateur dans l'ordre (contraintes FK)
    
    // Story views
    await supabaseAdmin.from('story_views').delete().eq('viewer_id', user.id)
    
    // Stories
    await supabaseAdmin.from('stories').delete().eq('user_id', user.id)
    
    // Message status
    await supabaseAdmin.from('message_status').delete().eq('user_id', user.id)
    
    // Messages
    await supabaseAdmin.from('messages').delete().eq('sender_id', user.id)
    
    // Conversation members
    await supabaseAdmin.from('conversation_members').delete().eq('user_id', user.id)
    
    // Friendships (les deux côtés)
    await supabaseAdmin.from('friendships').delete().or(`user_id.eq.${user.id},friend_id.eq.${user.id}`)
    
    // Notification tokens
    await supabaseAdmin.from('notification_tokens').delete().eq('user_id', user.id)
    
    // User profile
    await supabaseAdmin.from('users').delete().eq('id', user.id)

    // 2. Supprimer les fichiers storage
    const buckets = ['avatars', 'stories', 'chats', 'temporary_snaps']
    for (const bucket of buckets) {
      const { data: files } = await supabaseAdmin.storage
        .from(bucket)
        .list(user.id)
      
      if (files && files.length > 0) {
        const filePaths = files.map(f => `${user.id}/${f.name}`)
        await supabaseAdmin.storage.from(bucket).remove(filePaths)
      }
    }

    // 3. Supprimer le compte auth (avec droits admin)
    const { error: deleteAuthError } = await supabaseAdmin.auth.admin.deleteUser(user.id)
    
    if (deleteAuthError) {
      console.error('[DeleteAccount] Auth deletion failed:', deleteAuthError)
      return new Response(
        JSON.stringify({ error: 'Failed to delete auth account', details: deleteAuthError.message }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      )
    }

    console.log(`[DeleteAccount] ✅ User ${user.id} fully deleted`)

    return new Response(
      JSON.stringify({ success: true, message: 'Account deleted successfully' }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    )

  } catch (error) {
    console.error('[DeleteAccount] Error:', error)
    return new Response(
      JSON.stringify({ error: 'Internal server error', details: error.message }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    )
  }
})
```


#### Étape 2: Déployer la fonction

```bash
# Installer Supabase CLI si nécessaire
npm install -g supabase

# Se connecter
supabase login

# Déployer la fonction
supabase functions deploy delete-account

# Définir les secrets (si nécessaire)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

#### Étape 3: Mettre à jour le code client

```typescript
// src/screens/ProfileScreen.tsx
const handleDeleteAccount = async () => {
  if (!user) return;
  
  try {
    // Récupérer le token de session
    const { data: { session } } = await supabase.auth.getSession()
    
    if (!session?.access_token) {
      toast('Session expirée. Reconnectez-vous.', 'error')
      return
    }

    // Appeler l'Edge Function
    const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
    const response = await fetch(`${SUPABASE_URL}/functions/v1/delete-account`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${session.access_token}`,
        'Content-Type': 'application/json',
      },
    })
    
    const result = await response.json()
    
    if (!response.ok) {
      throw new Error(result.error || 'Échec de la suppression')
    }
    
    toast('✅ Compte supprimé avec succès.', 'success')
    setShowDeleteConfirm(false)
    setShowSettings(false)
    
    // Déconnexion après 1.5s
    setTimeout(() => {
      supabase.auth.signOut()
      setShowProfile(false)
    }, 1500)
    
  } catch (err) {
    console.error('Error deleting account:', err)
    const message = err instanceof Error ? err.message : 'Erreur inconnue'
    toast(`❌ Erreur : ${message}`, 'error')
  }
}
```

#### Étape 4: Améliorer l'UX de confirmation

```typescript
// src/screens/ProfileScreen.tsx
{showDeleteConfirm && (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    exit={{ opacity: 0 }}
    className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4"
    onClick={() => setShowDeleteConfirm(false)}
  >
    <motion.div
      initial={{ scale: 0.9, y: 20 }}
      animate={{ scale: 1, y: 0 }}
      exit={{ scale: 0.9, y: 20 }}
      onClick={(e) => e.stopPropagation()}
      className={`max-w-sm w-full rounded-3xl p-6 border ${t.surface} ${t.border}`}
    >
      <div className="flex items-center justify-center w-14 h-14 rounded-full bg-red-500/20 mx-auto mb-4">
        <Trash2 size={24} className="text-red-500" />
      </div>
      
      <h3 className="text-xl font-black text-center mb-2">
        Supprimer mon compte ?
      </h3>
      
      <p className={`text-sm text-center mb-6 ${t.textMuted}`}>
        Cette action est <strong className="text-red-500">irréversible</strong>.
        Toutes vos données seront définitivement supprimées :
      </p>
      
      <ul className={`text-xs space-y-2 mb-6 ${t.textMuted}`}>
        <li className="flex items-start gap-2">
          <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span>Profil, photos et stories</span>
        </li>
        <li className="flex items-start gap-2">
          <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span>Messages et conversations</span>
        </li>
        <li className="flex items-start gap-2">
          <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span>Amis et souvenirs</span>
        </li>
        <li className="flex items-start gap-2">
          <X size={14} className="text-red-500 mt-0.5 flex-shrink-0" />
          <span>Compte d'authentification</span>
        </li>
      </ul>
      
      <div className="flex gap-3">
        <button
          onClick={() => setShowDeleteConfirm(false)}
          className={`flex-1 py-3 rounded-xl font-bold text-sm transition-all ${t.surface} ${t.text}`}
        >
          Annuler
        </button>
        <button
          onClick={handleDeleteAccount}
          className="flex-1 py-3 rounded-xl font-bold text-sm bg-red-500 text-white hover:bg-red-600 active:scale-95 transition-all"
        >
          Supprimer définitivement
        </button>
      </div>
    </motion.div>
  </motion.div>
)}
```

---

## 📋 Checklist de déploiement

### Base de données
- [ ] Exécuter la migration `add_gps_to_stories.sql`
- [ ] Vérifier que les index sont créés
- [ ] Tester les requêtes avec les nouvelles colonnes

### Edge Function
- [ ] Créer le fichier `supabase/functions/delete-account/index.ts`
- [ ] Déployer la fonction avec `supabase functions deploy`
- [ ] Tester la fonction avec un compte de test
- [ ] Vérifier les logs dans le dashboard Supabase

### Code client
- [ ] Mettre à jour `src/lib/types.ts` avec les nouveaux champs
- [ ] Implémenter la capture GPS dans `SnapEditor.tsx`
- [ ] Mettre à jour `MapScreen.tsx` pour utiliser les vraies positions
- [ ] Remplacer `handleDeleteAccount` dans `ProfileScreen.tsx`
- [ ] Ajouter le badge de position par défaut
- [ ] Tester la création de story avec GPS
- [ ] Tester l'affichage sur la carte
- [ ] Tester la suppression de compte

### Tests
- [ ] Créer une story avec GPS activé → vérifier position sur carte
- [ ] Créer une story avec GPS désactivé → vérifier qu'elle n'apparaît pas
- [ ] Tester la heatmap avec plusieurs stories géolocalisées
- [ ] Tester la suppression de compte complète
- [ ] Vérifier que les données auth sont bien supprimées

---

## 🎯 Résultat attendu

Après implémentation :

✅ **Stories géolocalisées** : Positions réelles sur la carte  
✅ **Heatmap précise** : Zones d'activité basées sur données réelles  
✅ **Feedback GPS** : Utilisateur informé si position par défaut  
✅ **Suppression RGPD** : Compte auth réellement supprimé  
✅ **Conformité légale** : Respect du droit à l'effacement

