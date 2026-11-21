# MauriCare — Plan de Migration & Transition Phase 2

## 1. Contexte & Périmètre de Transition
Ce plan détaille la procédure de déploiement et de compatibilité ascendante pour l'introduction de la **Phase 2** (Modules 1 à 9) sur l'infrastructure MauriCare.

> [!CAUTION]
> **Rappel Impératif de Sécurité**
> Aucune étape de ce plan ne doit être exécutée sur l'environnement client UAT (`colorless-kookabura-292`) durant la présente tâche. Ce document constitue le référentiel d'ingénierie pour la future mise en production.

---

## 2. Inventaire des Évolutions de Schéma

### Nouvelles Tables Créées (18 tables)
1. `verificationTokens` (OTP, validation email, réinitialisation mot de passe, changement d'email).
2. `securityEvents` (Journal d'audit de sécurité des sessions et comptes).
3. `emergencyContacts` (Contacts d'urgence des patients).
4. `providerDocuments` (Pièces justificatives chiffrées des praticiens).
5. `verificationHistory` (Historique chronologique des décisions d'accréditation).
6. `providerServices` (Prestations et tarifications configurées par chaque soignant).
7. `providerWeeklySchedules` (Horaires hebdomadaires récurrents).
8. `providerScheduleExceptions` (Congés, gardes, fermetures exceptionnelles).
9. `recurrenceSeries` (Séries de soins récurrents).
10. `circleMembers` (Membres du cercle de proches et habilitations granulaires).
11. `circleInvitations` (Invitations sécurisées avec jeton à usage unique).
12. `relayRequests` (Dossiers de collaboration et télé-expertise confraternelle).
13. `relayMessages` (Échanges cliniques sécurisés inter-professionnels).
14. `homeLabRequests` (Demandes de bilans et prélèvements à domicile).
15. `homeLabResults` (Comptes-rendus d'analyses biologiques et versions officielles).
16. `laboratoryPartners` & `laboratoryUsers` (Laboratoires d'analyses partenaires accrédités).
17. `conditionCatalog`, `patientConditions`, `monitoringPrograms`, `measurementDefinitions`, `healthObservations`, `monitoringRules`, `monitoringAuditEvents` (Moteur de suivi longitudinal Chronic).
18. `assistantInteractions`, `assistantActionAudit` (Orchestration conversationnelle Voice AI).

### Tables Enrichies & Rétrocompatibilité
- `users` : Nouveaux champs tous optionnels (`firstName`, `neighborhood`, `deactivatedAt`, `avatarStorageId`).
- `providers` : Nouveaux champs tous optionnels (`onboardingStatus`, `reverificationRequired`, `identityCardStorageId`, `licenseStorageId`, `diplomaStorageId`).
- `appointments` : Nouveaux champs tous optionnels (`beneficiaryId`, `bookedByUserId`, `serviceSnapshot`, `recurrenceSeriesId`, `occurrenceIndex`).

---

## 3. Stratégie de Tolérance aux Données Anciennes (Zero-Downtime)

1. **Tolérance aux valeurs null/undefined** :
   - Tout composant frontend et toute requête backend applique un repli strict (ex: `user.name || "Utilisateur"`, `appointment.status || "en_attente"`).
   - Les rendez-vous du MVP initial ne comportant pas de `serviceSnapshot` continuent de s'afficher sans erreur grâce à un snapshot déduit à la volée.
2. **Absence de modifications destructives** :
   - Aucun renommage destructif de colonne existante.
   - Les tables historiques (`users`, `appointments`, `providers`, `messages`, `reviews`) conservent leur intégrité sans altération de leurs clés primaires (`_id`).

---

## 4. Protocole d'Exécution lors du Déploiement Futur (Runbook)

### Phase A : Sauvegarde & Pré-requis
1. **Instantané immuable de la base de données** :
   - Export complet Convex de l'environnement cible avant toute opération (`npx convex export`).
   - Vérification de l'intégrité de l'archive de sauvegarde.
2. **Gel temporaire des écritures** :
   - Déploiement d'une page de maintenance ou suspension momentanée des mutations publiques.

### Phase B : Déploiement Schéma & Backend
1. Déploiement des fonctions et schémas Convex : `npx convex deploy`.
2. Convex applique automatiquement l'Expand des schémas et l'indexation sans blocage.
3. Exécution du script idempotent d'initialisation des catalogues :
   - `initDefaultCatalog` (HomeLab)
   - `initChronicCatalog` (Chronic)

### Phase C : Déploiement Frontend
1. Déploiement du bundle de production Vercel/Vite compilé.
2. Purge du cache CDN des assets statiques.
3. Vérification des probes de santé applicative (`/health` ou endpoint de ping).

### Phase D : Plan de Retour Arrière (Rollback)
- En cas d'anomalie bloquante constatée :
  1. Restauration de la version précédente du frontend sur Vercel (instantané en 1 clic).
  2. Rétablissement de la version antérieure des fonctions Convex via `convex deploy` sur le commit précédent.
  3. Si corruption de données : restauration de l'instantané de sauvegarde exporté en Phase A.
