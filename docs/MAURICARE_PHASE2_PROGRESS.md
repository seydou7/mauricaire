# MauriCare — Phase 2 Progress Tracker

- [x] Module 1 — Inscription & Authentification
- [x] Module 2 — Onboarding Professionnel & Vérification Admin
- [x] Module 3 — Profils & Sécurité des comptes
- [x] Module 4 — Services, Disponibilités & Réservation avancée
- [x] Module 5 — MauriCare Circle
- [x] Module 6 — MauriCare Relay
- [x] Module 7 — MauriCare HomeLab
- [x] Module 8 — MauriCare Chronic
- [x] Module 9 — MauriCare Voice AI
- [x] Module 10 — Convergence & Hardening

**AUTOMATED QA: PASS (100% — 70/70 TESTS)**  
**HUMAN QA: PENDING (PROJECT OWNER ONLY)**

---

## Détails d'implémentation — Module 2
- **Modèle de données & Cycles de vie** : `docs/PROFESSIONAL_VERIFICATION_MODEL.md` (8 états canoniques, transitions strictes, règle anti-auto-approbation, piste d'audit).
- **Schéma Convex** : tables `providers` enrichie, `providerDocuments` (métadonnées & storageId), `verificationHistory` (historique chronologique des décisions).
- **Service d'Onboarding** : `src/convex/onboarding.ts` (sauvegarde de brouillon étape par étape, upload de documents privés, validation MIME & limite 10 Mo, contrôle d'accès propriétaire/admin).
- **Console Administrateur** : `src/convex/admin.ts` et `src/pages/Admin.tsx` (filtres avec onglet "Complément requis", consultation détaillée du dossier et des pièces justificatives privées, formulaire structuré de demande de complément, motif de rejet obligatoire, approbation et scheduling d'e-mails de notification).
- **UI Onboarding Soignant** : `src/components/ProfessionalOnboarding.tsx` (wizard en 5 étapes, support RTL/FR/AR, sauvegarde de brouillon, affichage des motifs de complément et réexpédition du dossier).
- **Tableau de bord & Protection de l'annuaire** : `src/pages/Dashboard.tsx` (bannière d'état d'accréditation, verrouillage de la disponibilité pour les praticiens non agréés).

---

## Détails d'implémentation — Module 3
- **Politique de Re-vérification Professionnelle** : `docs/PROFILE_REVERIFICATION_POLICY.md` (classification des champs sensibles vs non sensibles, procédure de ré-examen sans rupture de prise en charge pour les rendez-vous en cours).
- **Schéma Convex & Migrations** :
  - Tables créées : `emergencyContacts` (indexé par `by_userId`), `securityEvents` (indexé par `by_userId`, `by_timestamp`).
  - Tables enrichies : `users` (`neighborhood`, `deactivatedAt`), `providers` (`reverificationRequired`), `verificationTokens` (`purpose: "email_change"`, `targetEmail`).
- **Gestion des Profils & Photos** :
  - `src/convex/users.ts` : `saveAvatar` & `removeAvatar` (suppression propre des anciens fichiers Convex Storage, journalisation d'audit), `getCompleteUserProfile` (calcul dynamique du score de complétion et liste des champs manquants), `updatePatientProfile` & `updateProfessionalProfile` (contrôle des champs sensibles et déclenchement automatique du ré-examen).
- **Sanitisation et Confidentialité Publique** :
  - `src/convex/providers.ts` : Sanitisation stricte de `getNearbyProviders` et `getById` pour masquer `identityCardStorageId`, `diplomaStorageId`, `licenseStorageId`, `adminNotes`, motifs de rejet ou de complément aux utilisateurs publics.
- **Sécurité des Comptes & Sessions** :
  - `src/convex/accountSecurity.ts` : `changePassword` (validation de mot de passe actuel via `retrieveAccount`, politique de complexité, déconnexion des autres sessions), `requestEmailChange` & `confirmEmailChange` (flux OTP 2 étapes avec envoi sur le nouvel email et alerte de sécurité sur l'ancienne adresse), `getActiveSessions` & `logoutOtherSessions` (affichage transparent des sessions réelles sans fabrication de fausses données de localisation/device), `deactivateAccount` & `reactivateAccount` (soft-delete avec désactivation immédiate des disponibilités soignants, interdiction stricte d'auto-désactivation pour les admins), `getSecurityAuditTrail` (journalisation sécurisée sans secrets).
- **Contacts d'Urgence** :
  - `src/convex/emergencyContacts.ts` : CRUD complet avec désignation d'un contact principal et étanchéité stricte (aucun accès automatique au dossier médical).
- **Interfaces & Expérience Utilisateur** :
  - `src/components/profile/EmergencyContactTab.tsx` : Gestion fluide des contacts d'urgence avec relations bilingues (FR/AR/RTL).
  - `src/components/profile/AccountSecurityTab.tsx` : Vue sécurité unifiée (changement mot de passe, email, sessions actives, piste d'audit, suspension de compte avec confirmation textuelle "DESACTIVER").
  - `src/pages/Dashboard.tsx` : Refonte de la section Profil avec jauges de complétion, onglets dédiés Patients/Soignants, intégration des sous-onglets d'urgence et de sécurité.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : Nouveaux espaces de traduction `profile` et `dashboard.tabs`.

---

## Détails d'implémentation — Module 4
- **Catalogue Canonique de Soins (`src/convex/serviceCatalog.ts`)** :
  - Définition structurée par spécialité (Infirmier, Kinésithérapeute, Médecin, Aide-soignant) avec libellés bilingues (FR/AR), durées et tarifs indicatifs en MRU.
- **Catalogue Praticien (`src/convex/providerServices.ts`)** :
  - `getMyServices`, `getProviderServices`, `saveService`, `deleteService` : habilitation stricte (seuls les praticiens approuvés et vérifiés publient des actes actifs), validation des durées et des tarifs.
- **Disponibilités, Exceptions & Congés (`src/convex/availability.ts`)** :
  - Grille hebdomadaire récurrente (plages multiples par jour, jours fermés, délai de préavis configurable).
  - Exceptions de dates ponctuelles (`saveDateException`) et gestion des congés (`saveLeave` avec détection et reporting des conflits de réservations déjà confirmées).
  - Génération autoritaire des créneaux horaires côté serveur (`getAvailableSlots`) prenant en compte la durée du soin, les congés, le préavis UTC et l'exclusion des rendez-vous bloquants (`en_attente`, `confirme`).
- **Prévention Transactionnelle des Conflits & Snapshot de Prix (`src/convex/appointments.ts`)** :
  - Réévaluation côté serveur du tarif et de la durée faisant autorité (rejet de toute manipulation tarifaire client).
  - Snapshot immuable (`serviceSnapshot`) sauvegardé dans le rendez-vous pour sanctuariser l'historique financier.
  - Vérification géographique des zones d'intervention (`interventionZones`).
  - Détection transactionnelle de chevauchement d'horaires.
  - Réservation de la compatibilité Module 5 (`beneficiaryId`).
- **Favoris Patients (`src/convex/favorites.ts`)** :
  - CRUD et bascule d'état (`toggleFavorite`, `isFavorite`, `getFavorites`), découplé de l'historique clinique "Mes soignants".
- **Soins Récurrents (`src/convex/recurringCare.ts`)** :
  - Table `recurrenceSeries` et génération en chaîne des occurrences de rendez-vous.
  - Validation préalable de disponibilité sur l'ensemble de la série (`validateRecurringSeries`).
  - Annulation granulaire ("cette séance uniquement" ou "cette séance et toutes les futures non effectuées", protection absolue des séances déjà terminées).
- **Interface & Parcours Utilisateur** :
  - `src/components/BookingStepper.tsx` : Parcours en étapes avec choix des prestations du soignant, sélection de créneaux dynamiques temps réel, option protocole récurrent, résumé de tarification figée (Snapshot) et paiement espèces (Cash).
  - `src/components/ProviderAvailability.tsx` : Consultation en direct des créneaux calculés par le serveur.
  - `src/components/profile/ProviderServicesTab.tsx` : Gestion du catalogue d'actes soignant.
  - `src/components/profile/ProviderScheduleTab.tsx` : Gestion des plages hebdomadaires, délais de préavis, congés et exceptions.
  - `src/pages/Dashboard.tsx` : 3 onglets Soignants (Mes soignants, Favoris, Annuaire complet avec filtres par zone et tarif), bouton "Reprendre rdv" sur les soins terminés, vue des protocoles récurrents.
  - `src/pages/ProviderDetails.tsx` : Présentation du catalogue des prestations, honoraires et bouton favoris.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : Traductions bilingues complètes (FR/AR/RTL) pour le module `scheduling`.

---

## Détails d'implémentation — Module 5 (MauriCare Circle)
- **Modèle de données & Schéma Convex (`src/convex/schema.ts`)** :
  - Tables créées : `circles` (index `by_patientId`), `circleMembers` (index `by_circle`, `by_patientId`, `by_memberUserId`, `by_patient_and_member`, `by_member_status`), `circleInvitations` (index `by_token`, `by_circle`, `by_patientId`, `by_inviteeEmail`, `by_patient_email`), `circleAuditEvents` (index `by_circle`, `by_patientId`, `by_actor`).
  - Tables enrichies : `appointments` (`beneficiaryId`, `bookedByUserId`, index `by_beneficiary`, `by_bookedBy`), `recurrenceSeries` (`beneficiaryId`, `bookedByUserId`).
- **Moteur d'autorisations & Audit Trail (`src/convex/circle.ts`)** :
  - Permissions canoniques granulaires : `VIEW_APPOINTMENTS`, `BOOK_APPOINTMENTS`, `MANAGE_APPOINTMENTS`, `RECEIVE_APPOINTMENT_NOTIFICATIONS`, `VIEW_CARE_SUMMARY`, `VIEW_SELECTED_HEALTH_DATA`.
  - Relations canoniques bilingues (FR/AR) : `child`, `spouse`, `parent`, `sibling`, `family`, `caregiver`, `trusted_person`, `other`.
  - Contrôle autoritaire côté serveur : `verifyCirclePermission`, `getOrCreateCircle`, `logCircleAuditEvent`, `notifyCircleMembers`.
  - Flux d'invitation avec jetons cryptographiques non devinables, expiration à 7 jours, révocation immédiate sans suppression d'audit, et support des mandats temporaires.
- **Réservation Déléguée & Intégration Clinique (`src/convex/appointments.ts`, `recurringCare.ts`)** :
  - Imputabilité stricte : conservation de l'acteur qui réserve (`bookedByUserId`) et du patient qui reçoit les soins (`patientId` / `beneficiaryId`).
  - Pré-remplissage et validation de l'adresse du patient bénéficiaire (Section 30).
  - Notifications transactionnelles discrètes et sécurisées pour le patient, le praticien et les membres autorisés du Cercle (Section 20 & 21).
  - Notification de fin de visite respectueuse de la vie privée (sans diagnostic ni notes confidentielles).
- **Interfaces & Expérience Utilisateur (`src/components/circle/`)** :
  - `src/components/circle/CircleManagement.tsx` : Espace complet de gestion du Cercle patient (Membres actifs, Invitations en attente, Journal de sécurité immuable, Modales d'invitation et d'édition de permissions).
  - `src/components/circle/AccompaniedPatientsSection.tsx` : Section pour les membres du Cercle (notamment diaspora) présentant les patients accompagnés avec actions directes de réservation et consultation d'agenda.
  - `src/pages/AcceptInvitation.tsx` : Page dédiée d'examen et d'acceptation sécurisée d'invitation avec authentification préalable requise.
  - `src/components/BookingStepper.tsx` : Sélecteur de contexte de bénéficiaire ("Pour moi-même" vs "Pour un proche accompagné") avec application de l'adresse par défaut et récapitulatif clair.
  - `src/pages/Dashboard.tsx` : Intégration de l'onglet "Cercle de proches", indicateur "Réservé par son proche", et section des personnes accompagnées.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : Espaces de traduction `circle` complets avec support RTL.
- **Suite de Tests d'Intégration & Habilitation (`src/convex/test_circle.ts`)** :
  - 8 tests automatisés (Domain Logic, Authorization, Integration) validés à 100% PASS.

---

## Détails d'implémentation — Module 6 (MauriCare Relay)
- **Gouvernance & Modèle de Domaine (`docs/RELAY_DOMAIN_MODEL.md`)** :
  - Cycle de vie canonique : `draft` -> `requested` -> `accepted` | `declined` -> `in_progress` -> `answered` -> `completed` (ou `cancelled`).
  - Zéro diagnostic IA : canal direct et structuré entre soignants humains qualifiés.
  - Minimisation des données & divulgation progressive pré/post acceptation.
  - Cloisonnement étanche des échanges professionnels (`relayMessages`) et intégration sécurisée de la synthèse (`relayOutcome`).
- **Schéma Convex (`src/convex/schema.ts`)** :
  - Table `relayRequests` : `patientId`, `requestingProviderId`, `requestedSpecialty`, `assignedProviderId`, `urgencyLevel` (`standard` / `priority`), `status`, `clinicalContext` (observations, carePerformed, symptoms), `selectedVitals` (bloodPressure, pulse, temperature, spO2), `attachments`, `professionalResponse` (summary, opinion, nextStep, followUpAdvised), `relayOutcome`, dates de cycle de vie. Indexé par patient, demandeur, répondeur, statut, spécialité, rendez-vous, création.
  - Table `relayMessages` : fil de discussion pro-to-pro lié à `relayId`, `senderUserId`, `senderProviderId`, `attachments`. Indexé par `by_relay` et `by_relay_created`.
  - Table `relayAuditEvents` : journalisation d'audit immuable de chaque événement de collaboration clinique.
- **Backend & Règles Métier (`src/convex/relay.ts`)** :
  - Contrôle d'éligibilité soignant : vérification de statut actif/approuvé (`requireActiveVerifiedProvider`).
  - Contrôle de relation de soin légitime : validation d'un soin confirmé ou terminé avec le patient (`requireCareRelationship`).
  - Prévention des race conditions : acceptation atomique vérifiant `status === "requested"` et non-assignation concurrente (`acceptRelayRequest`).
  - Requêtes sécurisées : `getEligiblePatientsForRelay`, `getMySentRelayRequests`, `getIncomingRelayRequests` (avec masquage des données sensibles avant acceptation), `getRelayDetails`, `getRelayMessages`, `getPatientRelayHistory` (synthèse patient-safe exclusive).
  - Mutations autoritaires : `createRelayRequest`, `acceptRelayRequest`, `declineRelayRequest`, `sendRelayMessage`, `submitProfessionalResponse`, `completeRelayRequest`, `cancelRelayRequest`, `generateRelayUploadUrl`.
- **Interfaces & Expérience Utilisateur (`src/components/relay/`)** :
  - `CreateRelayModal.tsx` : création d'une demande avec sélecteur de patient suivi, spécialité cible, urgence, observations, constantes vitales et téléversement de pièces jointes privées (photos de plaie / comptes-rendus).
  - `RelayDetailModal.tsx` : vue complète avec statut, mode triage pré-acceptation, dossier clinique déverrouillé, fil de discussion pro-to-pro temps réel, formulaire de réponse structurée et clôture avec synthèse de soins.
  - `RelayInbox.tsx` : tableau de bord de coordination soignant avec onglets Demandes reçues / Demandes émises, filtres par statut, recherche et compteurs d'attente.
  - `PatientRelayTimelineCard.tsx` : carte synthétique intégrée au parcours patient affichant les conclusions cliniques partagées sans dévoiler les échanges opérationnels bruts.
  - `src/pages/Dashboard.tsx` : onglet "MauriCare Relay" dans la barre de navigation professionnelle, déclencheur rapide dans la fiche patient, et historique de coordination dans l'espace patient.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : traductions complètes bilingues (FR/AR/RTL) sous le namespace `relay`.
- **Portes Techniques Légères (Section 44)** :
  - `npx convex dev --once` : OK (fonctions et schéma enregistrés).
  - `npx tsc -b --noEmit` : OK (0 erreur TypeScript).
  - `npm run build` : OK (bundle Vite production valide).
  - `npx eslint . --quiet` : OK (0 erreur de lint).
  - Aucune suite de test fonctionnel dédiée exécutée (conformément aux consignes).

---

## Détails d'implémentation — Module 7 (MauriCare HomeLab)
- **Prévol Sécurité & Correction Permission Cercle/Relay** :
  - Audit de `src/convex/relay.ts` : suppression de la permission générique non canonique `view_medical` et alignement strict sur `CIRCLE_PERMISSIONS.VIEW_CARE_SUMMARY` avec rétrocompatibilité contrôlée.
  - Confirmation absolue de l'étanchéité : aucun accès du Cercle aux conversations brutes inter-professionnels, aux pièces jointes privées ou au contexte complet Relay.
  - Enrichissement des permissions canoniques du Cercle dans `src/convex/circle.ts` : `VIEW_HOMELAB_STATUS` (suivi logistique sans données médicales) et `MANAGE_HOMELAB` (droit de commande explicite distinct de la consultation de données).
- **Modèle de Domaine (`docs/HOMELAB_DOMAIN_MODEL.md`)** :
  - Spécification exhaustive de l'orchestration des prélèvements à domicile et de l'intégration biologique.
  - Principe "Zéro IA diagnostique" : aucun algorithme n'interprète les bilans sanguins ; les valeurs de référence et conclusions sont sous la responsabilité exclusive du laboratoire partenaire agréé.
- **Schéma Convex (`src/convex/schema.ts`)** :
  - `labTestCatalog` : catalogue canonique (NFS, Glycémie, HbA1c, Créatinine, Urée, Bilan Lipidique, Transaminases, CRP, ECBU) avec consignes de jeûne, ordonnance obligatoire et prix indicatifs en MRU.
  - `laboratoryPartners` : modèle d'organisation des laboratoires partenaires accrédités avec frais de déplacement à domicile (`collectionFee`).
  - `laboratoryUsers` : rattachement scopé des biologistes et techniciens à leur laboratoire exclusif (`laboratoryId`).
  - `homeLabRequests` : demandes avec code de suivi convivial (`HL-YYYYMMDD-XXXX`), bénéficiaire, auteur, créneau de visite, ordonnance numérisée et snapshot de tarification cash immuable.
  - `homeLabRequestItems` : analyses multiples groupées dans un prélèvement unique.
  - `homeLabResults` : résultats publiés avec versionnage/amendements non destructeurs (`v1`, `v2`), compte-rendu officiel PDF privé (Convex Storage) et valeurs analytiques structurées.
  - `homeLabAuditEvents` : chaîne de traçabilité opérationnelle immuable de chaque étape.
- **Backend & Logique Métier (`src/convex/homeLab.ts`)** :
  - `initDefaultCatalog` : amorçage automatique du catalogue d'analyses et du laboratoire central partenaire en DEV.
  - `getLabTestCatalog` & `getLaboratoryPartners` : requêtes publiques/authentifiées de consultation.
  - `getMyHomeLabRequests` & `getHomeLabRequestDetails` : accès sécurisé IDOR (Patient, Cercle mandaté, Soignant traitant).
  - `getLaboratoryQueue` : file de travail scopée strictement à l'organisation du laboratoire connecté (aucun accès au répertoire global des patients).
  - `getCollectorQueue` : feuille de route de prélèvement pour le soignant préleveur.
  - `getHomeLabResult` : consultation sécurisée du compte-rendu officiel avec URL signée temporaire pour le PDF privé.
  - `getPatientHomeLabHistory` : passerelle avec le dossier médical patient.
  - `createHomeLabRequest`, `assignCollector`, `startCollection`, `confirmSampleCollected`, `reportCollectionFailure`, `receiveSampleAtLab`, `publishResult`, `cancelHomeLabRequest`, `generateHomeLabUploadUrl`.
- **Interfaces & Expérience Utilisateur (`src/components/homelab/`)** :
  - `CreateHomeLabRequestModal.tsx` : assistant de commande avec sélection multi-analyses, alertes de jeûne, téléversement d'ordonnance obligatoire, choix du créneau et tarification cash transparente.
  - `HomeLabResultModal.tsx` : affichage du compte-rendu officiel, conclusion du biologiste, tableau des paramètres mesurés, téléchargement PDF certifié et passerelle directe avec **MauriCare Relay** pour solliciter un avis spécialisé sur anomalie biologique.
  - `HomeLabManagement.tsx` : espace unifié pour patients et soignants (suivi des prélèvements, missions du préleveur avec validation de prélèvement ou échec motivé, et catalogue complet).
  - `PatientHomeLabCard.tsx` : composant intégré au suivi du patient et à la fiche clinique soignant.
  - `src/pages/Dashboard.tsx` : onglet "HomeLab" dans la barre latérale pour patients et soignants, bouton d'action dans la fiche patient et historique d'analyses dans l'aperçu santé.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : traductions complètes FR/AR/RTL sous le namespace `homelab`.
- **Portes Techniques Légères (Section 53)** :
  - `npx convex dev --once` : OK (24 index créés et fonctions synchronisées en 2.09s).
  - `npx tsc -b --noEmit` : OK (0 erreur TypeScript).
  - `npm run build` : OK (build Vite production en 2.43s).
  - `npx eslint . --quiet` : OK (0 erreur de lint).
  - Aucune suite de test fonctionnel dédiée exécutée (conformément aux consignes).

---

## Détails d'implémentation — Module 8 (MauriCare Chronic)
- **Prévol Sécurité & Dépendances HomeLab (Sections 2 & 3)** :
  - Audit de `src/convex/homeLab.ts` : suppression stricte du repli `BOOK_APPOINTMENTS` pour `createHomeLabRequest`. Seule la permission explicite `MANAGE_HOMELAB` (ou clé legacy `"manage_homelab"`) autorise la commande d'analyses par un membre du Cercle.
  - Clarification contractuelle des tarifs indicatifs (`indicativePrice`) : documentation explicite stipulant que les valeurs dans les fixtures de catalogue sont réservées à l'environnement DEV ; la production s'appuie sur la tarification agréée des laboratoires partenaires.
- **Modèle de Domaine (`docs/CHRONIC_DOMAIN_MODEL.md`)** :
  - Spécification exhaustive du moteur de suivi longitudinal universel (affections chroniques, surveillance post-opératoire, rééducation temporaire, surveillance cardiométabolique et respiratoire).
  - Règle fondamentale "Zéro IA diagnostique" : aucun algorithme n'émet de diagnostic automatique, de prédiction de décompensation ou d'ajustement thérapeutique.
  - Modélisation de la provenance (`patient_manual`, `professional_manual`, `consultation`, `homelab`, `connected_device`) et des seuils d'attention calme et non-alarmiste ("Cette mesure mérite l'attention de votre soignant traitant").
  - Modélisation conjointe de la pression artérielle (SYS/DIA) et des constantes associées.
- **Schéma Convex (`src/convex/schema.ts`)** :
  - `conditionCatalog` : catalogue canonique de pathologies et situations cliniques avec index `by_code`, `by_category`.
  - `patientConditions` : rattachement d'une condition à un patient (`clinical_confirmed` ou `self_monitoring`), statut actif/résolu/suspendu.
  - `monitoringPrograms` : protocoles de suivi structurés avec fréquence, dates de validité et mesures requises.
  - `measurementDefinitions` : définitions des métriques avec bornes de plausibilité physiologique, unités et indicateurs de valeurs conjointes (`isPaired`).
  - `healthObservations` : séries temporelles immuables de constantes avec horodatage réel de prise (`observedAt`), contexte (`fasting`, `resting`, etc.), statut de validité (`active`, `corrected`, `superseded`) et drapeaux d'attention médicale non-alarmistes.
  - `monitoringRules` : règles de vigilance configurables pour orienter le patient vers son praticien.
  - `monitoringAuditEvents` : registre immuable de traçabilité des enregistrements et corrections de mesures.
- **Backend & Logique Métier (`src/convex/chronic.ts`)** :
  - `initChronicCatalog` : amorçage des conditions et métriques standards en DEV.
  - `getConditionCatalog` & `getMeasurementDefinitions` : requêtes de consultation du catalogue.
  - `getPatientConditions` & `getMonitoringPrograms` : protocoles de soins scopés par patient avec fallback authentifié.
  - `getHealthObservations` : séries temporelles filtrées avec calcul de statistiques mathématiques factuelles (min, max, moyenne, dernière valeur, tendance).
  - `getAllPatientObservations` : historique chronologique complet avec filtres par métrique et recherche.
  - `getPatientChronicSummary` : vue synthétique unifiée avec synchronisation transparente et idempotente des `patientVitals` historiques de consultations et des `homeLabResults` publiés (`syncConsultationVitalsIdempotent`, `syncHomeLabResultsIdempotent`).
  - `getObservationsForRelay` : passerelle de collaboration confraternelle avec sélection de constantes pour avis médical spécialisé.
  - `getProfessionalMonitoredPatients` : file active des patients sous surveillance pour le soignant traitant.
  - `recordObservation` : enregistrement sécurisé avec vérification de plausibilité physiologique, détection d'attention et notification apaisée.
  - `createMonitoringProgram`, `assignPatientCondition`, `updateProgramStatus`.
  - `correctObservation` : correction transparente de saisie erronée avec justification obligatoire et conservation de la piste d'audit.
- **Interfaces & Expérience Utilisateur (`src/components/chronic/`)** :
  - `RecordMeasurementModal.tsx` : saisie ergonomique multi-métriques (tension SYS/DIA + pouls conjoint, glycémie avec contexte à jeun/repas, poids, SpO2, température, symptômes), alertes de plausibilité en direct et rappel non-diagnostique.
  - `RecordCorrectionModal.tsx` : modal de correction avec motif obligatoire et archivage d'audit.
  - `HealthChartsView.tsx` : graphiques interactifs temporels Recharts (7j, 30j, 3m, 6m, tout), tracé conjoint tensionnel systolique/diastolique avec lignes guides normales, cartes statistiques (moyenne, min/max, tendance) et infobulle détaillée.
  - `RelayShareModal.tsx` : sélection ciblée de constantes et transmission directe pour sollicitation d'avis médical dans MauriCare Relay.
  - `CreateProgramModal.tsx` : création de programmes personnalisés de suivi longitudinal.
  - `ChronicManagement.tsx` : tableau de bord central (onglet graphiques, historique complet avec export CSV client-side, programmes de soins, et vue de surveillance des patients pour les praticiens).
  - `PatientChronicTimelineCard.tsx` : carte compacte intégrée dans l'aperçu santé patient (`ApercuPatient`) et dans la fiche clinique détaillée (`PatientDetailsSection`).
  - `src/pages/Dashboard.tsx` : navigation "Suivi Santé" / "Suivi Constantes" intégrée pour patients et praticiens avec affichage de la section `chronic`.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : traductions bilingues complètes FR/AR/RTL sous le namespace `chronic`.
- **Portes Techniques Légères (Section 57)** :
  - `npx convex dev --once` : OK (fonctions et 20 index prêts en 2.33s).
  - `npx tsc -b --noEmit` : OK (0 erreur TypeScript).
  - `npm run build` : OK (build Vite production en 2.79s).
  - `npx eslint . --quiet` : OK (0 erreur de lint).
  - Aucune suite de test fonctionnel dédiée exécutée (conformément aux consignes).

---

## Détails d'implémentation — Module 9 (MauriCare Voice AI)
- **Audit Prévol Chronic (Section 2)** :
  - Audit de `HealthChartsView.tsx` et `chronic.ts` : suppression stricte des lignes de repères physiologiques hardcodées en dur sans source validée.
  - Séparation explicite entre :
    - *Bornes de plausibilité technique* (`minPlausible`, `maxPlausible` de `measurementDefinitions`) : rejet d'entrées techniquement corrompues ou impossibles.
    - *Seuils d'attention clinique* : liaison contractuelle aux règles validées de la table `monitoringRules` ou aux référentiels OMS/ESC/ADA formellement sourcés.
- **Audit des Fournisseurs d'IA (`docs/VOICE_AI_ARCHITECTURE.md`)** :
  - Spécification complète du pipeline d'orchestration sans accès direct en écriture à la base de données.
  - Abstraction des fournisseurs : `SpeechToTextProvider` (`WebSpeechSTTProvider`), `IntentProvider` (moteur hybride déterministe / LLM), `TextToSpeechProvider` (`WebSpeechTTSProvider`).
  - Règle « Zéro IA Diagnostique » : interdiction absolue de formuler des diagnostics, d'interpréter des résultats de laboratoire ou de prescrire des traitements.
- **Sécurité & Confidentialité des Données Vocales** :
  - Aucun stockage audio permanent sur les serveurs : traitement éphémère en flux direct côté client.
  - Secrets IA conservés exclusivement sur le serveur, sans exposition dans le bundle Vite frontend.
  - Résistance native aux injections de prompt (`PROMPT_INJECTION_PATTERNS`) et détection des sollicitations médicales illégitimes (`MEDICAL_DIAGNOSIS_PATTERNS`) avec orientation vers un soignant.
- **Schéma Convex (`src/convex/schema.ts`)** :
  - `assistantInteractions` : métadonnées d'interactions (mode voix/texte, langue, intent, statut opérationnel) sans rétention de dossiers médicaux complets (index `by_user`, `by_created`).
  - `assistantActionAudit` : registre d'audit immuable des actions concrètes déclenchées via l'assistant après confirmation explicite (index `by_user`, `by_intent`).
- **Backend d'Orchestration (`src/convex/voiceAssistant.ts`)** :
  - Allowlist d'intentions canoniques : `BOOK_APPOINTMENT`, `VIEW_UPCOMING_APPOINTMENTS`, `CANCEL_APPOINTMENT`, `VIEW_HOMELAB_STATUS`, `VIEW_HOMELAB_RESULT`, `CREATE_HOMELAB_REQUEST`, `RECORD_HEALTH_MEASUREMENT`, `VIEW_HEALTH_TREND`, `VIEW_CHRONIC_PROGRAM`, `CREATE_RELAY_REQUEST`, `SEND_MESSAGE`, `MEDICAL_INQUIRY_BLOCKED`, `UNKNOWN_INTENT`.
  - Contrôle strict des habilitations déléguées : vérification de `BOOK_APPOINTMENTS` pour le Cercle, exigence absolue de `MANAGE_HOMELAB` pour la commande de prélèvements, contrôle de relation de soin pour Relay.
  - `processAssistantCommand` : extraction d'intention, préparation de la carte de prévisualisation et génération du payload d'action.
  - `executeConfirmedAssistantAction` : exécution sécurisée via les fonctions des Modules 4, 5, 6, 7 et 8 uniquement après validation par l'utilisateur.
  - `getAssistantSuggestions` & `getAssistantAuditHistory` : requêtes de contexte et d'historique.
- **Interfaces & Expérience Utilisateur (`src/components/voice/`)** :
  - `SpeechToTextProvider.ts` & `TextToSpeechProvider.ts` : abstractions client Web Speech avec support FR/AR et arrêt d'urgence.
  - `ActionConfirmationCard.tsx` : carte structurée claire avec détails complets (bénéficiaire, soin, créneau, tarif indicatif) et trois boutons explicites : `[ Confirmer et Exécuter ]`, `[ Modifier ]`, `[ Annuler ]`.
  - `VoiceAssistantModal.tsx` : interface modale conversationnelle bilingue FR/AR (RTL natif), bouton micro avec onde sonore animée, zone de transcription modifiable, saisie texte en repli permanent, toggle de synthèse vocale et suggestions rapides.
  - `VoiceAssistantFloatingButton.tsx` : bouton d'accès rapide flottant intégré dans le Dashboard MauriCare sans perturber la navigation standard.
  - `src/locales/fr/translation.json` & `src/locales/ar/translation.json` : traductions complètes FR/AR/RTL sous le namespace `voice_ai`.
- **Portes Techniques Légères (Section 59)** :
  - `npx convex dev --once` : OK (fonctions et 4 index prêts en 2.36s).
  - `npx tsc -b --noEmit` : OK (0 erreur TypeScript).
  - `npm run build` : OK (build Vite production en 2.80s).
  - `npx eslint . --quiet` : OK (0 erreur de lint).
  - Aucune suite de test fonctionnel dédiée exécutée (conformément aux consignes).

---

## Détails d'implémentation — Module 10 (Convergence, Hardening & QA Globale)
- **Portes de Prévol Réglementaires & Architecturales** :
  - *Prévol A (Déclaration de Confidentialité Vocale)* : alignement strict de la documentation (`docs/VOICE_AI_ARCHITECTURE.md`), du provider (`SpeechToTextProvider.ts`) et de l'UI (`VoiceAssistantModal.tsx`, traductions FR/AR). Clarification transparente : aucun stockage audio sur les serveurs MauriCare, dépendance du flux Web Speech au moteur du navigateur, repli textuel symétrique garanti.
  - *Prévol B (Gouvernance des Seuils Cliniques Chronic)* : suppression dans `src/convex/chronic.ts` et `HealthChartsView.tsx` des seuils arbitraires en dur. Règle absolue formalisée : aucune règle active dans `monitoringRules` = aucune conclusion d'alerte clinique arbitraire.
  - Rédaction de `docs/CLINICAL_RULE_GOVERNANCE.md` (découplage bornes techniques vs protocoles cliniques sourcés).
- **Matrice Canonique des Permissions & Habilitations (`docs/PERMISSION_MATRIX.md`)** :
  - Spécification exhaustive des droits d'accès par rôle (Patient, Pro approuvé, Pro en attente, Pro rejeté/désactivé, Admin, Membre du Cercle, Labo/Préleveur, Voice AI) sur l'ensemble des entités (Rendez-vous, Profils, Dossier médical, Documents, Relay, HomeLab, Chronic, Audit).
- **Plan de Migration & Rollback Phase 2 (`docs/PHASE2_MIGRATION_PLAN.md`)** :
  - Procédure de déploiement zéro-downtime, compatibilité ascendante des données legacy (Module 1 à 9), runbook de rollback en 4 étapes sans perte d'intégrité.
- **Suite de Régression Globale Phase 2 (`src/convex/test_phase2_global.ts`)** :
  - 18 tests automatisés couvrant les Modules 1 à 9 et les scénarios transversaux A, C, D, G.
  - Total des suites exécutées : 70 tests automatisés avec **100% de succès**.
- **Livrables QA & Recette Humaine** :
  - `docs/PHASE2_AUTOMATED_QA_REPORT.md` : rapport officiel de régression automatisée (100% PASS).
  - `docs/PHASE2_MANUAL_QA.md` : cahier de recette humaine complet destiné au Product Owner (marqué `HUMAN QA NOT EXECUTED — PROJECT OWNER ONLY`, zéro tâche Browser exécutée).
- **Validation des 5 Portes Techniques (Section 38)** :
  - `npx convex dev --once` : OK (code 0).
  - `npx tsc -b --noEmit` : OK (code 0, 0 erreur TypeScript).
  - `npm run build` : OK (code 0, build Vite production en 2.75s).
  - `npx eslint . --quiet` : OK (code 0, 0 warning/erreur).
  - `git diff --check` : OK (code 0, 0 conflit d'espace/whitespace).
