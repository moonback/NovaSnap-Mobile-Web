# 🚀 NovaSnap — Roadmap V2 : Dépasser Snapchat

> **Vision** : Faire de NovaSnap la première app sociale camera-first avec une IA native, des interactions en temps réel de nouvelle génération, et une monétisation créateur intégrée — là où Snapchat reste bloqué sur des paradigmes de 2015.

---

## 📊 État actuel (Mai 2026)

| Fonctionnalité | Statut |
|---|---|
| Auth + profils | ✅ Terminé |
| Chat realtime éphémère | ✅ Terminé |
| Caméra photo/vidéo | ✅ Terminé |
| Memories (sauvegarde privée) | ✅ Terminé |
| Stories 24h | ✅ Terminé |
| Nova AI (Gemini Live) | ✅ Terminé |
| Design Snapchat-like | ✅ Terminé |
| Sécurité & hardening | ✅ Terminé |

---

## 🗓️ Phase 1 — Fondations Sociales Manquantes
> **Durée estimée : 3-4 semaines**
> **Priorité : CRITIQUE** — Ce sont les features de base que Snapchat a et que NovaSnap n'a pas encore.

### 1.1 Système d'amis / contacts
- [x] Table `friendships` avec statuts (`pending`, `accepted`, `blocked`)
- [x] Bouton "Ajouter un ami" sur les profils
- [x] Écran "Demandes d'amis" avec accept/refus
- [x] Recherche d'utilisateurs par username exact
- [x] Liste d'amis dans le profil
- [x] Compteur d'amis en temps réel

### 1.2 Notifications Push
- [x] Intégration Web Push API (service worker existant à étendre)
- [x] Notification à la réception d'un snap/message
- [x] Notification quand quelqu'un ouvre ton snap
- [x] Notification de demande d'ami
- [x] Notification de nouvelle story d'un ami
- [x] Badge de compteur sur l'icône de l'app (PWA)

### 1.3 Profils publics enrichis
- [x] Page profil visiteur (voir les stories publiques d'un ami)
- [x] Bio / statut personnalisé (140 caractères)
- [ ] Lien Bitmoji / avatar animé (SVG animé généré par IA)
- [ ] Snap Score visible et animé (gamification)
- [x] Bouton "Snap" direct depuis le profil d'un ami
- [x] Statut en ligne / dernière connexion (optionnel, privacy-first)

### 1.4 Groupes de chat
- [x] Création de groupe (nom + membres)
- [x] Avatar de groupe personnalisable
- [x] Mentions `@username` dans les groupes
- [x] Réactions emoji sur les messages (long-press)
- [x] Rôles admin/membre dans les groupes
- [x] Limite de 100 membres par groupe

---

## 🗓️ Phase 2 — Caméra & Créativité Avancée
> **Durée estimée : 4-5 semaines**
> **Priorité : HAUTE** — C'est le cœur différenciateur de l'app.

### 2.1 Filtres & Lenses en temps réel
- [ ] Intégration **TensorFlow.js** ou **MediaPipe** pour la détection de visage
- [ ] Filtre beauté (lissage peau, yeux agrandis)
- [ ] Filtres couleur (noir & blanc, vintage, néon)
- [ ] Overlays animés (chapeaux, lunettes, oreilles)
- [ ] **Lens IA générative** : prompt texte → filtre appliqué en temps réel (via Gemini Vision)
- [ ] Galerie de lenses communautaires (les utilisateurs créent et partagent leurs lenses)

### 2.2 Outils d'édition post-capture
- [x] Texte avec polices multiples et couleurs *(SnapEditor — 4 polices, 8 couleurs, taille ajustable)*
- [x] Stickers animés (bibliothèque intégrée) *(30 emojis intégrés, placement aléatoire, suppression)*
- [x] Dessin à main levée (brush, couleurs, épaisseur) *(Canvas HTML5, annulation du dernier trait)*
- [x] Rotation *(±90° via boutons CCW/CW)*
- [x] Vitesse vidéo (slow-mo x0.5, fast x2) *(sélecteur ×0.5 / ×1 / ×2 sur vidéos)*
- [x] Recadrage précis (crop libre) *(4 curseurs Gauche/Droite/Haut/Bas, masque assombri et grille mobile)*
- [x] Fusion d'image ("Flattening") pour sauvegarde Memories/Local
- [ ] Musique sur les snaps vidéo (bibliothèque libre de droits)
- [x] Boomerang (boucle aller-retour) *(Auto-stop à 2s et boucle fluide avant-arrière en requestAnimationFrame)*
- [ ] Intégration GIPHY API pour stickers animés

### 2.3 Snap Map (Carte mondiale)
- [x] Carte interactive (Leaflet.js ou Mapbox GL) *(Leaflet avec chargement CDN dynamique pour éviter tout conflit de bundler)*
- [x] Partage de position opt-in avec ses amis *(Calcul de coordonnées dynamiques réelles GPS et simulation réactive d'amis à proximité)*
- [x] Stories géolocalisées sur la carte *(Visualisation des spots touristiques parisiens majeurs Eiffel/Louvre/Notre-Dame)*
- [x] Mode "Ghost" (position masquée) *(Interrupteur avec icône de fantôme changeant l'état du marqueur GPS et affichant une bannière translucide)*
- [x] Heatmap des zones actives *(Overlays de halos radiaux colorés animés et bouton de déclenchement Flame)*
- [x] Stories publiques par ville/pays *(Rendu d'images Snaps premium créées via DALL-E, descriptions détaillées et compteurs de vues)*

### 2.4 Dual Camera (Avant + Arrière simultané)
- [ ] Capture simultanée des deux caméras (Picture-in-Picture)
- [ ] Mode "Reaction" : ton visage en overlay sur ce que tu filmes
- [ ] Redimensionnement et repositionnement du PiP

---

## 🗓️ Phase 3 — IA Native (Avantage Compétitif Majeur)
> **Durée estimée : 5-6 semaines**
> **Priorité : HAUTE** — C'est ce qui rend NovaSnap supérieur à Snapchat.

### 3.1 Nova AI — Upgrade complet
- [ ] **Analyse de snap** : Nova décrit ce qu'elle voit dans une photo avant envoi
- [ ] **Suggestions de réponse** : Nova propose 3 réponses contextuelles dans le chat
- [ ] **Traduction automatique** : messages traduits en temps réel dans la langue de l'utilisateur
- [ ] **Résumé de conversation** : "Résume les 50 derniers messages" en un tap
- [ ] **Génération d'image** : "Crée un snap de moi en astronaute" → image générée par Gemini Imagen
- [ ] **Détection de contenu sensible** : modération automatique avant envoi

### 3.2 Stories IA
- [ ] **Auto-caption** : sous-titres générés automatiquement sur les vidéos stories
- [ ] **Highlight reel** : Nova compile automatiquement tes meilleures stories de la semaine
- [ ] **Story suggérée** : "Tu es à Paris, voici une story template pour la Tour Eiffel"
- [ ] **Musique auto-sync** : Nova choisit la musique qui correspond à l'ambiance de ta vidéo

### 3.3 Nova Lens — Filtres génératifs
- [ ] Filtre "Style artistique" : transforme ton snap en peinture, manga, pixel art
- [ ] Filtre "Âge" : te montre à 20 ans ou 60 ans
- [ ] Filtre "Météo" : ajoute pluie, neige, soleil en temps réel sur la vidéo
- [ ] Filtre "Saison" : change l'arrière-plan selon la saison
- [ ] **Lens Creator Studio** : interface pour créer ses propres lenses IA sans code

### 3.4 Assistant vocal amélioré (Nova Orb V2)
- [ ] Commandes vocales pour naviguer dans l'app ("Ouvre le chat avec Alice")
- [ ] Dictée de messages vocaux → texte
- [ ] Traduction vocale live pendant les appels
- [ ] Analyse d'humeur vocale (détecte si tu es stressé, joyeux)
- [ ] Mode "Coach social" : Nova te donne des conseils de conversation

---

## 🗓️ Phase 4 — Appels & Communication Temps Réel
> **Durée estimée : 3-4 semaines**
> **Priorité : HAUTE** — Snapchat a les appels, NovaSnap doit les avoir aussi.

### 4.1 Appels audio/vidéo 1v1
- [ ] Intégration LiveKit (déjà en dépendances) pour appels 1v1
- [ ] Interface d'appel entrant (sonnerie + animation)
- [ ] Appel vidéo avec filtres caméra actifs pendant l'appel
- [ ] Partage d'écran pendant un appel
- [ ] Enregistrement d'appel (avec consentement des deux parties)

### 4.2 Appels de groupe
- [ ] Rooms LiveKit jusqu'à 16 participants
- [ ] Grille vidéo adaptative (speaker view / grid view)
- [ ] Réactions en temps réel pendant l'appel (emojis flottants)
- [ ] Fond virtuel (blur ou image personnalisée)
- [ ] Sous-titres live pendant l'appel (via Nova AI)

### 4.3 Walkie-Talkie (feature unique)
- [ ] Mode "Push-to-talk" : maintiens pour parler, relâche pour envoyer
- [ ] Messages vocaux éphémères (disparaissent après écoute)
- [ ] Indicateur "en train d'écouter" en temps réel
- [ ] Historique vocal de 24h

---

## 🗓️ Phase 5 — Découverte & Contenu Viral
> **Durée estimée : 4-5 semaines**
> **Priorité : MOYENNE-HAUTE** — Rétention et croissance organique.

### 5.1 Spotlight (Feed viral type TikTok)
- [ ] Feed vertical de snaps/stories publics
- [ ] Algorithme de recommandation basé sur les interactions
- [ ] Système de likes et partages
- [ ] Commentaires sur les snaps publics
- [ ] Trending topics et hashtags
- [ ] Filtre par catégorie (humour, sport, musique, voyage...)

### 5.2 Canaux (Broadcast)
- [ ] Créateurs peuvent créer des canaux publics (type Telegram Channels)
- [ ] Abonnement à un canal (notifications)
- [ ] Stories exclusives pour abonnés
- [ ] Statistiques de portée pour les créateurs
- [ ] Monétisation des canaux (tips, abonnements payants)

### 5.3 Challenges & Tendances
- [ ] Système de challenges viraux (ex: "NovaChallenge #danse")
- [ ] Leaderboard hebdomadaire des meilleurs snaps
- [ ] Badges et trophées pour les créateurs actifs
- [ ] Partage cross-platform (Instagram, TikTok, Twitter)

---

## 🗓️ Phase 6 — Monétisation & Économie Créateur
> **Durée estimée : 5-6 semaines**
> **Priorité : MOYENNE** — Modèle économique durable.

### 6.1 Nova Coins (Monnaie virtuelle)
- [ ] Système de monnaie in-app (Nova Coins)
- [ ] Achat de coins via Stripe (IAP)
- [ ] Envoyer des coins à des amis (tips)
- [ ] Coins gagnés par l'activité (streaks, challenges)
- [ ] Boutique de lenses et filtres premium

### 6.2 Abonnements Nova+
- [ ] Tier gratuit (fonctionnalités de base)
- [ ] **Nova+ (4.99€/mois)** : lenses premium, stockage étendu, badge vérifié
- [ ] **Nova Pro (9.99€/mois)** : analytics créateur, canaux illimités, IA avancée
- [ ] Gestion des abonnements via Stripe Billing

### 6.3 Programme Créateur
- [ ] Dashboard analytics (vues, engagement, croissance)
- [ ] Revenus partagés sur les vues Spotlight
- [ ] Partenariats marques (branded lenses)
- [ ] Fonds créateur mensuel (top 100 créateurs)

---

## 🗓️ Phase 7 — Sécurité, Confidentialité & Bien-être
> **Durée estimée : 2-3 semaines**
> **Priorité : HAUTE** — Différenciateur éthique vs Snapchat.

### 7.1 Confidentialité avancée
- [ ] **Chiffrement E2E** des messages (Signal Protocol ou libsodium)
- [ ] Mode "Fantôme" : navigation sans laisser de trace dans les vues
- [ ] Contrôle granulaire de la visibilité (qui peut me voir sur la carte, qui peut m'envoyer des snaps)
- [ ] Export de toutes ses données (RGPD)
- [ ] Suppression de compte complète (cascade DB)
- [ ] Rapport de contenu avec modération humaine

### 7.2 Anti-screenshot
- [ ] Détection de screenshot (API Screen Capture)
- [ ] Notification à l'expéditeur si screenshot détecté
- [ ] Watermark invisible sur les snaps (stéganographie)
- [ ] Mode "No-screenshot" activable par l'expéditeur

### 7.3 Bien-être numérique
- [ ] Limite de temps d'écran configurable
- [ ] Mode "Focus" : désactive les notifications pendant X heures
- [ ] Rapport hebdomadaire d'utilisation
- [ ] Pause de compte temporaire (sans suppression)
- [ ] Filtre de contenu sensible configurable

---

## 🗓️ Phase 8 — Performance & Infrastructure
> **Durée estimée : 3-4 semaines**
> **Priorité : HAUTE** — Scalabilité pour la croissance.

### 8.1 Performance Frontend
- [ ] Virtualisation des listes longues (react-virtual)
- [ ] Lazy loading des images avec blur placeholder
- [ ] Préchargement des stories suivantes (cache progressif)
- [ ] Service Worker avancé (offline-first pour le chat)
- [ ] Bundle splitting par route
- [ ] Images WebP/AVIF automatiques

### 8.2 Infrastructure Backend
- [ ] CDN pour les médias (Cloudflare R2 ou AWS CloudFront)
- [ ] Queue de traitement vidéo (compression automatique à l'upload)
- [ ] Monitoring temps réel (Sentry + Datadog)
- [ ] Alertes automatiques (erreurs, latence, coûts Gemini)
- [ ] Rate limiting par user (anti-spam applicatif)
- [ ] Backup automatique quotidien de la DB

### 8.3 PWA Native-like
- [ ] Installation sur écran d'accueil (manifest complet)
- [ ] Splash screen animé
- [ ] Raccourcis d'app (ouvrir directement la caméra)
- [ ] Partage natif (Web Share API)
- [ ] Contacts natifs (Contact Picker API)
- [ ] Vibrations haptiques sur les interactions clés

---

## 🗓️ Phase 9 — Features Innovantes (Avantage Unique)
> **Durée estimée : 6-8 semaines**
> **Priorité : MOYENNE** — Ce que Snapchat ne fera jamais.

### 9.1 Nova World (AR Social)
- [ ] Objets 3D placés dans l'espace réel (WebXR)
- [ ] "Laisser un message" géolocalisé visible uniquement en AR
- [ ] Chasse au trésor AR entre amis
- [ ] Portails AR : crée un portail vers un lieu que tu as visité

### 9.2 Time Capsule
- [ ] Envoyer un snap à toi-même dans le futur (1 mois, 1 an, 5 ans)
- [ ] Capsule de groupe : tous les amis contribuent, s'ouvre à une date fixée
- [ ] Rappels anniversaire automatiques avec les snaps du passé
- [ ] "Ce jour il y a 1 an" (type Google Photos)

### 9.3 Snap Collab
- [ ] Snap collaboratif : deux personnes filment en même temps, split-screen
- [ ] Duet mode : réponds à un snap avec ton propre snap côte à côte
- [ ] Remix : prends le snap d'un ami et ajoute ta propre couche créative
- [ ] Co-édition de story en temps réel (Google Docs pour les stories)

### 9.4 Nova Pay (Paiements sociaux)
- [ ] Envoyer de l'argent réel via snap (Stripe Connect)
- [ ] Cagnottes de groupe (collecte pour un cadeau, un voyage)
- [ ] Split de facture entre amis
- [ ] QR code de paiement dans le profil

### 9.5 Snap Games
- [ ] Mini-jeux jouables directement dans le chat (sans quitter l'app)
- [ ] Jeu "Devine qui" : devine le snap de quel ami
- [ ] Quiz stories interactifs
- [ ] Tournois entre amis avec classement

---

## 📈 Métriques de Succès

| Métrique | Objectif 6 mois | Objectif 12 mois |
|---|---|---|
| DAU (Daily Active Users) | 10K | 100K |
| Messages envoyés/jour | 50K | 500K |
| Stories postées/jour | 5K | 50K |
| Rétention J7 | 40% | 55% |
| Rétention J30 | 20% | 35% |
| Revenus MRR | 5K€ | 50K€ |

---

## 🏆 Comparatif NovaSnap vs Snapchat

| Feature | Snapchat | NovaSnap V2 |
|---|---|---|
| Messages éphémères | ✅ | ✅ |
| Stories 24h | ✅ | ✅ |
| Filtres/Lenses | ✅ Avancé | 🔄 En cours |
| Snap Map | ✅ | 🔄 Phase 2 |
| Appels vidéo | ✅ | 🔄 Phase 4 |
| IA native intégrée | ❌ Basique | ✅ Gemini Live |
| Filtres génératifs IA | ❌ | ✅ Phase 3 |
| Time Capsule | ❌ | ✅ Phase 9 |
| Snap Collab temps réel | ❌ | ✅ Phase 9 |
| Chiffrement E2E | ❌ | ✅ Phase 7 |
| Économie créateur | ⚠️ Limité | ✅ Phase 6 |
| Nova Pay | ❌ | ✅ Phase 9 |
| AR World | ⚠️ Limité | ✅ Phase 9 |
| Open source friendly | ❌ | ✅ |

---

## 🔢 Ordre de priorité recommandé

```
1. Phase 1  — Amis + Notifs + Groupes        (bloquant pour la rétention)
2. Phase 4  — Appels LiveKit                  (parité Snapchat)
3. Phase 2  — Filtres caméra + Snap Map       (différenciateur créatif)
4. Phase 3  — IA native avancée               (avantage compétitif majeur)
5. Phase 7  — Sécurité E2E + Anti-screenshot  (confiance utilisateur)
6. Phase 8  — Performance + Infrastructure    (scalabilité)
7. Phase 5  — Spotlight + Découverte          (croissance virale)
8. Phase 6  — Monétisation                    (revenus)
9. Phase 9  — Features innovantes             (domination marché)
```

---

*Dernière mise à jour : Mai 2026 — NovaSnap V2 Roadmap*
