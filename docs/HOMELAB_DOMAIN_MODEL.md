# MAURICARE HOMELAB — DOMAIN MODEL & LABORATORY GOVERNANCE

## 1. Vision & Architecture Overview

MauriCare HomeLab est le module d'organisation et de coordination des prélèvements biologiques à domicile et de mise à disposition sécurisée des résultats d'analyses médicales.

### Principes Fondamentaux :
1. **MauriCare n'est pas un laboratoire d'analyses médicales** : MauriCare est une plateforme technologique d'orchestration logistique et de santé qui connecte les patients, les soignants préleveurs qualifiés et les laboratoires partenaires accrédités.
2. **Zéro diagnostic médical par IA** : La plateforme n'interprète jamais de manière algorithmique les résultats d'analyses et ne pose aucun diagnostic automatisé. L'interprétation clinique relève exclusivement du biologiste médical et du médecin traitant.
3. **Immutabilité et traçabilité des résultats** : Tout résultat publié par un laboratoire partenaire est consigné de manière non destructrice. Toute correction typographique ou biologique ultérieure crée une version amendée traçable (`v2`, `v3`) avec motif obligatoire et conservation de l'antériorité.
4. **Contrôle d'accès et séparation des rôles** : Les utilisateurs d'un laboratoire partenaire sont cantonnés à leur propre structure (`laboratoryId`). Ils ne disposent d'aucun accès de recherche globale sur le répertoire des patients ni aux dossiers médicaux non liés à leurs analyses.
5. **Intégration mesurée au Cercle de proches (Module 5)** : Le Cercle de proches ne peut consulter que les statuts de suivi (`VIEW_HOMELAB_STATUS`) et, uniquement en cas de mandat explicite du patient, les résultats de santé autorisés (`VIEW_SELECTED_HEALTH_DATA`). Aucun droit générique `view_medical` n'est toléré.

---

## 2. Cycle de Vie Canonique d'une Demande HomeLab

```
  [requested] 
     │
     ▼
 [validated] 
     │
     ▼
 [scheduled] ──► [collector_assigned] ──► [collection_in_progress]
                                                    │
                   ┌────────────────────────────────┴────────────────┐
                   ▼                                                 ▼
          [collection_failed]                               [sample_collected]
                                                                     │
                                                                     ▼
                                                                [in_transit]
                                                                     │
                                                                     ▼
                                                             [received_by_lab]
                                                                     │
                                                                     ▼
                                                                [processing]
                                                                     │
                                                                     ▼
                                                             [result_available]
                                                                     │
                                                                     ▼
                                                                [completed]
```

### États terminaux ou d'exception :
- `cancelled` : Annulation par le patient avant la collecte.
- `rejected` : Demande rejetée par le laboratoire (ordonnance manquante, non faisabilité technique).
- `collection_failed` : Échec de prélèvement (patient absent, non-respect du jeûne, veine inaccessible).

---

## 3. Matrice de Permissions & Rôles

| Opération | Patient | Membre Cercle (`MANAGE_HOMELAB`) | Soignant Traitant | Préleveur Assigné | Laboratoire Partenaire | Administrateur |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| **Commander une analyse** | ✅ | ✅ | ✅ (Pour son patient) | ❌ | ❌ | ❌ |
| **Voir statut de logistique** | ✅ | ✅ (`VIEW_HOMELAB_STATUS`) | ✅ | ✅ | ✅ (Ses demandes) | ✅ |
| **Voir fiche prélèvement** | ✅ | ❌ | ✅ | ✅ (Adresse/heure) | ✅ | ❌ |
| **Enregistrer prélèvement** | ❌ | ❌ | ❌ | ✅ | ❌ | ❌ |
| **Déclarer réception labo** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Brouillonner un résultat**| ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Publier le résultat** | ❌ | ❌ | ❌ | ❌ | ✅ | ❌ |
| **Télécharger le résultat** | ✅ | ✅ (`VIEW_SELECTED_HEALTH_DATA`)| ✅ (Relation active) | ❌ | ✅ | ❌ |
| **Amender un résultat** | ❌ | ❌ | ❌ | ❌ | ✅ (Biologiste) | ❌ |

---

## 4. Catalogue des Analyses Médicales (`labTestCatalog`)

Le catalogue structure les analyses courantes sans hardcoder de données médicales dans les composants graphiques :
- **Hématologie** : NFS / Numération Formule Sanguine (`nfs`).
- **Biochimie & Métabolisme** : Glycémie à jeun (`glycemia`), Créatinine sérique (`creatinine`), Urée (`urea`), Hémoglobine glyquée HbA1c (`hba1c`).
- **Profil Lipidique** : Cholestérol total, HDL, LDL, Triglycérides (`lipid_profile`).
- **Inflammation & Foie** : CRP quantitative (`crp`), Transaminases ASAT/ALAT (`transaminases`).
- **Urines** : ECBU / Examen Cyto-Bactériologique des Urines (`urine_ecbu`).

Chaque analyse spécifie :
- Type de prélèvement (sang veineux, urines, etc.) ;
- Exigence de jeûne (`fastingRequired`) ;
- Exigence de prescription médicale obligatoire (`prescriptionRequired`) ;
- Instructions de préparation patient (FR/AR) ;
- Tarif indicatif en Ouguiya (MRU).

---

## 5. Prévention IDOR & Sécurité des Données Sensibles

1. **Vérification d'appartenance laboratoire** : Toute écriture ou publication d'un résultat vérifie côté serveur que `userId` est un membre actif de `laboratoryPartners` assigné à la demande.
2. **Stockage privé des résultats (Convex Storage)** : Les documents de laboratoire (PDF, images scannées) ne disposent d'aucune URL publique. Seuls des liens temporaires signés sont délivrés après contrôle strict de la relation de soin ou de l'autorisation patient/cercle.
3. **Gel de tarification (Snapshotting)** : Le montant total (`collectionFee + analysesAmount`) est immuablement enregistré au moment de la confirmation de la commande. Les évolutions ultérieures du catalogue ne modifient pas l'historique de paiement.
4. **Zéro fuite d'informations médicales dans les notifications** : Les alertes SMS, e-mail et notifications in-app indiquent uniquement la disponibilité des résultats (`"Vos résultats HomeLab sont disponibles"`), sans jamais divulguer de valeur biologique ou de suspicion diagnostique en clair.

---

## 6. Passerelle avec MauriCare Relay (Module 6)

Un soignant ayant accès à un résultat publié dans le cadre d'une relation de soin active peut initier une demande **MauriCare Relay** pour solliciter un confrère spécialiste (ex: diabétologue après découverte d'une HbA1c élevée). La demande Relay référence `homeLabResultId` sans dupliquer l'intégralité du dossier.
