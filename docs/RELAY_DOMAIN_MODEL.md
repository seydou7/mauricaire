# MAURICARE RELAY — DOMAIN MODEL & CLINICAL COLLABORATION GOVERNANCE

## 1. Vision & Architecture Overview

MauriCare Relay est le module de collaboration clinique et de continuité des soins entre professionnels de santé autorisés (ex. infirmier en visite à domicile sollicitant l'avis d'un médecin ou d'un spécialiste).

### Principes cardinaux :
1. **Zéro diagnostic médical par IA** : La plateforme est un canal d'échange structuré et sécurisé exclusivement réservé aux professionnels de santé humains qualifiés et vérifiés.
2. **Minimisation des données (Data Minimization)** : Seules les données cliniques strictement nécessaires (observations, instantané de constantes vitales ciblées, pièces jointes contextuelles comme photo de plaie ou document de soin) sont partagées dans le cadre du Relay.
3. **Divulgation progressive pré/post acceptation** : Avant acceptation explicite d'une demande par un confrère, seuls les éléments minimaux de triage (spécialité requise, degré d'urgence, motif catégoriel) sont visibles. Le dossier clinique détaillé n'est déverrouillé qu'après acceptation formelle.
4. **Cloisonnement strict des échanges** : Les messages d'échange professionnel-à-professionnel (`relayMessages`) sont strictement isolés de la messagerie patient-praticien (`messages`) et du cercle de proches (Module 5).
5. **Intégration sécurisée au parcours patient** : À la clôture du Relay, une synthèse de coordination clinique (`relayOutcome`) est générée et intégrée au suivi du patient, sans exposer les échanges opérationnels bruts.

---

## 2. State Machine (Cycle de vie d'un Relay)

```
  [draft] 
     │
     ▼
[requested] ──────(Requester cancel)─────► [cancelled]
     │
     ├──────────(Target provider decline)──► [declined]
     │
     ▼ (Target/available provider accepts)
 [accepted]
     │
     ▼ (Messages exchanged / In analysis)
[in_progress]
     │
     ▼ (Responder submits professional response)
 [answered]
     │
     ▼ (Requester/Responder marks done with care summary)
[completed]
```

### Description des transitions d'états :

| État | Acteur habilité | Description / Prérequis |
| :--- | :--- | :--- |
| `draft` | Demandeur | Préparation locale d'une demande avant soumission. |
| `requested` | Demandeur | Demande publiée vers la spécialité ou le confrère ciblé. Vérification préalable d'une relation de soin active avec le patient (`careRelationship`). |
| `accepted` | Confrère répondeur | Prise en charge de la demande par un praticien actif et vérifié. Attribution atomique (prévention des race-conditions). Déverrouillage des observations cliniques. |
| `declined` | Confrère répondeur | Refus motivé d'une demande directe. Événement d'audit consigné. |
| `in_progress` | Demandeur ou Répondeur | Échanges professionnels en cours via `relayMessages`. |
| `answered` | Confrère répondeur | Soumission d'un avis structuré (`summary`, `professionalOpinion`, `recommendedNextStep`, `followUpAdvised`). |
| `completed` | Demandeur ou Répondeur | Clôture formalisée avec synthèse patient-safe (`relayOutcome`). Notification de clôture émise. |
| `cancelled` | Demandeur | Annulation de la demande avant traitement. |

---

## 3. Matrice de Permissions & Rôles

| Opération | Demandeur (Requester) | Répondeur (Responder) | Autre Professionnel | Patient | Cercle (Circle) |
| :--- | :---: | :---: | :---: | :---: | :---: |
| **Créer une demande** | ✅ (Si soin actif) | ❌ | ❌ | ❌ | ❌ |
| **Voir triage préliminaire** | ✅ | ✅ (Si spécialité) | ✅ (Si spécialité) | ❌ | ❌ |
| **Voir observations détaillées** | ✅ | ✅ (Après acceptation)| ❌ | ❌ | ❌ |
| **Accepter la demande** | ❌ | ✅ | ✅ (Si non assigné)| ❌ | ❌ |
| **Échanger des messages Pro** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Soumettre avis structuré** | ❌ | ✅ | ❌ | ❌ | ❌ |
| **Clôturer & synthétiser** | ✅ | ✅ | ❌ | ❌ | ❌ |
| **Consulter la synthèse de soin**| ✅ | ✅ | ❌ | ✅ (`relayOutcome`) | ✅ (Si délégué soins)|

---

## 4. Modèle de Données & Minimisation

### Table `relayRequests`
- `patientId`: ID du patient bénéficiaire du soin.
- `requestingProviderId`: Praticien demandeur (vérifié, actif, relation de soin établie).
- `requestedSpecialty`: Spécialité requise (médecin, cardiologue, infirmier, etc.).
- `assignedProviderId`: Praticien répondeur ayant accepté la mission.
- `urgencyLevel`: `standard` ou `priority`.
- `status`: Cycle de vie décrit ci-dessus.
- `clinicalContext`: Observations cliniques précises, soins dispensés, symptômes observés.
- `selectedVitals`: Instantané de constantes vitales pertinentes (tension, pouls, température, SpO2).
- `attachments`: Pièces jointes privées (photos de plaies, comptes-rendus de soins).
- `professionalResponse`: Avis rédigé par le confrère répondeur.
- `relayOutcome`: Synthèse accessible au patient résumant les conclusions de la collaboration.

### Table `relayMessages`
- Fil de discussion confidentiel inter-professionnels lié à un `relayId`.
- Aucune fuite vers le chat patient ou les membres du cercle.

### Table `relayAuditEvents`
- Journalisation infalsifiable de toutes les actions (création, consultation, acceptation, soumission d'avis, clôture).

---

## 5. Non-Interférence avec l'UAT Client

- **Environnement DEV local** : `local:local-babaousmanehawoly-mauricaire`.
- **Client UAT** : `colorless-kookabura-292` (strictly untouchable).
- **Pas de régression sur les Modules 1 à 5**.
- **QA Globale** : Exécutée de manière unique à la fin des 10 modules de la Phase 2.
