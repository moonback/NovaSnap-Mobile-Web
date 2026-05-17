# NovaSnap ✨

Une application sociale mobile-first de nouvelle génération centrée sur la caméra instantanée, les messages éphémères, les stories et une intelligence artificielle vocale en temps réel.

## 🚀 Présentation

NovaSnap redéfinit l'interaction sociale avec une interface "Camera-First" immersive. Naviguez de manière fluide entre vos conversations, votre caméra et vos stories via une navigation par swipe (type TikTok/Snapchat), enrichie par un design "Glassmorphism" et des fonctionnalités WebSocket/WebRTC premium. 

## 🛠️ Stack Technique

### Frontend
- **Framework :** React 19 + Vite
- **Langage :** TypeScript
- **Styling :** Tailwind CSS v4 + UI Immersive (Glassmorphism)
- **Animations :** Framer Motion (Navigation par swipe ultra fluide)
- **State Management :** Zustand
- **Icônes :** Lucide React

### Backend & Infrastructure
- **BaaS :** Supabase (PostgreSQL, Realtime, Storage, Auth)
- **WebRTC :** LiveKit (Appels audio/vidéo et rooms)
- **Intelligence Artificielle :** Google Gemini Live API (Assistant vocal temps réel)

## ✨ Fonctionnalités Principales (MVP)

- 📸 **Camera-First UI :** Ouverture immédiate sur la caméra (Front/Back) avec contrôles instantanés.
- 💨 **Navigation Swipeable :** Transition physique fluide entre Chat ← Caméra → Stories.
- 💬 **Chat Realtime :** Messagerie en temps réel, statuts de lecture, typing indicators.
- ⏱️ **Snaps Éphémères :** Partage de photos/vidéos avec délai d'expiration sécurisé.
- 📖 **Stories 24h :** Flux de stories continu avec lecteur intégré.
- 🤖 **IA Vocale Intégrée :** Assistant "Voice Orb" boosté par Gemini pour l'analyse visuelle et vocale.

## 📋 Prérequis

- **Node.js** (v18 ou supérieur)
- **npm**, **yarn** ou **pnpm**
- Un projet [Supabase](https://supabase.com/) (Database, Auth, Storage)
- Un projet [LiveKit](https://livekit.io/)
- Une clé API [Google Gemini](https://aistudio.google.com/)

## ⚙️ Installation et Configuration

**1. Cloner le projet**
```bash
git clone https://github.com/votre-username/novasnap.git
cd novasnap
```

**2. Installer les dépendances**
```bash
npm install
```

**3. Configurer les variables d'environnement**
Copiez le fichier d'exemple et remplissez vos identifiants :
```bash
cp .env.example .env
```
Assurez-vous de renseigner les clés pour Supabase, LiveKit et Gemini (voir section *Variables d'environnement* ci-dessous).

**4. Initialiser la base de données**
Exécutez le script SQL fourni dans `supabase_schema.sql` directement dans l'éditeur SQL de votre projet Supabase pour créer la structure (Tables, RLS, Realtime).

## 🚀 Lancement du Projet

**Environnement de développement :**
```bash
npm run dev
```
Le projet sera accessible sur `http://localhost:3000`.

**Build pour la production :**
```bash
npm run build
npm run preview
```

## 📁 Structure du Projet

```text
novasnap/
├── public/                 # Assets statiques
├── src/
│   ├── components/         # Composants réutilisables
│   │   ├── camera/         # Interface caméra spécifique
│   │   └── navigation/     # Barre de navigation globale
│   ├── lib/                # Utilitaires et configurations services (Supabase, Utils)
│   ├── screens/            # Vues principales (Chat, Stories)
│   ├── store/              # Stores Zustand (useAppStore.ts)
│   ├── App.tsx             # Composant racine (Router Framer Motion)
│   ├── index.css           # Tailwind + Variables CSS Immersives
│   ├── main.tsx            # Point d'entrée React
│   └── vite-env.d.ts       # Types Vite
├── .env.example            # Template des variables d'environnement
├── supabase_schema.sql     # Définition de l'architecture base de données
├── package.json            # Dépendances et scripts
└── vite.config.ts          # Configuration Vite
```

## 🔐 Variables d'Environnement

Le fichier `.env` doit contenir :

```env
# API de traitement IA (Server/Client selon config)
GEMINI_API_KEY="votre_cle_gemini"

# Callbacks OAuth / Base URL
APP_URL="http://localhost:3000"

# BaaS - Base de données & Authentification
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="votre_anon_key"

# WebRTC & Rooms vidéo
VITE_LIVEKIT_URL="wss://xxx.livekit.cloud"
VITE_LIVEKIT_API_KEY="votre_livekit_key"
LIVEKIT_API_SECRET="votre_livekit_secret"
```

## 🤝 Bonnes Pratiques pour Contribuer

1. **Architecture Feat-First :** Si une fonctionnalité devient complexe, isolez-la dans un dossier spécifique (`features/Chat`, `features/Camera`).
2. **Typage Strict :** Utilisez toujours TypeScript. Évitez les `any`.
3. **Sécurité :** Ne commitez jamais de clés API. Vérifiez les règles RLS (Row Level Security) avant chaque modification du schéma de DB.
4. **Pull Requests :** Faites des PR atomiques (une PR = une feature ou un fix).

## 📄 Licence

Ce projet est sous licence **MIT**. Vous êtes libre de l'utiliser, le modifier et le distribuer. Voir le fichier `LICENSE` pour plus de détails.
