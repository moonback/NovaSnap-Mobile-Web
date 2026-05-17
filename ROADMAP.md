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
- [ ] Créer la logique d'expiration de message (Délétion ou masquage visuel après l'ouverture et fin du timer).
- [x] **Stories :** Permettre de poster une Story (24h de visibilité) + Fetch actif depuis la Base.

---

## 🔵 Phase 4 : Voix IA & Appels WebRTC - *[Terminé]*
*Objectif : Intégrer les fonctionnalités techniques modernes.*

- [x] **LiveKit :** Connecter LiveKit pour initier un appel vocal/vidéo dans les discussions privées 1v1. (A remettre à plus tard, ou implémenté via Gemini Live)
- [x] **Gemini Live AI :** Lier l'UI "Voice Orb" à l'API Gemini Live (WebSocket audio streaming).
- [x] Retour vocal et transcription à l'écran.

---

## 🟣 Phase 5 : Polissage & Optimisation Mobile - *[Prochaine étape]*
*Objectif : Assurer des performances idéales en environnement PWA / Mobile natif.*

- [ ] Notifications Push Firebase/Expo (alerte Nouveau snap, Capture d'écran).
- [ ] Gestion du Caching (React Query, SW persist pour mode offline visuel).
- [ ] Refactorisation des rendus lourds (Virtualisation de listes complexes dans le Chat).
- [ ] Migration vers React Native (Expo) si l'empaquetage Web ne remplit pas les objectifs de performance matérielle stricte (accès bas niveau API Flash/Zoom).
- [ ] Sécurisation finale des règles RDS de Supabase.

---

## 🔮 Futures Features (Post V2)
*Fonctionnalités planifiées pour la croissance de la plateforme.*

- Système de groupes (Canaux privés, Group Stories).
- Filtres/Lens basés sur WebGL / AI en temps réel.
- Mini-Map mondiale (Geolocation Supabase / PostGIS) pour partager sa position avec un sous-ensemble d'amis.
- Analytics et rapport de comportements via PostHog.
