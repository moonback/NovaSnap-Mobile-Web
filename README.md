# NovaSnap ✨

Une application sociale mobile-first de nouvelle génération, centrée sur la caméra instantanée, les messages éphémères, les stories, la carte en temps réel et une intelligence artificielle vocale intégrée.

---

## 🚀 Présentation

NovaSnap redéfinit l'interaction sociale avec une interface **Camera-First** immersive. Naviguez fluidement entre la carte, vos conversations, votre caméra et vos stories via une **navigation par swipe** (style TikTok/Snapchat), enrichie par un design Glassmorphism, des animations Framer Motion et des fonctionnalités temps réel via Supabase.

Sur desktop, l'app s'affiche dans un **mockup iPhone** centré (430×932px) avec Dynamic Island factice et fond néon ambiant — une expérience premium même en navigateur.

---

## 🛠️ Stack Technique

### Frontend
- **Framework :** React 19 + Vite 6
- **Langage :** TypeScript 5.8
- **Styling :** Tailwind CSS v4 + Glassmorphism custom
- **Animations :** Framer Motion 12 (swipe physique, transitions spring)
- **State Management :** Zustand 5
- **Data Fetching :** TanStack React Query 5
- **Icônes :** Lucide React

### Backend & Infrastructure
- **BaaS :** Supabase (PostgreSQL, Realtime, Storage, Auth, Edge Functions)
- **WebRTC :** LiveKit (rooms audio/vidéo — intégration en cours)
- **Intelligence Artificielle :** Google Gemini Live API (`@google/genai`)
- **Serveur Express :** `server.ts` (proxy API, build production)
- **PWA :** Service Worker + Web Push (VAPID) + Badge API

---

## ✨ Fonctionnalités Complètes

### 📸 Caméra & Éditeur de Snap
- Capture photo (tap) et vidéo (appui long) avec basculement avant/arrière
- **Mode Boomerang** : enregistrement 2s + lecture aller-retour en boucle infinie
- Flash toggle
- **Filtres & Lenses en temps réel** (MediaPipe FaceLandmarker — 468 points de visage) :
  - **Carrousel de filtres** : bouton ✨ Filtres ouvre une barre horizontale scrollable avec 9 filtres
  - **Filtre Beauté** : halo radial lumineux + particules scintillantes animées sur le contour du visage
  - **Filtres couleur** : Noir & Blanc (grayscale), Vintage (sépia chaud), Néon (saturation extrême) — via CSS filter dynamique
  - **Overlays AR animés** : 🐶 oreilles + truffe de chien, 🕶️ lunettes aviateur avec reflets, 👑 couronne dorée avec gemmes pulsantes, 💕 cœurs flottants en orbite
  - Détection multi-visages (jusqu'à 2), chargement WASM depuis CDN, singleton GPU→CPU fallback
- **SnapEditor** complet avec :
  - Outil **Texte** : polices multiples (Bold, Serif, Mono, Thin), couleurs, taille ajustable
  - Outil **Dessin** : tracé libre, palette de couleurs, épaisseur de pinceau, undo
  - Outil **Stickers** : 30 emojis positionnables librement
  - Outil **Recadrage précis** : sliders Gauche/Droite/Haut/Bas avec aperçu en temps réel
  - **Rotation** : 90°/180°/270° (CW et CCW)
  - **Contrôle de vitesse vidéo** : ×0.5, ×1, ×2
- **Aplatissement canvas (flattening)** : tous les calques (dessin, texte, stickers, recadrage, rotation) sont fusionnés sur l'image originale avant envoi ou sauvegarde
- Téléchargement local du snap édité
- Envoi direct vers une conversation ou publication en Story

### 💬 Chat & Messagerie
- Liste des conversations avec aperçu du dernier message, statut de lecture et horodatage.
- **Messages éphémères fiables** : disparition automatique instantanée dès que le message a été lu par tous les membres et que l'utilisateur quitte le chat.
- **Sauvegarde manuelle** ("Keep in Chat") pour préserver des messages spécifiques.
- **Réactions Emoji Premium** : appui long sur un message pour afficher une barre de réactions rapides (❤️, 😂, 😮, 😢, 🙏, 🔥) et un menu contextuel complet (copie, sauvegarde, suppression).
- **Indicateur de lecture précis ("Seen By")** : affichage transparent de la liste en direct des membres ayant vu chaque message sous le bubble.
- **Mentions `@username` dans les groupes** : suggestions intelligentes avec autocomplétion lors de la saisie de `@`, avec surbrillance dynamique des pseudos (cyan pour les autres membres, jaune pulsé pour soi-même).
- **Gestion de Groupe & Rôles d'Admin** :
  - Création de groupe avec titre, membres et avatar coloré personnalisé.
  - Attribution du rôle `ADMIN` au créateur et `MEMBER` aux autres.
  - Actions d'Admin en direct (promouvoir/rétrograder un membre, exclure du groupe).
  - Verrouillage de la modification de l'identité du groupe pour les non-admins.
  - Limite stricte de **100 membres** par groupe (max 99 amis sélectionnés + le créateur).
- **Envoi optimiste** : le message apparaît instantanément avant confirmation serveur.
- **Typing indicator** temps réel via Supabase Broadcast (indicateur animé 3 points).
- **Picker d'emojis** intégré (32 emojis).
- Envoi de médias (images/vidéos) directement depuis la caméra vers un chat.
- Composant `EphemeralMedia` pour l'affichage des médias éphémères.
- Support thème clair/sombre.

### 🌍 Snap Map
- Carte interactive **Leaflet** chargée dynamiquement (CDN, compatible Vite/React 19)
- **Géolocalisation GPS** en temps réel avec recentrage animé
- **Marqueur utilisateur** pulsant (bleu normal, violet en mode fantôme)
- **Marqueurs amis** avec avatar et tooltip username
- **Heatmap d'activité** : zones pulsantes autour des hotspots
- **Stories géolocalisées** : landmarks (Tour Eiffel, Louvre, Notre-Dame) avec player intégré
- **Player de story géolocalisée** : barre de progression, auto-play 5s, fermeture par tap
- **Mode Fantôme** : masque la position en temps réel, persisté en localStorage
- **Styles de carte** : sombre (CartoDB Dark) / satellite (ArcGIS) — toggle dynamique
- **Affichage amis** : toggle pour masquer/afficher les amis sur la carte
- Drawer coulissant avec liste des amis actifs et landmarks populaires
- Panneau de réglages complet (modal slide-up)
- Recherche de lieux et d'amis

### 📖 Stories
- Flux de stories groupées **par créateur**, triées chronologiquement
- **Player fullscreen** avec barres de progression segmentées (5s par story)
- Navigation par tap gauche/droite entre stories et entre créateurs
- Grille "Découvrir" en format 9:16
- Suppression de ses propres stories avec confirmation modale
- Gestion des stories expirées (filtrées localement)
- Intégration **Gemini AI Orb** (section Nova AI)
- Support thème clair/sombre

### 💾 Memories (Souvenirs)
- Galerie privée persistante des snaps sauvegardés
- **Vues** : grille 3 colonnes ou liste détaillée (toggle)
- **Filtres** : Tous / Photos / Vidéos
- **Recherche** par légende, source ou date
- **Flashback banner** : mise en avant du souvenir le plus ancien
- **Groupement par date** avec compteur par groupe
- **Lightbox** fullscreen avec navigation gauche/droite, swipe vertical pour fermer
- **Légendes éditables** directement dans la lightbox
- **Téléchargement** du média depuis la lightbox
- **Suppression** avec confirmation modale
- **Sélection multiple** (mode sélection) + suppression en masse
- Statistiques : total, photos, vidéos
- Sources taggées : Caméra 📷 / Story 🎬 / Chat 💬
- Skeleton loaders

### 👥 Système d'Amis
- **3 onglets** : Mes amis / Demandes / Ajouter
- Recherche d'utilisateurs par username ou display name
- Envoi / acceptation / refus / annulation de demandes d'amitié
- Suppression d'ami avec confirmation
- **Indicateur de statut en ligne** (`AvatarOnlineBadge`) sur chaque ami
- Snap Score affiché par ami
- Actions rapides par tap : Snap direct, Message, Supprimer
- Badge rouge sur l'onglet "Demandes" avec compteur

### 👤 Profil & Paramètres
- **Design de profil ultra-premium** : apparence repensée avec flous directionnels, contours néons, effets de verre trempé, et dégradés élégants.
- Avatar uploadable (Supabase Storage) avec recadrage et compression automatique.
- Édition du display name et de la bio en direct (limite stricte de 140 caractères).
- Statistiques immersives sous forme de cartes d'impact interactives : Nova Score, Stories actives, Souvenirs sauvegardés, Amis.
- **Panneau Réglages** complet (drawer slide-in) :
  - **Thème** dark/light avec toggle persisté (localStorage)
  - **Sécurité** :
    - **Changement de mot de passe** : formulaire avec validation (mot de passe actuel, nouveau, confirmation)
  - **Mode Fantôme** (synchronisé avec la DB)
  - **Mise à jour manuelle de la localisation**
  - **Confidentialité des Stories** : Public / Amis / Privé
  - **Notifications push** : activer/désactiver
  - **Sauvegarde automatique** des snaps
  - **Qualité média** : Standard / HD
  - **Nettoyage du cache**
  - **Suppression du compte**
- Déconnexion

### 🔔 Notifications Push (PWA)
- Abonnement Web Push via **VAPID** (Service Worker)
- Demande de permission différée (3s après chargement)
- **Badge d'app** mis à jour en temps réel (Badge API)
- Notifications in-app via Supabase Realtime (INSERT sur `notifications`)
- Navigation automatique depuis une notification (clic → vue correspondante)
- Types : `NEW_MESSAGE`, `SNAP_OPENED`, `FRIEND_REQUEST`, `FRIEND_ACCEPTED`, `NEW_STORY`, `SNAP_SCREENSHOT`

### 🟢 Présence & Statut en Ligne
- **Heartbeat** automatique toutes les 30 secondes (`update_user_heartbeat`)
- Heartbeat déclenché aussi au retour de focus (visibilitychange)
- Statut en ligne calculé côté DB (`get_user_online_status`)
- **Batch status** pour les listes d'amis (`get_batch_online_status`)
- Formatage "il y a X minutes/heures/jours"
- `OnlineIndicator` et `AvatarOnlineBadge` réutilisables

### 🎨 UI & Expérience
- **Thème dark/light** global avec persistance localStorage et couleurs HSL harmonieuses.
- **Mode Desktop Innovant** :
  - Mockup iPhone 430×932px ultra-réaliste avec Dynamic Island interactive et fond néon réactif.
  - **Affichage déporté du Profil** : sur grand écran (desktop), l'édition du profil apparaît de manière fluide en dehors du téléphone (sur le panneau latéral droit) avec des transitions floutées et une gestion de l'état partagé en direct.
- Navigation swipeable fluide (drag physique en spring) entre les 4 vues principales de l'application.
- Splash screen animé au démarrage avec fondu dynamique.
- Modal de demande de localisation au premier lancement.
- `ToastProvider` global (success, error, warning, info).
- Composants réutilisables haut de gamme : `Skeleton`, `OnlineIndicator`, `NotificationBell`.
- Création automatique du profil à la première connexion (avec avatar DiceBear).

---

## 📋 Prérequis

- **Node.js** v18+
- **npm**, **yarn** ou **pnpm**
- Un projet [Supabase](https://supabase.com/) (Database, Auth, Storage, Edge Functions)
- Une clé API [Google Gemini](https://aistudio.google.com/)
- Une paire de clés VAPID pour les push notifications (`npx web-push generate-vapid-keys`)
- *(Optionnel)* Un projet [LiveKit](https://livekit.io/) pour les appels audio/vidéo

---

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
```bash
cp .env.example .env
```

**4. Initialiser la base de données**

Exécutez les migrations SQL dans l'éditeur SQL Supabase dans cet ordre :
1. `supabase_migration_v5.sql` → `v8.sql` — Schéma de base, Storage, purge TTL
2. `supabase_migration_v9.sql` → `v12.sql` — Système d'amis, RLS, triggers
3. `supabase_migration_v13.sql` — Profils étendus, présence avancée
4. `supabase/migrations/20240601_gps_location.sql` — Géolocalisation GPS
5. `supabase_migration_v10.sql` — Memories, notifications push

---

## 🔐 Variables d'Environnement

```env
# Supabase
VITE_SUPABASE_URL="https://xxx.supabase.co"
VITE_SUPABASE_ANON_KEY="votre_anon_key"

# Google Gemini AI
GEMINI_API_KEY="votre_cle_gemini"

# Push Notifications (VAPID)
VITE_VAPID_PUBLIC_KEY="votre_cle_vapid_publique"
# La clé privée VAPID va dans les secrets des Edge Functions Supabase

# LiveKit (optionnel)
VITE_LIVEKIT_URL="wss://xxx.livekit.cloud"
VITE_LIVEKIT_API_KEY="votre_livekit_key"
LIVEKIT_API_SECRET="votre_livekit_secret"

# App URL
APP_URL="http://localhost:3000"
```

> Génère une paire VAPID avec : `npx web-push generate-vapid-keys`

---

## 🚀 Lancement

```bash
# Développement
npm run dev

# Build production
npm run build

# Démarrer le serveur de production
npm start

# Vérification TypeScript
npm run lint
```

---

## 📁 Structure du Projet

```
novasnap/
├── public/
│   ├── sw.js                        # Service Worker (Push + Badge + Navigation)
│   ├── pcm-capture-processor.js     # Audio worklet (Gemini Live)
│   ├── manifest.json                # PWA manifest
│   └── *.png                        # Assets stories géolocalisées
├── src/
│   ├── components/
│   │   ├── camera/
│   │   │   ├── CameraView.tsx       # Caméra live + capture + Boomerang
│   │   │   └── SnapEditor.tsx       # Éditeur (texte, dessin, stickers, crop, rotation)
│   │   ├── chat/
│   │   │   └── EphemeralMedia.tsx   # Affichage médias éphémères
│   │   ├── navigation/
│   │   │   └── TabBar.tsx           # Barre de navigation principale
│   │   ├── ui/
│   │   │   ├── NotificationBell.tsx # Cloche avec compteur non-lus
│   │   │   ├── OnlineIndicator.tsx  # Indicateur statut en ligne
│   │   │   ├── Skeleton.tsx         # Composant skeleton loader
│   │   │   └── ToastProvider.tsx    # Système de toasts global
│   │   └── GeminiOrb.tsx            # Orb IA vocale Gemini
│   ├── hooks/
│   │   ├── useConversations.ts      # Liste des conversations
│   │   ├── useFriendLocations.ts    # Positions GPS des amis
│   │   ├── useFriends.ts            # Système d'amis complet
│   │   ├── useMemories.ts           # CRUD Memories
│   │   ├── useOnlineStatus.ts       # Heartbeat + statut en ligne
│   │   ├── usePushNotifications.ts  # Push VAPID + badge + navigation
│   │   ├── useStories.ts            # Fetch stories
│   │   └── useTheme.ts              # Tokens de thème dark/light
│   ├── lib/
│   │   ├── supabase.ts              # Client Supabase + helpers URL signées
│   │   ├── types.ts                 # Types TypeScript partagés
│   │   └── utils.ts                 # Utilitaires
│   ├── screens/
│   │   ├── AuthScreen.tsx           # Authentification (email/password + OAuth)
│   │   ├── ChatScreen.tsx           # Liste des conversations
│   │   ├── ConversationScreen.tsx   # Chat temps réel + éphémère + typing
│   │   ├── FriendsScreen.tsx        # Gestion des amis (3 onglets)
│   │   ├── MapScreen.tsx            # Snap Map Leaflet
│   │   ├── MemoriesScreen.tsx       # Galerie souvenirs
│   │   ├── ProfileScreen.tsx        # Profil + Réglages
│   │   ├── StoriesScreen.tsx        # Flux stories + player
│   │   └── UserProfileScreen.tsx    # Profil public d'un autre utilisateur
│   ├── store/
│   │   └── useAppStore.ts           # Store Zustand global
│   ├── utils/
│   │   └── audio.ts                 # Utilitaires audio (Gemini)
│   ├── App.tsx                      # Racine : routing swipe + providers
│   ├── main.tsx                     # Point d'entrée React
│   └── index.css                    # Tailwind + variables CSS custom
├── supabase/
│   ├── functions/
│   │   └── send-push-notification/  # Edge Function envoi push
│   └── migrations/
│       └── 20240601_gps_location.sql
├── server.ts                        # Serveur Express (proxy Gemini + prod)
├── .env.example
└── package.json
```

---

## 📈 Statut du Projet (Mai 2026)

| Fonctionnalité | Statut |
|---|---|
| Caméra + capture photo/vidéo | ✅ Complet |
| Mode Boomerang | ✅ Complet |
| SnapEditor (texte, dessin, stickers, crop, rotation) | ✅ Complet |
| Aplatissement canvas (flattening) | ✅ Complet |
| Chat temps réel + éphémère fiables | ✅ Complet |
| Typing indicator + Mentions @username | ✅ Complet |
| Réactions emoji + Menu contextuel | ✅ Complet |
| Groupes de chat (Rôles & Limite 100) | ✅ Complet |
| Snap Map Leaflet + GPS | ✅ Complet |
| Mode Fantôme | ✅ Complet |
| Heatmap + stories géolocalisées | ✅ Complet |
| Stories groupées + player segmenté | ✅ Complet |
| Memories (galerie, lightbox, sélection multiple) | ✅ Complet |
| Système d'amis complet | ✅ Complet |
| Statut en ligne + heartbeat | ✅ Complet |
| Notifications push PWA (VAPID) | ✅ Complet |
| Thème dark/light | ✅ Complet |
| Mode Desktop (iPhone + profil déporté) | ✅ Complet |
| Profil premium + Réglages | ✅ Complet |
| Gemini AI Orb (vocal) | 🔄 En cours |
| LiveKit (appels audio/vidéo) | 🔄 En cours |
| Dual Camera (avant + arrière simultané) | 📋 Planifié |
| Musique sur snaps + GIPHY | 📋 Planifié |
| Traduction automatique IA | 📋 Planifié |

---

## 🔒 Sécurité & RLS

- Row Level Security (RLS) activé sur toutes les tables sensibles
- Politiques RLS sur `messages`, `stories`, `memories`, `friendships`, `notifications`
- Uploads Storage limités au dossier `user_id/` de l'utilisateur connecté
- Validation côté client : taille max 8MB (images) / 35MB (vidéos), types MIME stricts
- Clés API jamais exposées côté client (VAPID privée dans les secrets Edge Functions)
- Purge TTL automatique des snaps expirés via `pg_cron` (toutes les 5 minutes)

---

## 🤝 Contribuer

1. **Architecture Feat-First** : isoler les fonctionnalités complexes dans `features/`
2. **Typage strict** : TypeScript partout, pas de `any`
3. **Sécurité** : ne jamais committer de clés API, vérifier les RLS avant tout changement de schéma
4. **Pull Requests atomiques** : une PR = une feature ou un fix

---

## 📄 Licence

Ce projet est sous licence **MIT**. Voir le fichier `LICENSE` pour plus de détails.
