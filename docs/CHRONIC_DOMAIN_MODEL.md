# MAURICARE CHRONIC — DOMAIN MODEL & LONGITUDINAL HEALTH ENGINE

## 1. Vision & Architecture Overview

MauriCare Chronic est le moteur de suivi longitudinal de santé de la plateforme MauriCare.

### Principes Fondamentaux :
1. **Périmètre étendu au-delà des maladies chroniques traditionnelles** : MauriCare Chronic n'est pas restreint au diabète ou à l'hypertension. Il s'agit d'un moteur universel de suivi longitudinal prenant en charge :
   - Pathologies chroniques (Hypertension, Diabète de type 1 et 2, Insuffisance cardiaque, Asthme, BPCO, Insuffisance rénale) ;
   - Protocoles de suivi post-opératoire (surveillance thermique, score algique, cicatrisation) ;
   - Protocoles temporaires de réhabilitation et de convalescence ;
   - Suivi cardiométabolique, pondéral et respiratoire.
2. **Zéro diagnostic médical par IA** : La plateforme ne pose aucun diagnostic, n'interprète pas de façon autonome les courbes, n'ajuste aucune posologie médicamenteuse et ne conclut à aucune urgence médicale via un algorithme génératif. L'évaluation clinique relève exclusivement de professionnels de santé humains qualifiés.
3. **Prouvance et intégrité absolue des données (`provenance`)** : Chaque mesure enregistrée conserve son origine exacte (`patient_manual`, `professional_manual`, `consultation`, `homelab`, `connected_device`). Les saisies du patient et les observations médicales professionnelles ne s'écrasent jamais mutuellement.
4. **Intégration unifiée sans silos parallèles** : Les constantes historiques déjà relevées lors des visites de soins à domicile (`patientVitals`) sont unifiées et intégrées dans la même timeline graphique que les auto-mesures et les résultats biologiques HomeLab.
5. **Règles d'attention paramétrables (Non-alarmistes)** : Les seuils de surveillance sont issus de protocoles cliniques configurés et non inventés en code. Le déclenchement d'un seuil génère une mention neutre d'attention (`"Cette mesure mérite l'attention de votre professionnel de santé"`) sans message anxiogène ni ordre de modification de traitement.
6. **Partage granulaire avec le Cercle de proches (Module 5)** : Le mandat `VIEW_SELECTED_HEALTH_DATA` permet au patient de partager des programmes et courbes ciblés (ex: tension artérielle) sans ouvrir l'accès à l'intégralité du dossier médical.

---

## 2. Modèle de Données & Relations

```
[conditionCatalog] ──► [patientConditions] (Statut: clinique vs auto-suivi)
                               │
                               ▼
                    [monitoringPrograms] (Période, fréquence, mesures attendues)
                               │
                               ├─────────────────────────────┐
                               ▼                             ▼
                    [measurementDefinitions]         [monitoringRules] (Seuils configurés)
                               │                             │
                               ▼                             ▼
                    [healthObservations] ◄────── [provenance: patient/pro/consult/lab]
                               │
                               ├─► [homeLabResults link] (Module 7)
                               └─► [relayRequests link]  (Module 6)
```

### Entités principales :
- `conditionCatalog` : Répertoire canonique des pathologies et états de santé (HTA, Diabète, Post-opératoire, etc.).
- `patientConditions` : Affectation au patient, distinguant le diagnostic formellement posé par un soignant (`clinical_confirmed`) du programme personnel d'auto-surveillance (`self_monitoring`).
- `monitoringPrograms` : Programme de surveillance actif, précisant les paramètres à suivre (ex: tension + pouls), la périodicité et l'éventuel soignant référent.
- `measurementDefinitions` : Définition des grandeurs physiques mesurées (code, unités strictes : `mmHg`, `bpm`, `mg/dL`, `°C`, `kg`, etc., et plausibilité technique).
- `healthObservations` : Série temporelle de mesures longitudinales horodatées en UTC, supportant les valeurs simples (glycémie, poids) et appariées (systolique/diastolique).
- `monitoringRules` : Règles de vigilance configurées (bornes min/max, sévérité, protocoles).
- `monitoringAuditEvents` : Piste d'audit de chaque événement de création, correction ou synchronisation.

---

## 3. Provenance et Traçabilité des Données

| Source | Acteur | Description / Règle d'intégrité |
| :--- | :--- | :--- |
| `patient_manual` | Patient / Proche mandaté | Auto-mesure réalisée au domicile (tensiomètre, glucomètre). Validée techniquement pour exclure les valeurs aberrantes. |
| `professional_manual` | Soignant vérifié | Mesure relevée par un praticien habilité en dehors d'une consultation formelle. |
| `consultation` | Soignant en visite | Constantes prises lors d'un acte de soin (synchronisation native avec `patientVitals`). |
| `homelab` | Laboratoire partenaire | Données issues de résultats biologiques publiés (Module 7). Rapprochement idempotent avec `sourceReferenceId`. |
| `connected_device` | Appareil connecté (futur) | Préparation architecturale pour dispositifs communicants certifiés. |

---

## 4. Visualisation Graphique & Représentation Appariée

- **Plages temporelles standardisées** : 7 jours, 30 jours, 3 mois, 6 mois et période personnalisée.
- **Pression artérielle appariée** : Tracé conjoint de la pression systolique et diastolique avec indication du pouls associé, sans interpolation artificielle des jours sans mesure.
- **Transparence analytique** : En cas de forte densité de mesures, les agrégats journaliers (moyennes) sont clairement indiqués et n'effacent jamais les points de mesure bruts sous-jacents.

---

## 5. Passerelles Inter-Modules (Modules 5, 6, 7)

### A. Intégration HomeLab (Module 7)
Les résultats biologiques officiels (ex: HbA1c, Glycémie, Créatinine) publiés par les laboratoires partenaires sont synchronisés automatiquement dans la série temporelle du patient sans duplication grâce à `sourceReferenceId: result._id`.

### B. Intégration MauriCare Relay (Module 6)
Depuis l'interface de surveillance d'un patient, un soignant traitant peut initier une demande Relay pour avis confraternel en transmettant une sélection restreinte de mesures (ex: "7 derniers relevés tensionnels") dans le respect de la minimisation des données.

### C. Partage avec le Cercle de proches (Module 5)
L'accès du Cercle est strictement subordonné au droit `VIEW_SELECTED_HEALTH_DATA`. Le membre mandaté peut visualiser les courbes et tendances autorisées, sans jamais avoir accès aux notes cliniques confidentielles ni aux discussions confraternelles Relay.
