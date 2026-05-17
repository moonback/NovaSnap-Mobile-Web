# 🎙️ Nova AI - Refonte Architecture (Sans Serveur WebSocket)

## 📋 Vue d'ensemble

Nova AI a été complètement refondu pour utiliser **directement l'API Google Gemini Multimodal Live** depuis le navigateur, **sans serveur WebSocket intermédiaire**.

### ✅ Avantages de la nouvelle architecture

1. **Simplicité** : Plus besoin de gérer un serveur WebSocket Node.js
2. **Scalabilité** : Connexions directes client → Google (pas de goulot d'étranglement serveur)
3. **Latence réduite** : Moins de sauts réseau (client → serveur → Google devient client → Google)
4. **Coûts réduits** : Pas de serveur à maintenir en production
5. **Déploiement simplifié** : Application 100% statique (peut être hébergée sur Netlify, Vercel, etc.)

### ⚠️ Considérations de sécurité

**Important** : La clé API Gemini est maintenant exposée côté client. Pour sécuriser :

1. **Restrictions d'API dans Google Cloud Console** :
   - Limiter par domaine (ex: `novasnap.app`, `*.netlify.app`)
   - Limiter par quota (ex: 1000 requêtes/jour/utilisateur)
   - Activer uniquement l'API Gemini (désactiver les autres services Google)

2. **Alternative sécurisée** (recommandée pour production) :
   - Créer un endpoint Supabase Edge Function qui génère des tokens temporaires
   - Le client demande un token au backend (authentifié via Supabase Auth)
   - Le token a une durée de vie limitée (ex: 1 heure)

## 🏗️ Architecture

```
┌─────────────┐
│   Browser   │
│  (React)    │
└──────┬──────┘
       │
       │ @google/genai SDK
       │ (WebSocket direct)
       │
       ▼
┌─────────────────────┐
│  Google Gemini API  │
│  Multimodal Live    │
│  (gemini-2.0-flash) │
└─────────────────────┘
```

### Ancienne architecture (DEPRECATED)

```
Browser → WebSocket Server (Node.js) → Google Gemini API
```

## 🚀 Configuration

### 1. Obtenir une clé API Gemini

1. Va sur [Google AI Studio](https://aistudio.google.com/apikey)
2. Crée une nouvelle clé API
3. Configure les restrictions dans [Google Cloud Console](https://console.cloud.google.com/apis/credentials)

### 2. Configurer les variables d'environnement

Copie `.env.example` vers `.env` et remplis :

```bash
# Clé API Gemini (côté client)
VITE_GEMINI_API_KEY="AIza..."

# Supabase (pour l'authentification)
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="eyJ..."
```

### 3. Installer les dépendances

```bash
npm install
```

### 4. Lancer en développement

```bash
npm run dev
```

## 📦 Dépendances

- `@google/genai` : SDK officiel Google pour Gemini (inclut support Multimodal Live)
- `@supabase/supabase-js` : Authentification utilisateur
- `react` : Framework UI

## 🎯 Fonctionnalités

### ✅ Implémenté

- ✅ Conversation vocale bidirectionnelle en temps réel
- ✅ Envoi de frames vidéo (caméra) toutes les 4 secondes
- ✅ Transcription en temps réel
- ✅ Voix Zephyr (Google)
- ✅ Instructions système personnalisées (contexte utilisateur)
- ✅ Gestion des interruptions
- ✅ Fallback ScriptProcessor pour navigateurs anciens

### 🔄 À améliorer

- [ ] Endpoint sécurisé pour génération de tokens temporaires
- [ ] Gestion des erreurs réseau (reconnexion automatique)
- [ ] Indicateur de qualité de connexion
- [ ] Historique des conversations
- [ ] Support multi-langues (détection automatique)

## 🔧 Fichiers modifiés

### Principaux changements

1. **`src/components/GeminiOrb.tsx`** : Refonte complète
   - Suppression de la logique WebSocket
   - Ajout de la connexion directe via `@google/genai`
   - Gestion améliorée des erreurs

2. **`.env.example`** : Nouvelle variable
   - `VITE_GEMINI_API_KEY` (remplace `GEMINI_API_KEY`)

3. **`server.ts`** : DEPRECATED (peut être supprimé)
   - La logique WebSocket `/live` n'est plus utilisée
   - Le serveur peut être simplifié (uniquement pour servir les fichiers statiques)

## 🧪 Tests

### Test manuel

1. Ouvre l'application
2. Clique sur l'orbe Nova (bouton micro)
3. Autorise l'accès caméra + micro
4. Parle : "Bonjour Nova, que vois-tu ?"
5. Vérifie que Nova répond avec audio + transcription

### Vérification des logs

Ouvre la console développeur (F12) :

```
✅ Session Gemini connectée
✅ Audio worklet chargé
✅ Frame vidéo envoyée
```

## 📚 Documentation API

- [Gemini Multimodal Live API](https://ai.google.dev/gemini-api/docs/live-api)
- [SDK @google/genai](https://www.npmjs.com/package/@google/genai)
- [Supabase Auth](https://supabase.com/docs/guides/auth)

## 🐛 Dépannage

### Erreur : "Clé API Gemini manquante"

→ Vérifie que `VITE_GEMINI_API_KEY` est défini dans `.env`

### Erreur : "Failed to connect to Gemini"

→ Vérifie que la clé API est valide et que l'API Gemini est activée dans Google Cloud Console

### Pas d'audio en retour

→ Vérifie que le fichier `/public/pcm-capture-processor.js` existe et est accessible

### Vidéo ne s'affiche pas

→ Vérifie les permissions caméra dans le navigateur (icône cadenas dans la barre d'adresse)

## 🎨 Personnalisation

### Changer la voix

Dans `GeminiOrb.tsx`, modifie :

```typescript
speechConfig: {
  voiceConfig: { 
    prebuiltVoiceConfig: { 
      voiceName: 'Puck' // Options: Puck, Charon, Kore, Fenrir, Aoede, Zephyr
    } 
  },
}
```

### Changer la fréquence d'envoi vidéo

```typescript
// Actuellement : toutes les 4 secondes
videoIntervalRef.current = setInterval(sendVideoFrame, 4000);

// Pour 2 secondes :
videoIntervalRef.current = setInterval(sendVideoFrame, 2000);
```

### Modifier les instructions système

```typescript
systemInstruction: `Tu es Nova, une assistante IA...`
```

## 📄 Licence

MIT
