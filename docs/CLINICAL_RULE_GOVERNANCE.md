# MauriCare — Gouvernance des Règles Cliniques & Seuils d'Attention

## 1. Principes Directeurs Fondamentaux
La plateforme **MauriCare** applique une séparation stricte et infranchissable entre deux niveaux d'évaluation des données de santé :

1. **Validation de Plausibilité Technique** (Niveau Système)
2. **Seuils d'Attention Clinique** (Niveau Médical Gouverné)

> [!IMPORTANT]
> **Règle de Sécurité Clinique Absolue (Module 10)**
> **« Aucune règle validée configurée = Aucune conclusion d'attention clinique »**
> Le code applicatif ne contient aucun seuil diagnostique ou de vigilance arbitrairement codé en dur par les développeurs. Si aucune règle n'est explicitement configurée et activée pour une métrique ou un programme de suivi, le système se limite à enregistrer et afficher factuellement les données observées, sans formuler d'alerte clinique.

---

## 2. Découplage Technique vs Clinique

| Caractéristique | Bornes de Plausibilité Technique | Seuils d'Attention Clinique |
|---|---|---|
| **Table Convex** | `measurementDefinitions` | `monitoringRules` |
| **Champs** | `minPlausible`, `maxPlausible` | `lowerBound`, `upperBound`, `secondaryUpperBound`, etc. |
| **Objectif** | Rejeter les données techniquement impossibles, négatives ou corrompues (ex: glycémie négative ou température corporelle de 15°C) | Alerter calmement le patient pour orienter vers son soignant traitant |
| **Origine** | Constantes physiques et physiologiques universelles | Protocoles validés par des praticiens de santé qualifiés |
| **Comportement si hors borne** | **Rejet de la saisie** avec erreur explicite | **Observation enregistrée**, avec drapeau d'attention calme ("info" ou "warning") |
| **Conséquence en l'absence de règle** | Bornes par défaut de la métrique appliquées | **Aucun drapeau d'attention généré** (neutralité clinique totale) |

---

## 3. Schéma & Traçabilité Obligatoire des Règles Cliniques

Toute règle d'attention clinique enregistrée dans `monitoringRules` doit obligatoirement comporter les attributs de gouvernance suivants :

```typescript
monitoringRules: defineTable({
  monitoringProgramId: v.optional(v.id("monitoringPrograms")), // Optionnel: scopé à un protocole
  measurementCode: v.string(),                                  // "bp", "glucose", "pulse", etc.
  lowerBound: v.optional(v.number()),                           // Seuil inférieur d'attention
  upperBound: v.optional(v.number()),                           // Seuil supérieur d'attention
  secondaryLowerBound: v.optional(v.number()),                  // Ex: diastolique min
  secondaryUpperBound: v.optional(v.number()),                  // Ex: diastolique max
  severity: v.union(v.literal("info"), v.literal("warning")),   // Niveau de vigilance
  messageFr: v.string(),                                        // Message calme orientant vers soignant
  messageAr: v.string(),                                        // Message calme en arabe
  enabled: v.boolean(),                                         // Statut d'activation explicite
  protocolReference: v.optional(v.string()),                    // Réf. formelle (ex: "HAS_HTA_2023", "ADA_T2D_2024")
  configuredByUserId: v.id("users"),                            // Professionnel ou administrateur médical responsable
  createdAt: v.number(),                                        // Horodatage immuable de création
})
```

---

## 4. Priorisation des Règles en Exécution

Lors de la saisie d'une observation de santé via le Web ou via [MauriCare Voice AI](file:///Applications/MAMP/htdocs/Lab/mauricaire/docs/VOICE_AI_ARCHITECTURE.md), l'évaluation s'opère selon la hiérarchie stricte suivante :

1. **Règle spécifique au programme de suivi actif** (`monitoringProgramId === progId && enabled === true`).
2. **Règle générale de plateforme** pour cette métrique (`!monitoringProgramId && enabled === true`).
3. **Absence de règle correspondante** : L'observation est enregistrée à l'état normal (`attentionFlag = false`). Aucun commentaire médical n'est interpolé.

---

## 5. Zéro IA Diagnostique & Responsabilité Humaine
- Aucune intelligence artificielle ne calcule, ne modifie ni n'extrapole les règles de vigilance clinique.
- Les seuils sont configurés exclusivement par des professionnels de santé agréés dans le cadre de protocoles de soins individualisés ou institutionnels.
- L'interprétation clinique finale demeure sous la responsabilité humaine et déontologique exclusive du praticien traitant.
