# MAURICARE — ARCHITECTURE AUTHENTIFICATION & SÉCURITÉ (PHASE 2 / MODULE 1)

**Dernière mise à jour :** Novembre 2026  
**Auteurs :** `/manager` (Atlas) avec `/application-security-reviewer`, `/database-migration-expert` et `/frontend-nextjs-expert`  
**Statut :** **ACTIF / VALIDÉ POUR IMPLÉMENTATION**

---

## 1. Vue d'Ensemble & Principes Directeurs

Le Module 1 de la Phase 2 transforme l'authentification prototypale de MauriCare en une architecture d'authentification robuste de production basée sur les standards officiels de `@convex-dev/auth` :

* **Vérification Email (OTP 6 chiffres) :** Atteste de la possession effective de l'adresse email lors de l'inscription initiale ou de la réinitialisation de mot de passe.
* **Connexion Quotidienne (Mot de passe) :** Connexion usuelle par identifiant (email) et mot de passe chiffré. L'utilisateur ne reçoit **pas** d'OTP à chaque connexion de routine.
* **Ségrégation stricte des environnements :** Préservation intégrale de l'UAT (`colorless-kookabura-292`), développement confiné sur le backend DEV local (`local-babaousmanehawoly-mauricaire`).
* **Isolation des identifiants QA :** Les OTP déterministes UAT restent strictement confinés au banc de test et ne constituent en aucun cas le mécanisme d'authentification de production.

---

## 2. Découpage & Séparation des Domaines

L'architecture sépare distinctement trois responsabilités pour éviter tout couplage monolithique :

```
┌─────────────────────────────────────────────────────────────┐
│ 1. AUTH IDENTITY (@convex-dev/auth tables)                  │
│    - authAccounts (provider, accountId, secret: Scrypt)    │
│    - authSessions (sessionId, userId, expirationTime)       │
│    - authVerificationCodes (code hashé, TTL 10 min)        │
└──────────────────────────────┬──────────────────────────────┘
                               │ userId
┌──────────────────────────────▼──────────────────────────────┐
│ 2. APPLICATION USER (table "users")                         │
│    - role ("patient" | "professionnel" | "admin")           │
│    - firstName, lastName, phone, birthDate, gender          │
│    - address, city, avatarStorageId, emailVerified          │
│    - profileCompleted, createdAt                            │
└──────────────────────────────┬──────────────────────────────┘
                               │ userId (si rôle professionnel)
┌──────────────────────────────▼──────────────────────────────┐
│ 3. PROFESSIONAL PROFILE (table "providers")                 │
│    - specialty, licenseNumber, onboardingStatus            │
│    - verificationStatus, verified, available                │
│    - consultationFee, bio, languages, supportingDocs       │
└─────────────────────────────────────────────────────────────┘
```

---

## 3. Rôle de Convex Auth & Primitives Retenues

MauriCare s'appuie sur la bibliothèque officielle `@convex-dev/auth` (version `0.0.90`) :
1. **Fournisseur `Password` officiel (`@convex-dev/auth/providers/Password`) :**
   * Flux supportés nativement :
     * `signUp` : Création de compte avec mot de passe et profil personnalisé.
     * `signIn` : Connexion quotidienne par email et mot de passe.
     * `reset` : Demande d'OTP pour mot de passe oublié.
     * `reset-verification` : Vérification de l'OTP et mise à jour du mot de passe avec invalidation des sessions actives.
     * `email-verification` : Validation de l'adresse email par OTP.
2. **Stockage et Hachage des Mots de Passe :**
   * Hachage automatique via **Scrypt** (Lucia) intégré nativement dans `@convex-dev/auth`.
   * Zéro mot de passe en clair, zéro algorithme de hachage artisanal.
   * Exigences minimales : au moins 8 caractères, présence obligatoire de lettres et de chiffres.
3. **Gestion des Sessions :**
   * Tokens JWT sécurisés gérés par Convex Auth.
   * Déconnexion atomique via `signOut`.
   * En cas de réinitialisation de mot de passe, appel de `invalidateSessions` pour révoquer tous les accès concurrents.

---

## 4. Spécifications du Système d'OTP Email

Le cycle de vie du code OTP répond à des exigences de sécurité strictes :
* **Format :** Code numérique à 6 chiffres aléatoire généré côté serveur (`crypto.getRandomValues`).
* **Durée de validité (TTL) :** 10 minutes (600 secondes).
* **Délai de réémission (Cooldown) :** 60 secondes entre deux demandes de renvoi.
* **Tentatives autorisées :** 5 tentatives erronées maximum avant invalidation du code.
* **Invalidation dynamique :** Toute génération d'un nouveau code révoque immédiatement le code précédent.
* **Consommation unique :** Dès qu'un code est validé avec succès, il est immédiatement supprimé de la base.
* **Sécurité du stockage :** Le code est haché en SHA-256 avant stockage dans la table `authVerificationCodes`.

---

## 5. Service d'Envoi d'Email (`emailService.ts`)

Pour respecter le découplage fonctionnel :
* La logique métier OTP est dissociée du transporteur d'email.
* En DEV local : Les codes sont loggués de façon sécurisée côté serveur pour permettre la recette sans dépendre d'un tiers.
* En Production : Utilisation de l'API d'envoi VLY / webhook configuré (`process.env.VLY_API_KEY`).
* Les templates d'e-mails (Validation de compte, Réinitialisation de mot de passe) sont disponibles en **Français** et prévus pour l'**Arabe**.
* Zéro secret ou clé d'API exposé côté frontend.

---

## 6. Protection Contre les Abus & Rate Limiting

Pour prévenir le brute-force et le déni de service applicatif :
* Table dédiée `rateLimits` dans Convex indexée par clé (`action:identifier`).
* Seuils imposés côté serveur :
  * **Connexion (`login`) :** Max 5 échecs par tranche de 15 minutes par email/IP.
  * **Inscription (`signup`) :** Max 3 créations par heure par IP.
  * **Vérification OTP (`otp-verify`) :** Max 5 essais par code.
  * **Renvoi OTP (`otp-resend`) :** Cooldown strict de 60 secondes.
  * **Réinitialisation mot de passe (`reset-password`) :** Max 3 demandes par tranche de 30 minutes par email.
* Réponses génériques sur la réinitialisation de mot de passe pour prévenir l'énumération des utilisateurs.

---

## 7. Sécurité des Rôles & Exclusion d'Élévation de Privilèges

* **Interdiction de l'inscription Admin :** Le formulaire d'inscription n'accepte que les rôles `patient` et `professionnel`. Toute tentative de transmission du rôle `admin` dans la mutation d'inscription est rejetée avec une erreur de sécurité.
* **Préservation de `requireAdmin` :** Les opérations d'administration (`admin.ts`) continuent d'exiger formellement le rôle `admin` et l'authentification serveur.
* **Visibilité Professionnels :** Un nouveau professionnel inscrit possède le statut initial `registration_started` puis `email_verified`. Il demeure **invisible de l'annuaire public** tant que son dossier n'est pas instruit et validé (`verificationStatus === "approved"` et `available === true`).

---

## 8. Stratégie de Migration des Utilisateurs Existants

* **Intégrité référentielle :** Les `_id` de la table `users` sont conservés tels quels sans aucune recréation.
* **Rétrocompatibilité du Schéma :** Les nouveaux champs (`firstName`, `lastName`, `phone`, `gender`, `birthDate`, `address`, `avatarStorageId`, `emailVerified`) sont définis comme optionnels (`v.optional(...)`) pour ne pas corrompre les enregistrements historiques.
* **Tolérance d'affichage :** Les composants frontend continuent de tolérer la présence de `name` tout en privilégiant `firstName + " " + lastName`.
* **Comptes QA UAT :** Préservés intégralement sans altération.
