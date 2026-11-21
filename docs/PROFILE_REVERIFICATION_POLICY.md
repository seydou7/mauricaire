# Politique de Re-Vérification et de Gouvernance des Profils Soignants MauriCare

**Date d'entrée en vigueur :** Phase 2 — Module 3  
**Statut :** Officiel & Approuvé  
**Projet :** MauriCare Health Platform (Nouakchott, Mauritanie)

---

## 1. Contexte & Enjeux Médicaux
La confiance des patients et des autorités sanitaires mauritaniennes repose sur l'exactitude certifiée des qualifications de chaque praticien répertorié sur MauriCare. Lorsqu'un professionnel de santé a été dûment validé par l'équipe de régulation médicale (statut `approved`, `verified: true`), toute modification ultérieure apportée à ses qualifications fondamentales ne doit pas compromettre l'intégrité du système de santé.

Cette politique définit précisément les critères de classification des modifications, les mécanismes de re-vérification administrative et les règles de maintien de service.

---

## 2. Classification des Champs du Profil Professionnel

### A. Champs Sensibles (Déclencheurs d'un Réexamen Administratif)
Les modifications suivantes touchent directement à la légalité de l'exercice médical et nécessitent **une re-vérification administrative** :

1. **Spécialité Médicale (`specialty`)** :
   - Ex: Un soignant passant d'Infirmier à Médecin Généraliste ou Cardiologue.
   - Impact : Risque majeur de pratique illégale ou de tromperie médicale si non certifié.
2. **Numéro d'Exercice ou de Licence (`licenseNumber`)** :
   - N° d'inscription à l'Ordre National des Médecins ou Infirmiers.
   - Impact : Nécessite une nouvelle confirmation auprès des registres officiels.
3. **Pièce d'Identité Officielle (`identityDocument`)** :
   - Remplacement de la CNI mauritanienne ou du passeport déposé.
4. **Justificatif Professionnel ou Diplôme d'État (`professionalProof`)** :
   - Téléversement d'un nouveau diplôme ou d'une nouvelle attestation d'agrément.
5. **Nom Légal de l'Utilisateur (`name` / `firstName` / `lastName`)** :
   - Modification de l'identité civile liée au profil d'exercice.

---

### B. Champs Non Sensibles (Mise à Jour Libre et Immédiate)
Les modifications suivantes ne modifient pas la légalité de l'accréditation et peuvent être mises à jour immédiatement par le praticien **sans déclencher de réexamen administratif** :

1. **Biographie & Présentation (`bio`)** : Présentation du parcours, approche de la relation patient.
2. **Numéro de Téléphone de Contact (`phone`)** : Ligne directe pour les coordinations de soins.
3. **Photo de Profil (`avatar` / `image`)** : Photo professionnelle de présentation.
4. **Zones d'Intervention (`interventionZones`)** : Moughataas couvertes (ex: Tevragh Zeina, Ksar, Toujounine).
5. **Tarif Indicatif de Consultation (`consultationFee`)** : Montant en Ouguiyas (MRU) pour les actes à domicile ou en cabinet.
6. **Langues Parlées (`languages`)** : Français, Arabe standard, Hassaniya, Pulaar, Soninké, Wolof.

---

## 3. Règle de Continuité de Service & Re-Vérification

### Principe de Proportionnalité :
Un praticien déjà en exercice ne doit pas voir son activité brutalement suspendue pour une mise à jour administrative mineure, tout en garantissant la sécurité des patients.

### Procédure Opérationnelle :
1. **Notification Préalable** :
   - Avant validation d'une modification sensible, l'interface affiche un avertissement clair informant le praticien qu'une revue administrative sera nécessaire.
2. **Marquage dans le Système** :
   - Le profil soignant passe au statut `onboardingStatus: "under_review"` avec le drapeau `reverificationRequired: true`.
   - L'événement de sécurité `sensitive_profile_updated` est inscrit dans la table immuable `securityEvents`.
   - Une entrée explicite est ajoutée dans `verificationHistory` détaillant les champs modifiés et l'horodatage.
3. **Maintien de la Visibilité Publique Temporaire** :
   - Le praticien demeure réservable sous ses anciennes données certifiées jusqu'à la décision de l'administrateur, SAUF si le numéro d'exercice ou la spécialité a été modifié en contradiction avec les pièces fournies (dans ce cas, l'administrateur peut révoquer immédiatement la visibilité).
4. **Décision Administrative** :
   - L'administration MauriCare dispose d'un délai contractuel de 24 à 48h ouvrées pour :
     - **Approuver** : Les nouvelles données deviennent canoniques, `reverificationRequired` repasse à `false`, `onboardingStatus` revient à `approved`.
     - **Demander un complément** : Retour à `complement_required` avec motifs et consignes précises.
     - **Refuser** : Annulation des modifications sensibles et notification motivée.

---

## 4. Traçabilité & Piste d'Audit Médicale
Chaque modification sensible est consignée de manière inaltérable :
- Identifiant unique de l'utilisateur (`userId`).
- Date et heure exacte (UTC timestamp).
- Ancienne et nouvelle valeur des champs sensibles.
- Décision finale de l'administrateur et identifiant de l'instructeur.
