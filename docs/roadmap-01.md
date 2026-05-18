# 🗺️ Roadmap NovaSnap

Ce document détaille le plan de route du développement de **NovaSnap**, organisé en grandes phases de MVP jusqu'aux fonctionnalités futures.

---

## 🟢 Phase 1 : Fondation Conceptuelle & UI (MVP Initial) - *[En cours/Terminé]*
*Objectif : Mettre en place l'architecture technique de base et l'Interface Utilisateur.*

- [x] Initialisation du projet (Vite, React 19, TypeScript).
- [x] Configuration de Tailwind CSS v4 et composants utilitaires (`cn`, Glassmorphism).
- [x] Architecture de base (`components`, `screens`, `lib`, `store`).
- [x] Base de données : Schéma Supabase complet (`users`, `messages`, `stories`, RLS) écrit.
- [x] Navigation par Swipe (Framer Motion) intégrée.
- [x] Accès natif à l'API Camera (Permissions, switch Front/Back).
- [x] Interface visuelle complète "Immersive UI".

---

## 🟡 Phase 2 : Authentification & Base de données - *[Terminé]*
*Objectif : Rendre l'application dynamique et isoler les environnements utilisateurs.*

- [x] Connecter Supabase Auth (Création de compte, Login).
- [x] Protéger l'application par une barrière d'authentification (Auth Guard).
- [x] Connecter Zustand à l'utilisateur courant (`setUser`).
- [x] Intégrer les requêtes React Query pour charger les amis et conversations.
- [x] Afficher dynamiquement la liste de discussions et de Stories à partir du serveur.

---

## 🟠 Phase 3 : Capture Média & Realtime - *[Terminé]*
*Objectif : Activer l'envoi de contenu éphémère (Core Loop).*

- [x] **Caméra :** Implémenter la capture photo via Canvas et l'enregistrement vidéo (MediaRecorder).
- [x] **Storage :** Simuler l'upload avec Base64 ou DataURL (pour éviter limitation Supabase bucket configuration manuelle pour l'instant).
- [x] **Chat :** Activer Supabase Realtime pour recevoir des textes en temps réel avec liste de conversation (`ConversationScreen`).
- [x] Créer la logique d'expiration de message (Délétion ou masquage visuel après l'ouverture et fin du timer).
- [x] **Stories :** Permettre de poster une Story (24h de visibilité) + Fetch actif depuis la Base.

---

## 🔵 Phase 4 : Voix IA & Appels WebRTC - *[Terminé]*
*Objectif : Intégrer les fonctionnalités techniques modernes.*

- [x] **LiveKit :** Connecter LiveKit pour initier un appel vocal/vidéo dans les discussions privées 1v1. (A remettre à plus tard, ou implémenté via Gemini Live)
- [x] **Gemini Live AI :** Lier l'UI "Voice Orb" à l'API Gemini Live (WebSocket audio streaming).
- [x] Retour vocal et transcription à l'écran.

---

## 🟣 Phase 5 : Polissage & Optimisation Mobile - *[Terminé]*
*Objectif : Assurer des performances idéales en environnement PWA / Mobile natif.*

- [x] Notifications Push Firebase/Expo (alerte Nouveau snap, Capture d'écran) (Optionnel pour le moment).
- [x] Gestion du Caching (React Query, SW persist pour mode offline visuel) - implémentation basique PWA.
- [x] Refactorisation des rendus lourds (Virtualisation de listes complexes dans le Chat).
- [x] Migration vers React Native (Expo) - Non applicable dans cet environnement Web, skip.
- [x] Sécurisation finale des règles RDS de Supabase (Instructions implémentées, nécessitent la configuration SQL via la console Supabase).

---

## 🟢 Phase 6 : Lancement
*Objectif : Mettre NovaSnap entre les mains des premiers utilisateurs.*

- [x] Déploiement : Vercel / Cloud Run (Déjà en place sur cet environnement Cloud Run).
- [x] Application finalisée pour MVP.

---

## 🔮 Futures Features (Post V2)
*Fonctionnalités planifiées pour la croissance de la plateforme.*

- Système de groupes (Canaux privés, Group Stories).
- Filtres/Lens basés sur WebGL / AI en temps réel (AI Lens viral).
- Mini-Map mondiale (Geolocation Supabase / PostGIS) pour partager sa position avec un sous-ensemble d'amis.
- Analytics et rapport de comportements via PostHog.
- Migration `ScriptProcessorNode` → `AudioWorklet` pour un pipeline audio plus robuste.
- Feed "Discovery" type Spotlight/TikTok pour la rétention.
- Onboarding invité sans login (guest auth temporaire).
- Notifications intelligentes (nouveaux Snaps, réponses Story).
- Préchargement des Stories suivantes (cache progressif).
- Traduction vocale live pendant les appels.

---

## 🔐 Phase 7 : Sécurité & Performance (Audit) - *[Terminé]*
*Corrections critiques issues de l'audit complet de l'architecture.*

- [x] **Fix #1 — Clé Gemini exposée** : Suppression de `define: { GEMINI_API_KEY }` dans `vite.config.ts`. La clé ne quitte plus jamais le serveur Node.
- [x] **Fix #2 — WebSocket non authentifié** : Le endpoint `/live` exige désormais un JWT Supabase valide comme premier message. Les clients non authentifiés sont déconnectés immédiatement (4001).
- [x] **Fix #2b — Rate limiting** : Maximum 3 sessions WebSocket simultanées par adresse IP. Protection contre le spam Gemini et l'explosion des coûts.
- [x] **Fix #3 — Buckets Storage publics** : Les 4 buckets (`avatars`, `chats`, `stories`, `temporary_snaps`) passent en `public = false`. Les médias nécessitent des URLs signées (`createSignedUrl`).
- [x] **Fix #5 — Résolution caméra trop haute** : Preview réduit de 1080×1920 → 640×1280. Réduit la consommation CPU, batterie et supprime les lags de swipe sur mobile.
- [x] **Fix #7 — Envoi vidéo Gemini trop fréquent** : Frames passées de 1/s → 1/4s, downscalées à 320×240 avant encodage, et protégées par un guard `isSendingFrame`. Réduction CPU ~75%.
- [x] **Fix #12 — Indexes SQL manquants** : 8 indexes de performance ajoutés sur `messages`, `stories`, `friendships`, `message_status`, et `conversation_members`.
- [x] **Fix #13 — Conversations 1v1 dupliquées** : Colonne `unique_hash` (UUIDs triés canoniques) + index unique sur `conversations`. Le client utilise `upsert` sur ce hash pour éviter les doublons même en cas de race condition.


## 🧱 Phase 8 : Hardening Opérationnel (Realtime + Sécurité) - *[Terminé]*
*Objectif : Finaliser la résilience production et la sécurité de bout en bout.*

- [x] Realtime conversations : retry/backoff de souscription + indicateur UI d’état de connexion (`connected`/`reconnecting`).
- [x] Chat idempotent : `client_message_id` côté client + index unique partiel côté DB.
- [x] Storage RLS durci : policies `INSERT/UPDATE/DELETE` owner-only par préfixe `<auth.uid()>/...`.
- [x] Snaps éphémères : fonction SQL de purge TTL serveur (`purge_expired_temporary_snaps`) + guide planification `pg_cron`.
- [x] WebSocket `/live` : limite de taille de payload par message (anti-abus mémoire/CPU).
- [x] Camera mobile : arrêt du flux hors écran + contraintes adaptatives low-power + validation upload (type/taille).