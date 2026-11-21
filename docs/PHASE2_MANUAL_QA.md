# MAURICARE — PHASE 2 MANUAL QA RECETTE & ACCEPTANCE NOTEBOOK
# STATUT : HUMAN QA NOT EXECUTED — PROJECT OWNER ONLY

> [!IMPORTANT]
> **Ce document est le cahier de recette humaine destiné exclusivement au Product Owner (PO) / Client.**  
> L'agent d'ingénierie a validé l'intégralité de la suite automatisée (70 tests, 100% PASS), mais **N'A EXÉCUTÉ AUCUN TEST HUMAIN**.  
> Aucun composant d'automatisation de navigateur (Browser Task / Puppeteer) n'a été utilisé pour simuler l'intervention humaine.

---

## 1. ENVIRONNEMENT DE TEST LOCAL & IDENTIFIANTS DE TEST QA

- **URL Frontend Local** : `http://localhost:5173` (ou port Vite actif)
- **Backend Convex Local** : `http://127.0.0.1:3210` (`local:local-babaousmanehawoly-mauricaire`)
- **Mode OTP Déterministe** : Activé via `DEV_AUTH=true` dans l'environnement local.

### Identifiants Pré-configurés pour la Recette

| Rôle / Persona | Email de Connexion | OTP Déterministe | Objectif de Recette |
| :--- | :--- | :---: | :--- |
| **Patient** | `qa.patient@mauricaire.local` | `111111` | Réservation, Cercle, HomeLab, Constantes Chronic, Voice AI |
| **Soignant Agréé (Infirmier)** | `qa.infirmier@mauricaire.local` | `222222` | Consultation, Rapport de soin, Prélèvement HomeLab, Relay |
| **Soignant Agréé (Médecin)** | `qa.medecin@mauricaire.local` | `333333` | Réception demande Relay, Avis d'expertise, Collaboration |
| **Administrateur** | `qa.admin@mauricaire.local` | `444444` | Validation des soignants, Audit trail, Supervision |
| **Soignant en attente** | `qa.pending.professionnel@mauricaire.local` | `555555` | Parcours onboarding, téléversement CNI/Diplôme, vérification |
| **Membre du Cercle** | `qa.daughter@mauricaire.local` | `111111` | Acceptation invitation, réservation déléguée, consultation autorisée |

---

## 2. CAHIER DE RECETTE PAR PERSONA (CHECKLIST PAS-À-PAS)

### PERSONA 1 : PATIENT (`qa.patient@mauricaire.local`)
- [ ] **1.1 Authentification Réelle** : Connexion par mot de passe ou saisie OTP `111111`. Vérifier l'arrivée sur le dashboard patient.
- [ ] **1.2 Profil & Contact d'Urgence** : Accéder à `/profile`. Ajouter/modifier un contact d'urgence primaire. Vérifier la sauvegarde immédiate.
- [ ] **1.3 Réservation de Soin** : Trouver l'Infirmier QA, choisir une prestation (ex: Pansement complexe), sélectionner un créneau horaire. Vérifier l'affichage du tarif en MRU (snapshot immuable).
- [ ] **1.4 Constantes Chronic** : Accéder à `/chronic`. Enregistrer une tension artérielle (ex: 120/80 mmHg). Vérifier l'affichage graphique longitudinal.
- [ ] **1.5 Voice Assistant Modal** : Ouvrir l'assistant vocal. Dicter ou taper : *"Je veux un infirmier demain matin pour un pansement"*. Vérifier l'extraction de l'intention et le modal de confirmation explicite avant action.
- [ ] **1.6 Bouclier Zéro IA Diagnostique** : Taper ou dire : *"J'ai la tête qui tourne et 18 de tension, quel médicament prendre ?"*. Vérifier le message d'interception orientant immédiatement vers les urgences ou un médecin.

### PERSONA 2 : SOIGNANT EN ONBOARDING (`qa.pending.professionnel@mauricaire.local`)
- [ ] **2.1 Soumission du Dossier** : Accéder à l'onboarding professionnel. Téléverser une pièce d'identité (CNI/Passeport) et un justificatif professionnel (diplôme).
- [ ] **2.2 État En Attente** : Vérifier que le statut affiché est *"En attente de vérification"*.
- [ ] **2.3 Cloisonnement Annuaire** : Se déconnecter et naviguer sur l'annuaire public. Vérifier que ce praticien **n'apparaît pas** dans l'annuaire des soignants disponibles.

### PERSONA 3 : ADMINISTRATEUR MAURICARE (`qa.admin@mauricaire.local`)
- [ ] **3.1 Portail Admin** : Connexion avec OTP `444444`. Accéder à `/admin/providers`.
- [ ] **3.2 Examen des Pièces** : Ouvrir le dossier du soignant en attente. Visualiser les justificatifs téléversés.
- [ ] **3.3 Approbation** : Cliquer sur *"Approuver le soignant"*. Vérifier la mise à jour immédiate du statut en *"approved"*.
- [ ] **3.4 Audit Trail** : Vérifier l'inscription de l'événement dans le registre d'audit des vérifications avec horodatage et ID admin.

### PERSONA 4 : COORDINATION FAMILIALE — MAURICARE CIRCLE
- [ ] **4.1 Invitation par le Patient** : Connecté en tant que Patient, inviter `qa.daughter@mauricaire.local` avec le rôle *"Fille"* et les permissions *Réservation* et *HomeLab*.
- [ ] **4.2 Acceptation par le Proche** : Connecté en tant que `qa.daughter@mauricaire.local`, accepter l'invitation via le lien ou la notification.
- [ ] **4.3 Réservation Déléguée** : Réserver un créneau pour le patient parent. Vérifier que `beneficiaryId` pointe vers le patient et `bookedByUserId` vers la fille.
- [ ] **4.4 Étanchéité Dossier Médical** : Vérifier que le membre du Cercle **n'a pas accès** aux notes cliniques confidentielles du médecin.

### PERSONA 5 : COLLABORATION CLINIQUE — MAURICARE RELAY
- [ ] **5.1 Initiation par l'Infirmier** : Connecté en tant qu'Infirmier, ouvrir la fiche de suivi du patient et cliquer sur *"Demander un avis médical (Relay)"*.
- [ ] **5.2 Sélection du Spécialiste** : Sélectionner le Médecin QA (`qa.medecin@mauricaire.local`), indiquer le motif et attacher les constantes du jour.
- [ ] **5.3 Réception & Réponse Médicale** : Connecté en tant que Médecin QA, ouvrir la demande Relay reçue, saisir l'avis clinique et les recommandations.
- [ ] **5.4 Clôture & Résumé Patient** : Vérifier que l'avis est partagé avec l'infirmier, et qu'un résumé vulgarisé et rassurant est mis à disposition du patient.

### PERSONA 6 : PRÉLÈVEMENTS À DOMICILE — MAURICARE HOMELAB
- [ ] **6.1 Demande de Prélèvement** : Commander un bilan sanguin à domicile pour le patient.
- [ ] **6.2 Attribution du Code** : Vérifier la génération du code de suivi au format `HL-YYYY-XXXX`.
- [ ] **6.3 Prise en Charge Préleveur** : Connecté en soignant préleveur, scanner ou saisir le code `HL-`, valider l'acheminement au laboratoire partenaire.
- [ ] **6.4 Intégration des Résultats** : Consulter les résultats validés. Vérifier la synchronisation automatique dans l'historique des analyses du patient.

---

## 3. SCÉNARIOS CROISÉS TRANSVERSAUX (A À G)

- [ ] **Scénario A (Parcours Patient Complet)** : De l'inscription à la fin de consultation avec paiement cash et rapport.
- [ ] **Scénario B (Cycle de Vie Professionnel)** : Inscription pro -> Dépôt documents -> Validation admin -> Configuration tarifs -> Première prestation.
- [ ] **Scénario C (Coordination Familiale)** : Mandat du cercle -> Réservation par la fille à distance -> Suivi des étapes du soin.
- [ ] **Scénario D (Télé-expertise Relay)** : Découverte anomalie tensionnelle par infirmier -> Demande Relay -> Avis médecin en 2h.
- [ ] **Scénario E (HomeLab Complet)** : Demande prélèvement -> Collecte domicile -> Transmission labo -> Résultat sécurisé.
- [ ] **Scénario F (Surveillance Pathologie Chronique)** : Relevés tensionnels quotidiens -> Détection tendance -> Consultation de contrôle.
- [ ] **Scénario G (Orchestration Voice AI)** : Commande vocale en arabe/français -> Confirmation -> Déclenchement transparent.

---

## 4. SIGN-OFF & ACCEPTATION FINALE DU PROJECT OWNER

| Rôle | Nom du Signataire | Date | Décision (ACCEPTÉ / RÉSERVES) |
| :--- | :--- | :---: | :---: |
| **Product Owner** | ____________________ | ___/___/2026 | `[ ] ACCEPTÉ  [ ] AVEC RÉSERVES` |
| **Lead Tech Client** | ____________________ | ___/___/2026 | `[ ] ACCEPTÉ  [ ] AVEC RÉSERVES` |

*Signature :* ___________________________________
