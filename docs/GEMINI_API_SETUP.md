# 🔑 Configuration de la clé API Gemini

## 📋 Vue d'ensemble

Nova AI utilise maintenant l'API Google Gemini Multimodal Live **directement depuis le navigateur**. Cela nécessite une clé API côté client avec des restrictions de sécurité appropriées.

## 🚀 Étape 1 : Obtenir une clé API

### Option A : Google AI Studio (Recommandé pour développement)

1. Va sur [Google AI Studio](https://aistudio.google.com/apikey)
2. Clique sur **"Create API Key"**
3. Sélectionne un projet Google Cloud (ou crée-en un nouveau)
4. Copie la clé générée (format : `AIzaSy...`)

### Option B : Google Cloud Console (Recommandé pour production)

1. Va sur [Google Cloud Console](https://console.cloud.google.com/)
2. Crée un nouveau projet (ou sélectionne un existant)
3. Active l'API **"Generative Language API"** :
   - Menu → APIs & Services → Library
   - Recherche "Generative Language API"
   - Clique sur "Enable"
4. Crée une clé API :
   - Menu → APIs & Services → Credentials
   - Clique sur "Create Credentials" → "API Key"
   - Copie la clé générée

## 🔒 Étape 2 : Sécuriser la clé API

⚠️ **IMPORTANT** : La clé sera exposée côté client. Tu DOIS configurer des restrictions.

### 1. Restrictions d'application (HTTP referrers)

Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials) :

1. Clique sur ta clé API
2. Section **"Application restrictions"** :
   - Sélectionne **"HTTP referrers (web sites)"**
3. Ajoute les referrers autorisés :

```
# Développement local
localhost:*
127.0.0.1:*
http://localhost:*
https://localhost:*

# Production (remplace par ton domaine)
https://ton-domaine.com/*
https://*.ton-domaine.com/*

# Netlify (si applicable)
https://*.netlify.app/*

# Vercel (si applicable)
https://*.vercel.app/*
```

### 2. Restrictions d'API

Dans la même page :

1. Section **"API restrictions"** :
   - Sélectionne **"Restrict key"**
2. Coche uniquement :
   - ✅ **Generative Language API**
3. Sauvegarde

### 3. Quotas et limites

Dans [Google Cloud Console](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas) :

1. Configure les quotas :
   - **Requêtes par jour** : 1000 (ajustable)
   - **Requêtes par minute** : 60 (ajustable)
   - **Requêtes par utilisateur par minute** : 10 (ajustable)

## 📝 Étape 3 : Configurer l'application

### 1. Créer le fichier `.env`

```bash
# Copier le template
cp .env.example .env
```

### 2. Ajouter la clé API

Édite `.env` et ajoute :

```bash
VITE_GEMINI_API_KEY="AIzaSy..."
```

### 3. Vérifier la configuration

```bash
# Vérifier que la variable est définie
cat .env | grep VITE_GEMINI_API_KEY

# Devrait afficher :
# VITE_GEMINI_API_KEY="AIzaSy..."
```

## 🧪 Étape 4 : Tester

### 1. Démarrer le serveur

```bash
npm run dev
```

### 2. Ouvrir l'application

```
http://localhost:3000
```

### 3. Tester Nova AI

1. Clique sur l'orbe Nova
2. Autorise caméra + micro
3. Dis "Bonjour Nova !"
4. Vérifie que Nova répond

### 4. Vérifier les logs

Console navigateur (F12) :

```
✅ Session Gemini connectée
✅ Audio worklet chargé
✅ Frame vidéo envoyée
```

## 🔐 Sécurité avancée (Production)

### Option 1 : Proxy Supabase Edge Function

Pour éviter d'exposer la clé API côté client, crée un proxy :

#### 1. Créer la Edge Function

```typescript
// supabase/functions/gemini-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Vérifier l'authentification
  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: authHeader } } }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Invalid token' }), { 
      status: 401,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Retourner la clé API Gemini (stockée dans les secrets Supabase)
  const geminiApiKey = Deno.env.get('GEMINI_API_KEY')
  
  return new Response(JSON.stringify({ 
    apiKey: geminiApiKey,
    userId: user.id,
    expiresIn: 3600 // 1 heure
  }), {
    headers: { 
      'Content-Type': 'application/json',
      'Cache-Control': 'private, max-age=3600'
    }
  })
})
```

#### 2. Déployer la fonction

```bash
supabase functions deploy gemini-token
```

#### 3. Configurer les secrets

```bash
supabase secrets set GEMINI_API_KEY="AIzaSy..."
```

#### 4. Modifier `GeminiOrb.tsx`

```typescript
// Au lieu de :
const geminiApiKey = import.meta.env.VITE_GEMINI_API_KEY;

// Utiliser :
const { data, error } = await supabase.functions.invoke('gemini-token');
if (error) throw new Error('Impossible de récupérer le token Gemini');
const geminiApiKey = data.apiKey;
```

### Option 2 : Rotation automatique des clés

Crée un script qui génère une nouvelle clé API chaque semaine :

```typescript
// scripts/rotate-api-key.ts
import { GoogleAuth } from 'google-auth-library';

async function rotateApiKey() {
  const auth = new GoogleAuth({
    scopes: ['https://www.googleapis.com/auth/cloud-platform']
  });
  
  const client = await auth.getClient();
  const projectId = await auth.getProjectId();
  
  // Créer une nouvelle clé
  const newKey = await createApiKey(client, projectId);
  
  // Mettre à jour Supabase secrets
  await updateSupabaseSecret('GEMINI_API_KEY', newKey);
  
  // Supprimer l'ancienne clé (après 24h de grâce)
  setTimeout(() => deleteOldApiKey(oldKey), 24 * 60 * 60 * 1000);
}

// Exécuter chaque semaine
setInterval(rotateApiKey, 7 * 24 * 60 * 60 * 1000);
```

## 📊 Monitoring

### 1. Surveiller l'utilisation

Dans [Google Cloud Console](https://console.cloud.google.com/apis/dashboard) :

- Requêtes par jour
- Erreurs (401, 403, 429)
- Latence moyenne

### 2. Alertes

Configure des alertes pour :

- ⚠️ Quota dépassé (> 80%)
- 🚨 Taux d'erreur élevé (> 5%)
- 💰 Coût mensuel (> seuil défini)

### 3. Logs

Dans `GeminiOrb.tsx`, ajoute du logging :

```typescript
// Log chaque connexion
console.log('[Nova AI] Connexion initiée', {
  userId: user?.id,
  timestamp: new Date().toISOString()
});

// Log les erreurs
console.error('[Nova AI] Erreur', {
  error: err.message,
  userId: user?.id,
  timestamp: new Date().toISOString()
});
```

## 💰 Coûts estimés

### Tarification Gemini API (Mai 2024)

| Modèle | Input | Output |
|--------|-------|--------|
| gemini-2.0-flash-exp | Gratuit (beta) | Gratuit (beta) |
| gemini-2.0-flash-live | $0.30 / 1M tokens | $1.20 / 1M tokens |

### Estimation pour NovaSnap

Hypothèses :
- 1000 utilisateurs actifs/jour
- 5 minutes de conversation/utilisateur/jour
- ~1000 tokens/minute (audio + vidéo)

**Coût mensuel estimé** : $150-300

### Optimisations

1. **Réduire la fréquence vidéo** :
   ```typescript
   // De 4s à 8s
   setInterval(sendVideoFrame, 8000);
   ```

2. **Compresser les images** :
   ```typescript
   // De 0.6 à 0.4
   canvas.toDataURL('image/jpeg', 0.4);
   ```

3. **Limiter la durée des sessions** :
   ```typescript
   // Déconnexion automatique après 10 minutes
   setTimeout(stopVoice, 10 * 60 * 1000);
   ```

## 🐛 Dépannage

### Erreur : "API key not valid"

**Cause** : Clé invalide ou restrictions trop strictes

**Solution** :
1. Vérifie que la clé est active sur [AI Studio](https://aistudio.google.com/apikey)
2. Vérifie les restrictions dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### Erreur : "Quota exceeded"

**Cause** : Limite de requêtes atteinte

**Solution** :
1. Augmente les quotas dans [Google Cloud Console](https://console.cloud.google.com/apis/api/generativelanguage.googleapis.com/quotas)
2. Implémente un rate limiting côté client

### Erreur : "CORS error"

**Cause** : Domaine non autorisé

**Solution** :
Ajoute ton domaine aux referrers autorisés dans Google Cloud Console.

## 📚 Ressources

- [Gemini API Pricing](https://ai.google.dev/pricing)
- [Google Cloud API Keys](https://cloud.google.com/docs/authentication/api-keys)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
- [API Key Best Practices](https://cloud.google.com/docs/authentication/api-keys-best-practices)
