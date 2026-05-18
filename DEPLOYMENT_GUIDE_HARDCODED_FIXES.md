# 🚀 Guide de déploiement — Corrections données hardcodées

Ce guide explique comment déployer les corrections pour les problèmes de données hardcodées identifiés dans l'audit de sécurité P0.

---

## 📋 Prérequis

- [ ] Accès admin au projet Supabase
- [ ] Supabase CLI installé (`npm install -g supabase`)
- [ ] Accès au dashboard Supabase
- [ ] Variables d'environnement configurées

---

## 🗄️ Étape 1: Migration de base de données

### 1.1 Exécuter la migration SQL

**Option A: Via le dashboard Supabase**

1. Ouvrir le dashboard Supabase : https://app.supabase.com
2. Sélectionner votre projet NovaSnap
3. Aller dans **SQL Editor**
4. Copier le contenu de `scripts/migrations/add_gps_to_stories.sql`
5. Coller dans l'éditeur et cliquer sur **Run**
6. Vérifier les messages de succès dans les logs

**Option B: Via Supabase CLI**

```bash
# Se connecter à Supabase
supabase login

# Lier le projet local
supabase link --project-ref your-project-ref

# Exécuter la migration
supabase db push --file scripts/migrations/add_gps_to_stories.sql
```

### 1.2 Vérifier la migration

```sql
-- Vérifier que les colonnes existent
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'stories' 
AND column_name IN ('latitude', 'longitude');

-- Vérifier l'index
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'stories' 
AND indexname = 'idx_stories_location';

-- Tester la fonction de proximité
SELECT * FROM get_nearby_stories(48.8566, 2.3522, 10.0, 10);
```

---

## ⚡ Étape 2: Déployer l'Edge Function

### 2.1 Créer la fonction

La fonction est déjà créée dans `supabase/functions/delete-account/index.ts`

### 2.2 Déployer sur Supabase

```bash
# Déployer la fonction
supabase functions deploy delete-account

# Vérifier le déploiement
supabase functions list
```

### 2.3 Configurer les secrets (si nécessaire)

```bash
# Définir la service role key (si pas déjà fait)
supabase secrets set SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

### 2.4 Tester la fonction

```bash
# Obtenir un token de test
# (depuis la console du navigateur après connexion)
const { data: { session } } = await supabase.auth.getSession()
console.log(session.access_token)

# Tester l'appel (remplacer YOUR_TOKEN et YOUR_PROJECT_URL)
curl -X POST \
  https://YOUR_PROJECT_URL.supabase.co/functions/v1/delete-account \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json"
```

---

## 💻 Étape 3: Mettre à jour le code client

### 3.1 Mettre à jour les types TypeScript

```bash
# Le fichier src/lib/types.ts doit déjà être à jour
# Vérifier que StoryRow contient latitude et longitude
```

### 3.2 Fichiers à modifier

Les fichiers suivants doivent être mis à jour selon `SOLUTIONS_HARDCODED_DATA.md` :

1. **src/components/camera/SnapEditor.tsx** (ou CameraView.tsx)
   - Ajouter la fonction `captureGPSLocation()`
   - Capturer le GPS lors de la publication de story

2. **src/screens/MapScreen.tsx**
   - Remplacer le calcul d'offset fictif par les vraies coordonnées
   - Mettre à jour la heatmap pour utiliser les données réelles
   - Ajouter le badge de position par défaut
   - Ajouter le bouton "Réessayer" pour la géolocalisation

3. **src/screens/ProfileScreen.tsx**
   - Remplacer `handleDeleteAccount` pour appeler l'Edge Function
   - Améliorer l'UX de confirmation de suppression

### 3.3 Vérifier les imports

```typescript
// Vérifier que ces imports sont présents
import { supabase } from '../lib/supabase';
import { useToast } from '../components/ui/ToastProvider';
import type { StoryRow } from '../lib/types';
```

---

## 🧪 Étape 4: Tests

### 4.1 Test de géolocalisation des stories

1. **Créer une story avec GPS activé**
   ```
   - Ouvrir l'app
   - Autoriser la géolocalisation
   - Prendre une photo
   - Publier en story
   - Vérifier dans la DB que latitude/longitude sont remplis
   ```

2. **Vérifier l'affichage sur la carte**
   ```
   - Aller sur l'écran Map
   - Vérifier que la story apparaît à la bonne position
   - Cliquer sur le marqueur pour ouvrir la story
   ```

3. **Test sans GPS**
   ```
   - Désactiver la géolocalisation dans le navigateur
   - Créer une story
   - Vérifier qu'elle n'apparaît pas sur la carte
   - Vérifier que latitude/longitude sont NULL en DB
   ```

### 4.2 Test de la heatmap

```
- Créer plusieurs stories à différents endroits
- Vérifier que la heatmap se concentre sur les zones réelles
- Comparer avec l'ancien comportement (cercle autour de l'utilisateur)
```

### 4.3 Test de suppression de compte

⚠️ **IMPORTANT**: Utiliser un compte de test !

1. **Créer un compte de test**
   ```
   - S'inscrire avec un email de test
   - Créer quelques données (stories, messages, amis)
   ```

2. **Supprimer le compte**
   ```
   - Aller dans Profil > Paramètres
   - Cliquer sur "Supprimer mon compte"
   - Confirmer la suppression
   - Vérifier le toast de succès
   - Vérifier la déconnexion automatique
   ```

3. **Vérifier la suppression complète**
   ```sql
   -- Dans le SQL Editor Supabase
   -- Remplacer USER_ID par l'ID du compte de test
   
   -- Vérifier que les données sont supprimées
   SELECT * FROM users WHERE id = 'USER_ID'; -- Doit être vide
   SELECT * FROM stories WHERE user_id = 'USER_ID'; -- Doit être vide
   SELECT * FROM messages WHERE sender_id = 'USER_ID'; -- Doit être vide
   
   -- Vérifier que le compte auth est supprimé
   -- Aller dans Authentication > Users
   -- Chercher l'email du compte de test
   -- Ne doit plus exister
   ```

4. **Tester la réinscription**
   ```
   - Essayer de se reconnecter avec l'ancien email
   - Doit échouer (compte n'existe plus)
   - Essayer de se réinscrire avec le même email
   - Doit réussir (nouveau compte créé)
   ```

---

## 🔍 Étape 5: Vérification en production

### 5.1 Checklist de déploiement

- [ ] Migration DB exécutée avec succès
- [ ] Edge Function déployée et testée
- [ ] Code client mis à jour et déployé
- [ ] Tests de géolocalisation passés
- [ ] Test de suppression de compte passé
- [ ] Logs Supabase vérifiés (pas d'erreurs)
- [ ] Performance de la carte vérifiée (pas de ralentissement)

### 5.2 Monitoring post-déploiement

```bash
# Surveiller les logs de l'Edge Function
supabase functions logs delete-account --tail

# Vérifier les erreurs dans le dashboard
# Aller dans Logs > Edge Functions
# Filtrer par "delete-account"
```

### 5.3 Métriques à surveiller

- **Taux de succès de géolocalisation** : % de stories avec GPS
- **Temps de réponse de l'Edge Function** : < 2 secondes
- **Erreurs de suppression de compte** : 0 erreur
- **Performance de la carte** : Temps de chargement < 3 secondes

---

## 🐛 Dépannage

### Problème: Les stories n'ont pas de coordonnées GPS

**Causes possibles:**
- Géolocalisation refusée par l'utilisateur
- Timeout de géolocalisation (> 5 secondes)
- Navigateur ne supporte pas la géolocalisation

**Solution:**
```typescript
// Vérifier les logs dans la console
console.log('GPS capture result:', gpsLocation);

// Augmenter le timeout si nécessaire
{ enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 }
```

### Problème: L'Edge Function échoue

**Causes possibles:**
- Service role key manquante ou invalide
- Token utilisateur expiré
- Contraintes FK non respectées

**Solution:**
```bash
# Vérifier les logs
supabase functions logs delete-account --tail

# Vérifier les secrets
supabase secrets list

# Redéployer la fonction
supabase functions deploy delete-account --no-verify-jwt
```

### Problème: La carte est lente

**Causes possibles:**
- Trop de marqueurs affichés
- Heatmap trop complexe
- Requêtes DB non optimisées

**Solution:**
```typescript
// Limiter le nombre de stories affichées
const MAX_STORIES_ON_MAP = 50;
const limitedStories = storyAuthors.slice(0, MAX_STORIES_ON_MAP);

// Désactiver la heatmap par défaut
const [showHeatmap, setShowHeatmap] = useState(false);
```

---

## 📊 Résultats attendus

Après déploiement complet :

✅ **Stories géolocalisées** : Positions réelles sur la carte  
✅ **Heatmap précise** : Zones d'activité basées sur données réelles  
✅ **Feedback GPS** : Utilisateur informé si position par défaut  
✅ **Suppression RGPD** : Compte auth réellement supprimé  
✅ **Conformité légale** : Respect du droit à l'effacement  
✅ **Performance** : Pas de dégradation de performance  
✅ **UX améliorée** : Feedback clair pour l'utilisateur

---

## 📞 Support

En cas de problème :

1. Vérifier les logs Supabase
2. Consulter `SOLUTIONS_HARDCODED_DATA.md`
3. Vérifier les issues GitHub du projet
4. Contacter l'équipe de développement

---

**Date de création**: 2026-05-18  
**Version**: 1.0.0  
**Auteur**: Kiro AI Assistant
