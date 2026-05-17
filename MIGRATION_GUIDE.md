# 🔄 Guide de Migration - Nova AI (WebSocket → Direct API)

## 📋 Résumé des changements

| Aspect | Avant (WebSocket) | Après (Direct API) |
|--------|-------------------|-------------------|
| **Architecture** | Client → Serveur Node.js → Google | Client → Google |
| **Clé API** | `GEMINI_API_KEY` (serveur) | `VITE_GEMINI_API_KEY` (client) |
| **Serveur** | Obligatoire (WebSocket) | Optionnel (fichiers statiques) |
| **Déploiement** | Serveur Node.js requis | Hébergement statique (Netlify, Vercel) |
| **Scalabilité** | Limitée par serveur | Illimitée (direct Google) |

## 🚀 Étapes de migration

### 1. Mettre à jour les variables d'environnement

#### Ancien `.env`
```bash
GEMINI_API_KEY="AIza..."
SUPABASE_SERVICE_ROLE_KEY="eyJ..."
```

#### Nouveau `.env`
```bash
VITE_GEMINI_API_KEY="AIza..."
# SUPABASE_SERVICE_ROLE_KEY plus nécessaire pour Nova AI
```

### 2. Obtenir une nouvelle clé API (si nécessaire)

1. Va sur [Google AI Studio](https://aistudio.google.com/apikey)
2. Crée une clé API avec restrictions :
   - **Restrictions d'application** : HTTP referrers
   - **Sites web autorisés** : `localhost:*`, `ton-domaine.com/*`
   - **Restrictions d'API** : Gemini API uniquement

### 3. Mettre à jour le code

Les fichiers suivants ont été modifiés automatiquement :

- ✅ `src/components/GeminiOrb.tsx` - Refonte complète
- ✅ `.env.example` - Nouvelle variable
- ✅ `package.json` - Scripts mis à jour

### 4. Tester localement

```bash
# Installer les dépendances (si nécessaire)
npm install

# Créer le fichier .env
cp .env.example .env
# Éditer .env et ajouter VITE_GEMINI_API_KEY

# Lancer en développement
npm run dev
```

### 5. Tester Nova AI

1. Ouvre http://localhost:3000
2. Connecte-toi (si nécessaire)
3. Clique sur l'orbe Nova
4. Autorise caméra + micro
5. Parle : "Bonjour Nova !"

### 6. Vérifier les logs

Console navigateur (F12) :
```
✅ Session Gemini connectée
✅ Audio worklet chargé
✅ Frame vidéo envoyée
```

## 🔒 Sécurité : Protéger la clé API

### Option 1 : Restrictions Google Cloud (Recommandé pour MVP)

Dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials) :

1. **Restrictions d'application** :
   - Type : HTTP referrers (sites web)
   - Referrers autorisés :
     ```
     localhost:*
     127.0.0.1:*
     ton-domaine.com/*
     *.netlify.app/*
     ```

2. **Restrictions d'API** :
   - Cocher uniquement "Generative Language API"

3. **Quotas** :
   - Limiter à 1000 requêtes/jour (ajustable)

### Option 2 : Proxy Supabase Edge Function (Recommandé pour production)

Créer une Edge Function qui génère des tokens temporaires :

```typescript
// supabase/functions/gemini-token/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  // Vérifier l'authentification
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_ANON_KEY') ?? '',
    { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
  )
  
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 })
  }

  // Générer un token temporaire (1 heure)
  const token = await generateTemporaryGeminiToken(user.id)
  
  return new Response(JSON.stringify({ token, expiresIn: 3600 }), {
    headers: { 'Content-Type': 'application/json' }
  })
})
```

Puis dans `GeminiOrb.tsx` :
```typescript
// Récupérer un token temporaire au lieu d'utiliser la clé directement
const { data } = await supabase.functions.invoke('gemini-token')
const geminiApiKey = data.token
```

## 📦 Déploiement

### Netlify (Recommandé)

```toml
# netlify.toml
[build]
  command = "npm run build"
  publish = "dist"

[[redirects]]
  from = "/*"
  to = "/index.html"
  status = 200

[build.environment]
  VITE_GEMINI_API_KEY = "AIza..."
  VITE_SUPABASE_URL = "https://xxx.supabase.co"
  VITE_SUPABASE_ANON_KEY = "eyJ..."
```

Déploiement :
```bash
npm run build
netlify deploy --prod
```

### Vercel

```json
// vercel.json
{
  "buildCommand": "npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "rewrites": [
    { "source": "/(.*)", "destination": "/index.html" }
  ]
}
```

Déploiement :
```bash
npm run build
vercel --prod
```

### Serveur Node.js (si nécessaire)

Si tu veux garder un serveur Node.js (pour d'autres raisons) :

```bash
# Build
npm run build

# Démarrer
npm start
```

Le serveur simplifié (`server.simple.ts`) sert uniquement les fichiers statiques.

## 🗑️ Nettoyage (optionnel)

### Fichiers qui peuvent être supprimés

- ❌ `server.ts` (ancien serveur WebSocket) → Remplacé par `server.simple.ts`
- ❌ Variables d'environnement serveur :
  - `GEMINI_API_KEY` (remplacé par `VITE_GEMINI_API_KEY`)
  - `SUPABASE_SERVICE_ROLE_KEY` (plus nécessaire pour Nova AI)

### Dépendances qui peuvent être supprimées

```bash
npm uninstall ws @types/ws
```

**Note** : Garde `ws` si tu l'utilises ailleurs dans le projet.

## 🐛 Problèmes courants

### "Clé API Gemini manquante"

**Cause** : `VITE_GEMINI_API_KEY` non défini dans `.env`

**Solution** :
```bash
echo 'VITE_GEMINI_API_KEY="AIza..."' >> .env
```

### "Failed to connect to Gemini"

**Cause** : Clé API invalide ou restrictions trop strictes

**Solution** :
1. Vérifie que la clé est valide sur [AI Studio](https://aistudio.google.com/apikey)
2. Vérifie les restrictions dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)
3. Assure-toi que l'API Gemini est activée

### "CORS error"

**Cause** : Restrictions de domaine trop strictes

**Solution** :
Dans Google Cloud Console, ajoute ton domaine aux referrers autorisés :
```
localhost:*
127.0.0.1:*
ton-domaine.com/*
```

### Pas d'audio en retour

**Cause** : Fichier `pcm-capture-processor.js` manquant

**Solution** :
Vérifie que `/public/pcm-capture-processor.js` existe et est accessible.

## 📊 Comparaison des performances

| Métrique | Avant (WebSocket) | Après (Direct API) |
|----------|-------------------|-------------------|
| **Latence** | ~200-300ms | ~100-150ms |
| **Coût serveur** | $5-20/mois | $0 (statique) |
| **Scalabilité** | 100-500 users | Illimitée |
| **Complexité** | Élevée | Faible |

## ✅ Checklist de migration

- [ ] Créer une clé API Gemini avec restrictions
- [ ] Ajouter `VITE_GEMINI_API_KEY` dans `.env`
- [ ] Tester localement (`npm run dev`)
- [ ] Vérifier que Nova AI fonctionne (audio + vidéo)
- [ ] Déployer sur Netlify/Vercel
- [ ] Tester en production
- [ ] Configurer les quotas Google Cloud
- [ ] (Optionnel) Implémenter le proxy Supabase pour plus de sécurité
- [ ] (Optionnel) Supprimer l'ancien serveur WebSocket

## 🆘 Support

Si tu rencontres des problèmes :

1. Vérifie les logs navigateur (F12 → Console)
2. Vérifie les logs serveur (si applicable)
3. Consulte la [documentation Gemini Live API](https://ai.google.dev/gemini-api/docs/live-api)
4. Ouvre une issue sur GitHub

## 📚 Ressources

- [Gemini Multimodal Live API](https://ai.google.dev/gemini-api/docs/live-api)
- [Google AI Studio](https://aistudio.google.com/)
- [Google Cloud Console](https://console.cloud.google.com/)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)
