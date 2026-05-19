# ROADMAP-FR — NovaSnap (Produit + Technique)

> Horizon 18–24 mois — ambition Big Tech, exécution incrémentale réaliste.

## Cadre de priorisation
- **Impact business** : acquisition, rétention, revenu.
- **Impact UX** : fluidité, confiance, différenciation.
- **Effort** : S (1-2 sem), M (1-2 mois), L (1-2 trimestres).
- **Risque** : dette, complexité infra, conformité.

---

## Phase 1 — Stabilisation (0–8 semaines)

| Initiative | Priorité | Effort | Impact | Dépendances | Architecture impactée |
|---|---|---|---|---|---|
| Audit RLS exhaustif + tests SQL | P0 | M | Très fort | migrations sécurité P0 | DB/Auth |
| Hardening websocket Gemini | P0 | S | Fort | serveur WS | Backend/IA |
| Suite tests E2E parcours critiques | P0 | M | Très fort | seeds + mocks | Front + API |
| Observabilité unifiée (Sentry + metrics) | P1 | M | Fort | pipeline logs | Full stack |
| Performance budget mobile | P1 | S | Fort | profiling | Frontend |

**Livrables clés**
- Zéro endpoint critique sans auth/limit.
- Dashboard sécurité actif + alerting.
- Réduction crashes UX et incidents prod.

---

## Phase 2 — Caméra avancée (2–4 mois)

- Dual camera PiP.
- AR filters GPU (WebGL/WebGPU fallback).
- Lenses IA génératives contextuelles.
- Segmentation sujet/arrière-plan temps réel.

**Tradeoffs**
- Qualité vs batterie/thermique.
- Compatibilité navigateurs mobiles hétérogènes.

**KPIs**
- +25% création de snaps/jour.
- +15% temps session caméra.

---

## Phase 3 — IA native (4–7 mois)

| Bloc | Description | Impact UX | Impact business |
|---|---|---|---|
| Assistant conversationnel | suggestions/réponses contextuelles | friction message ↓ | rétention ↑ |
| AI Memories | auto-tag, recherche sémantique | retrouvabilité ↑ | stickiness ↑ |
| Smart Stories | auto-caption, montage auto | effort créatif ↓ | création contenu ↑ |
| Modération IA | classification risque | confiance ↑ | risque légal ↓ |
| Traduction live | chat multilingue | expansion geo ↑ | TAM ↑ |

**Contraintes IA**
- Latence inférieure à 300–600ms cible pour vocal “naturel”.
- Contrôle coût/token + quotas utilisateurs.

---

## Phase 4 — Communication realtime (6–9 mois)

- Appels audio/vidéo 1:1 puis groupes via LiveKit.
- Partage écran, voice filters, spatial audio.
- Synchronisation présence call ↔ chat/status.

**Dépendances**
- TURN/STUN policy.
- Monitoring QoS (jitter, packet loss, MOS).

---

## Phase 5 — Social Graph & Discovery (8–12 mois)

- Suggestion d’amis ML-light (graph heuristics).
- Discovery feed “Spotlight”.
- Boucles virales (invites, remix, challenges).
- Creator surfaces (profils enrichis, analytics).

**Risques**
- Qualité recommandations initiales.
- Modération contenu public à l’échelle.

---

## Phase 6 — Monétisation (10–14 mois)

| Produit | Modèle | Dépendances |
|---|---|---|
| Nova+ subscription | SaaS B2C | Billing + entitlements |
| Creator payouts | Revshare | wallet ledger + anti-fraud |
| Premium AI | usage tiers | metering infra |
| Gifting | microtransactions | AML/KYC selon région |

---

## Phase 7 — Infrastructure (12–16 mois)

- Découpage progressif vers services orientés domaines.
- Event-driven backbone (queue + DLQ + retries).
- CDN média multi-région.
- Edge compute pour proximité latence.

**Scaling challenges**
- Fan-out realtime massif.
- Cohérence eventual consistency cross-services.

---

## Phase 8 — Sécurité avancée (14–18 mois)

- E2E encryption (scope DM prioritaire).
- Anti-spam/anti-abuse temps réel.
- Anti-screenshot signalement/heuristiques.
- Privacy controls granulaires unifiés.

**Security considerations**
- Rotation clés, device trust, recovery UX.
- Équilibre modération vs chiffrement fort.

---

## Phase 9 — Innovation (16–24 mois)

- XR social layers.
- AR world persistent anchors.
- AI avatars conversationnels.
- Holographic chat concepts.
- Wearable integration (watch/glasses).

---

## Backlog transverse permanent

1. **DX** : générateurs de modules, quality gates, contract tests.
2. **Data** : event taxonomy, privacy-safe analytics.
3. **Ops** : runbooks incidents, chaos drills realtime.
4. **Conformité** : RGPD/DSA/COPPA selon marchés.

---

## Dépendances critiques globales

- Discipline migrations SQL + versioning RLS.
- Gouvernance coûts IA et push.
- CI/CD avec environnements preview isolés.
- Feature flags pour rollout progressif.

---

## North Star Metrics

- DAU/WAU, D1/D7/D30 retention.
- Messages envoyés/utilisateur/jour.
- Snap creation rate & story completion rate.
- P95 latence chat realtime.
- P95 latence réponse IA vocale.
- Crash-free sessions.
- ARPU + conversion premium.
