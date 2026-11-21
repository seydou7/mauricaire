# MauriCare — Matrice Canonique des Permissions & Contrôle d'Accès (RBAC)

## 1. Rôles & États d'Acteurs Reconnus

| Acteur | Code Rôle / État | Description |
|---|---|---|
| **Patient** | `role: "patient"` | Utilisateur final recevant des soins ou gérant sa santé |
| **Professionnel — Agréé** | `role: "professionnel"`, `verificationStatus: "approved"` | Praticien ou soignant vérifié ayant accès à l'exercice actif |
| **Professionnel — En attente** | `role: "professionnel"`, `verificationStatus: "pending"` | Dossier d'accréditation soumis en cours d'examen admin |
| **Professionnel — Rejeté** | `role: "professionnel"`, `verificationStatus: "rejected"` | Dossier rejeté (aucun exercice public possible) |
| **Professionnel — Désactivé** | `role: "professionnel"`, `deactivatedAt: number` | Compte suspendu / désactivé (indisponible pour réservations) |
| **Administrateur** | `role: "admin"` | Gestionnaire de plateforme et d'accréditation |
| **Membre du Cercle** | `circleMembers` actif | Proche aidant mandaté avec permissions granulaires |
| **Utilisateur Laboratoire** | `laboratoryUsers` | Biologiste ou technicien scopé à son laboratoire partenaire |
| **Préleveur** | `role: "professionnel"`, assigné à un prélèvement | Soignant ou infirmier effectuant la visite à domicile |
| **Acteur Voice AI** | Authentifié sous l'un des rôles ci-dessus | **Hérite strictement des droits réels** de l'utilisateur connecté |

---

## 2. Matrice Complète d'Habilitations par Ressource

Légende : **R** = Read (Lecture), **C** = Create (Création), **U** = Update (Modification), **D** = Delete/Cancel (Annulation/Suppression), **—** = Interdit / Non applicable.

### A. Profils, Sécurité & Comptes
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Mon profil personnel** | R, U | R, U | R, U | R, U | R | R, U | R (propre) | R, U |
| **Contacts d'urgence** | R, C, U, D | R, C, U, D | R, C, U, D | R | R | R | — | — |
| **Changement mot de passe / email** | U | U | U | U | — | U | U (propre) | U |
| **Désactivation de compte** | U | U | U | U | — | — (Anti-lockout)| — | — |
| **Documents d'identité sensibles** | R (propre) | R (propre) | R (propre) | R (propre)| R (propre)| R (audit) | — | — |

### B. Annuaire Soignant & Disponibilités
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Annuaire public des soignants** | R | R | R | R | R | R | R | R |
| **Affichage dans l'annuaire public** | — | **OUI (Visible)**| **NON (Masqué)**| **NON** | **NON (Masqué)**| — | — | — |
| **Gestion des créneaux / congés** | — | R, C, U, D | — | — | — | R, U | — | — |
| **Gestion de ses propres tarifs** | — | R, C, U | — | — | — | R, U | — | — |

### C. Rendez-vous de Soins (Module 4 & 5)
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Réserver un soin pour soi** | C | — | — | — | — | — | — | — |
| **Réserver pour un proche** | — | — | — | — | — | — | C (`BOOK_APPOINTMENTS`)| — |
| **Voir ses rendez-vous** | R (siens) | R (siens) | — | — | R (historique)| R (tous) | R (`VIEW_APPOINTMENTS`)| — |
| **Accepter / Refuser un RDV** | — | U (assigné)| — | — | — | U | — | — |
| **Annuler un RDV futur** | D (propre) | D (assigné)| — | — | — | D | D (`MANAGE_APPOINTMENTS`)| — |
| **Saisir constantes de visite** | — | C (visite) | — | — | — | — | — | — |

### D. MauriCare Circle (Module 5)
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Créer son Cercle & Inviter** | C | — | — | — | — | R | — | — |
| **Accepter / Décliner invitation** | — | — | — | — | — | — | U (invité) | — |
| **Modifier permissions / Révoquer**| U, D (auteur)| — | — | — | — | U, D | — | — |
| **Accès dossier médical brut** | R (propre) | R (relation soignant)| — | — | — | — | **INTERDIT** | — |
| **Voir constantes ciblées** | R | R | — | — | — | — | R (`VIEW_SELECTED_HEALTH_DATA`)| — |

### E. MauriCare Relay — Collaboration Médicale (Module 6)
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Créer demande Relay** | — | C (soignant traitant)| — | — | — | — | — | — |
| **Consulter file Relay spécialité** | — | R (spécialité)| — | — | — | R (audit) | — | — |
| **Accepter / Répondre à l'avis** | — | U (confrère)| — | — | — | — | — | — |
| **Voir synthèse vulgarisée soignant**| R (si partagée)| R | — | — | — | — | R (`VIEW_CARE_SUMMARY`)| — |
| **Voir échanges bruts & pièces privées**| **NON** | R (impliqués)| **NON** | **NON** | **NON** | R (audit) | **STRICTEMENT NON** | **NON** |

### F. MauriCare HomeLab — Analyses Biologiques (Module 7)
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Commander un prélèvement** | C | C (pour patient suivi)| — | — | — | — | C (`MANAGE_HOMELAB` uniquement)| — |
| **Suivre statut logistique** | R | R | — | — | — | R | R (`VIEW_HOMELAB_STATUS`)| R (son lab) |
| **Assigner préleveur / tournée** | — | — | — | — | — | U | — | U (son lab) |
| **Valider prélèvement à domicile** | — | U (préleveur assigné)| — | — | — | — | — | — |
| **Publier / Amender résultat** | — | — | — | — | — | — | — | C, U (son lab) |
| **Télécharger compte-rendu PDF** | R (propre) | R (soignant traitant)| — | — | — | R (audit) | R (`VIEW_SELECTED_HEALTH_DATA`)| R (son lab) |
| **Accès d'un labo aux données d'un autre**| — | — | — | — | — | — | — | **STRICTEMENT NON** |

### G. MauriCare Chronic — Suivi Longitudinal (Module 8)
| Ressource / Action | Patient | Pro Agréé | Pro En Attente | Pro Rejeté | Pro Désactivé | Admin | Cercle | Lab User |
|---|:---:|:---:|:---:|:---:|:---:|:---:|:---:|:---:|
| **Enregistrer une constante (auto-mesure)**| C | C (au chevet)| — | — | — | — | — | — |
| **Créer protocole de surveillance**| C | C (soignant traitant)| — | — | — | — | — | — |
| **Consulter courbes & séries temporelles**| R | R (soignant traitant)| — | — | — | — | R (`VIEW_SELECTED_HEALTH_DATA`)| — |
| **Corriger une mesure erronée (justifiée)**| U (propre) | U (propre relevé)| — | — | — | — | — | — |
| **Configurer règles de vigilance clinique**| — | C, U (habilité)| — | — | — | C, U | — | — |

### H. MauriCare Voice AI (Module 9)
- **Principe Absolu** : Voice AI n'est pas un acteur autonome. Toute commande transmise est soumise aux vérifications d'habilitation strictes du profil de l'utilisateur authentifié.
- **Règle Zéro IA Diagnostique** : Aucune demande de diagnostic ou de prescription n'est exécutable (bloquée en amont).
- **Confirmation Requise** : Toute écriture requiert une confirmation interactive avant déclenchement des mutations.
