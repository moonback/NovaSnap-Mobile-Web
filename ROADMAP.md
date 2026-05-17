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

## 🟡 Phase 2 : Authentification & Base de données - *[Prochaine étape]*
*Objectif : Rendre l'application dynamique et isoler les environnements utilisateurs.*

- [ ] Connecter Supabase Auth (Création de compte, Login, Magic Link / Google Auth).
- [ ] Protéger l'application par une barrière d'authentification (Auth Guard).
- [ ] Connecter Zustand à l'utilisateur courant (`setUser`).
- [ ] Intégrer les requêtes React Query ou hooks Supabase pour charger les amis et conversations.
- [ ] Afficher dynamiquement la liste de discussions et de Stories à partir du serveur.

---

## 🟠 Phase 3 : Capture Média & Realtime - *[MVP Final]*
*Objectif : Activer l'envoi de contenu éphémère (Core Loop).*

- [ ] **Caméra :** Implémenter la capture photo via Canvas et l'enregistrement vidéo (MediaRecorder).
- [ ] **Storage :** Uploader statiquement les snaps vers les buckets Supabase (`temporary_snaps`, `stories`).
- [ ] **Chat :** Activer Supabase Realtime pour envoyer et recevoir des textes, statuts lus/non-lus, "Typing...".
- [ ] Créer la logique d'expiration de message (Délétion ou masquage visuel après l'ouverture et fin du timer).
- [ ] **Stories :** Permettre de poster une Story (24h de visibilité) + lecture séquentielle avec barre de progression.

---

## 🔵 Phase 4 : Voix IA & Appels WebRTC - *[V1]*
*Objectif : Intégrer les fonctionnalités techniques modernes.*

- [ ] **LiveKit :** Connecter LiveKit pour initier un appel vocal/vidéo dans les discussions privées 1v1.
- [ ] **Gemini Live AI :** Lier l'UI "Voice Orb" à l'API Gemini Live (WebSocket audio streaming).
- [ ] Analyser le flux caméra (snapshot via base64) et le transmettre au modèle en temps réel.
- [ ] Retour vocal et transcription à l'écran.

---

## 🟣 Phase 5 : Polissage & Optimisation Mobile - *[V1.5]*
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
