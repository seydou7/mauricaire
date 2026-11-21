# MAURICARE — MODÈLE DE VÉRIFICATION & ONBOARDING PROFESSIONNEL (PHASE 2 / MODULE 2)

**Dernière mise à jour :** Novembre 2026  
**Auteurs :** `/manager` (Atlas) avec `/database-migration-expert`, `/application-security-reviewer` et `/frontend-nextjs-expert`  
**Statut :** **ACTIF / VALIDÉ POUR IMPLÉMENTATION**

---

## 1. Vision & Principes de Confiance

MauriCare connecte des patients et leurs familles avec des soignants intervenant à domicile en Mauritanie. La sécurité des patients et la crédibilité de la plateforme reposent sur une vérification humaine rigoureuse de chaque professionnel avant toute mise en relation publique :

* **Zéro visibilité publique sans homologation :** Un professionnel ne peut jamais apparaître dans l'annuaire de recherche s'il n'est pas expressément validé par un administrateur accrédité (`onboardingStatus === "approved"` et `verified === true`).
* **Vérification documentaire humaine :** L'administration contrôle la cohérence entre l'identité déclarée, la pièce d'identité officielle et le justificatif d'exercice médical/paramédical.
* **Workflow bienveillant avec demandes de complément :** Un dossier incomplet ou illisible ne conduit pas à un rejet systématique définitif ; l'administrateur formule une demande de complément ciblée avec motif explicite et commentaire, permettant au praticien de rectifier son dossier sans perdre ses acquis.
* **Protection stricte des pièces justificatives :** Les documents d'identité et diplômes sont conservés de manière privée dans Convex Storage avec contrôle d'accès nominatif réservé à l'administrateur et au propriétaire du dossier.

---

## 2. Machine à États Canonique (Lifecycle)

Le cycle de vie du soignant suit les 8 états sémantiques stricts :

```
[ Inscription ]
       │
       ▼
 registration_started
       │  (Vérification OTP e-mail réussie)
       ▼
   email_verified
       │  (Accès au formulaire d'onboarding, sauvegarde de brouillon)
       ▼
 onboarding_incomplete
       │  (Vérification des pièces requises et soumission)
       ▼
     submitted
       │  (Prise en charge par un administrateur sur /admin)
       ▼
   under_review
       │
       ├─────────────────────────┬─────────────────────────┐
       │ (Conforme)              │ (Pièces incomplètes)    │ (Invalide / Fraude)
       ▼                         ▼                         ▼
   approved             complement_required             rejected
(verified = true,                │                         │
 éligible annuaire               │ (Mise à jour pièces)    │ (Motif notifié,
 si available = true)            ▼                         │  accès restreint)
                             submitted ────────────────────┘
```

### Table des Transitions Autorisées

| État Initial | Action Déclenchante | Acteur | Nouvel État | Effets Secondaires |
| :--- | :--- | :---: | :--- | :--- |
| `registration_started` | Validation OTP Email | Praticien | `email_verified` | Déverrouille l'accès à l'onboarding |
| `email_verified` | Début de saisie du dossier | Praticien | `onboarding_incomplete` | Initialise le profil professionnel |
| `onboarding_incomplete` | Soumission du dossier complet | Praticien | `submitted` | Notifie l'administration, fige le brouillon |
| `submitted` | Consultation par un Admin | Admin | `under_review` | Enregistre l'horodatage d'instruction |
| `under_review` | Décision d'approbation | Admin | `approved` | `verified = true`, envoi e-mail + notification |
| `under_review` | Demande de complément | Admin | `complement_required` | Motifs + commentaire, envoi e-mail + notification |
| `under_review` | Décision de rejet | Admin | `rejected` | Motif obligatoire, envoi e-mail + notification |
| `complement_required` | Soumission des pièces corrigées | Praticien | `submitted` | Journalise la resoumission dans l'historique |

---

## 3. Dossier Professionnel Requis

Le dossier minimal exigé comprend 4 volets équilibrés :

### Volet 1 : Informations Personnelles
* Prénom et Nom
* Numéro de téléphone vérifié
* Ville de résidence
* Photo de profil

### Volet 2 : Informations Professionnelles
* Spécialité médicale canonique (`infirmier`, `aide_soignant`, `medecin`, `kinestherapeute`)
* Titre professionnel (ex: *Infirmier d'État*, *Médecin Généraliste*)
* Années d'expérience professionnelle
* Numéro d'ordre ou de licence professionnelle (si applicable)
* Biographie / Présentation résumée

### Volet 3 : Justificatifs Obligatoires (Convex Storage Privé)
1. **Pièce d'Identité :** Carte Nationale d'Identité (CNI) mauritanienne ou Passeport valide.
2. **Justificatif de Qualification :** Diplôme d'État de santé, carte professionnelle de l'ordre, ou autorisation officielle d'exercer.
* *Formats autorisés :* PDF, JPEG, PNG, WebP (max 10 Mo par document).

### Volet 4 : Pratique & Tarifs
* Ville principale d'intervention (ex: Nouakchott)
* Zones / Communes couvertes (ex: Tevragh Zeina, Ksar, Sebkha, Dar Naim)
* Tarif indicatif de consultation ou acte de soins (en MRU / Ouguiya)

---

## 4. Rétrocompatibilité & Migration des Praticiens Existants

* **Préservation des praticiens homologués :** Tout soignant ayant déjà `verified === true` dans la base de données est dérivé canoniquement avec `onboardingStatus: "approved"`.
* **Préservation des identifiants :** Les clés `_id` des tables `providers` et `users` restent immuables afin de ne rompre aucun rendez-vous historique, aucune conversation ni aucun avis patient.
* **Tolérance de schéma :** Les nouveaux champs de dossier et les tables `verificationHistory` et `providerDocuments` sont conçus de manière totalement additive.

---

## 5. Sécurité & Gouvernance des Décisions

* **Garde `requireAdmin` :** Toutes les mutations de décision (`approveProviderDossier`, `requestDossierComplement`, `rejectProviderDossier`) exécutent un contrôle strict d'authentification et de rôle Administrateur côté serveur.
* **Interdiction d'auto-approbation :** Un praticien ne peut jamais changer son propre statut vers `approved` ni modifier son champ `verified`.
* **Traçabilité immuable (`verificationHistory`) :** Chaque transition d'état et chaque action d'un administrateur (ID, date, motifs, commentaire) est archivée dans un journal d'audit append-only.
