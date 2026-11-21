/**
 * Canonical Auth Validation & Error Sanitization Helpers.
 * Ensures consistent frontend password validation matching backend policy
 * and strictly prevents leaking Convex stack traces or server internals to end users.
 */

export interface PasswordValidationResult {
  isValid: boolean;
  errorKey: string;
  defaultMessage: string;
}

/**
 * Validates password according to MauriCare canonical policy:
 * - Minimum 8 characters
 * - At least one letter (A-Z, a-z)
 * - At least one digit (0-9)
 */
export function validatePasswordRequirements(password: string): PasswordValidationResult {
  const defaultMessage = "Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre.";
  const errorKey = "auth.password_invalid";

  if (!password || password.length < 8) {
    return {
      isValid: false,
      errorKey,
      defaultMessage,
    };
  }

  const hasLetter = /[A-Za-z]/.test(password);
  const hasDigit = /[0-9]/.test(password);

  if (!hasLetter || !hasDigit) {
    return {
      isValid: false,
      errorKey,
      defaultMessage,
    };
  }

  return {
    isValid: true,
    errorKey: "",
    defaultMessage: "",
  };
}

/**
 * Sanitizes any raw exception from Convex or third-party auth services.
 * Strictly guarantees that no request IDs, file paths, line numbers,
 * stack traces, or internal function names are exposed to end users.
 */
export function sanitizeAuthError(
  err: unknown,
  t?: any,
  fallbackMessage?: string
): string {
  const translate = (key: string, fallback: string): string => {
    if (typeof t === "function") {
      try {
        const val = t(key, fallback);
        if (typeof val === "string") return val;
      } catch {
        // Fallback gracefully
      }
    }
    return fallback;
  };

  const defaultUnexpected =
    fallbackMessage ||
    translate("auth.unexpected_error", "Une erreur est survenue. Veuillez réessayer.");

  if (!err) return defaultUnexpected;

  const rawMessage =
    typeof err === "string"
      ? err
      : (err as any)?.message
      ? String((err as any).message)
      : String(err);

  // Extract inner message if wrapped in Convex Uncaught Error format
  let cleanMessage = rawMessage;
  const uncaughtMatch = rawMessage.match(/Uncaught Error:\s*([^\n\r]+)/);
  if (uncaughtMatch && uncaughtMatch[1]) {
    cleanMessage = uncaughtMatch[1].trim();
  }

  const lower = cleanMessage.toLowerCase();

  // 1. Password policy violations
  if (
    lower.includes("mot de passe doit") ||
    lower.includes("lettres et au moins un chiffre") ||
    lower.includes("password requirements") ||
    lower.includes("password must")
  ) {
    return translate(
      "auth.password_invalid",
      "Le mot de passe doit contenir au moins 8 caractères, dont une lettre et un chiffre."
    );
  }

  // 2. Duplicate account / already registered email
  if (
    lower.includes("already exists") ||
    lower.includes("existe déjà") ||
    lower.includes("account already exists") ||
    lower.includes("compte existe déjà")
  ) {
    return translate(
      "auth.account_already_exists",
      "Un compte existe déjà avec cette adresse e-mail. Veuillez vous connecter."
    );
  }

  // 3. Invalid credentials
  if (
    lower.includes("invalid credentials") ||
    lower.includes("credentials") ||
    lower.includes("identifiants incorrects") ||
    lower.includes("mot de passe actuel incorrect")
  ) {
    return translate(
      "auth.invalid_credentials",
      "Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe."
    );
  }

  // 4. Rate limiting / lockouts
  if (
    lower.includes("locked") ||
    lower.includes("tentatives") ||
    lower.includes("rate limit") ||
    lower.includes("trop de requêtes")
  ) {
    return translate(
      "auth.rate_limited",
      "Trop de tentatives. Veuillez patienter avant de réessayer."
    );
  }

  // 5. Verification code / OTP errors
  if (
    lower.includes("code incorrect") ||
    lower.includes("code de vérification") ||
    lower.includes("code expiré") ||
    lower.includes("invalid code") ||
    lower.includes("invalid verification code") ||
    lower.includes("verification code") ||
    lower.includes("expiré")
  ) {
    return translate(
      "auth.invalid_code",
      "Code de vérification incorrect ou expiré."
    );
  }

  // 6. Admin unauthorized / not found
  if (
    lower.includes("compte administrateur introuvable ou non autorisé") ||
    lower.includes("administrateur introuvable") ||
    lower.includes("privilèges administrateur requis")
  ) {
    return translate(
      "auth.admin_account_unauthorized",
      "Compte administrateur introuvable ou non autorisé."
    );
  }

  // 7. Security restrictions
  if (lower.includes("administrateur interdite")) {
    return translate("auth.unauthorized_action", "Action non autorisée.");
  }

  // 7. Check if message contains technical tokens or stack traces
  const hasTechnicalArtifacts =
    rawMessage.includes("[CONVEX") ||
    rawMessage.includes("Server Error") ||
    rawMessage.includes("    at ") ||
    rawMessage.includes("node_modules") ||
    rawMessage.includes("RequestId:") ||
    rawMessage.includes(".ts:") ||
    rawMessage.includes(".js:") ||
    rawMessage.includes("http:") ||
    rawMessage.includes("https:") ||
    rawMessage.includes("stack") ||
    cleanMessage.includes("[CONVEX") ||
    cleanMessage.includes("at ");

  if (hasTechnicalArtifacts) {
    return defaultUnexpected;
  }

  // 8. If clean human-friendly short sentence without technical leakage, return it
  if (cleanMessage.length > 0 && cleanMessage.length < 150 && !cleanMessage.includes("\n")) {
    return cleanMessage;
  }

  return defaultUnexpected;
}

/**
 * Sanitizes errors from the professional onboarding and dossier submission workflows.
 * Completely strips Convex internal tags, Request IDs, server paths, line numbers,
 * and stack traces. Returns clear, user-facing messages.
 */
export function sanitizeOnboardingError(
  err: unknown,
  t?: any,
  fallbackMessage?: string
): string {
  const translate = (key: string, fallback: string): string => {
    if (typeof t === "function") {
      try {
        const val = t(key, fallback);
        if (typeof val === "string") return val;
      } catch {
        // Fallback gracefully
      }
    }
    return fallback;
  };

  const defaultError =
    fallbackMessage ||
    translate(
      "onboarding.submit_incomplete_fallback",
      "Votre dossier est incomplet. Veuillez compléter les éléments obligatoires indiqués avant de le soumettre."
    );

  if (!err) return defaultError;

  const rawMessage =
    typeof err === "string"
      ? err
      : (err as any)?.message
      ? String((err as any).message)
      : String(err);

  // Extract clean message from Convex Uncaught Error format
  let cleanMessage = rawMessage;
  const uncaughtMatch = rawMessage.match(/Uncaught Error:\s*([^\n\r]+)/);
  if (uncaughtMatch && uncaughtMatch[1]) {
    cleanMessage = uncaughtMatch[1].trim();
  }

  // Strip Convex internal tags e.g. [CONVEX M(...)]
  cleanMessage = cleanMessage.replace(/\[CONVEX[^\]]*\]/g, "").trim();

  // If message contains dossier incomplete notice, return it cleanly
  if (cleanMessage.includes("Dossier incomplet") || cleanMessage.includes("Éléments obligatoires manquants")) {
    const firstSentence = cleanMessage.split("\n")[0].trim();
    if (firstSentence && !firstSentence.includes(".ts:") && !firstSentence.includes("Request ID")) {
      return firstSentence;
    }
    return defaultError;
  }

  // Known state conflict messages
  if (cleanMessage.includes("déjà en cours d'examen")) {
    return translate(
      "onboarding.already_in_review",
      "Votre dossier est déjà en cours d'examen par notre équipe médicale."
    );
  }
  if (cleanMessage.includes("déjà été validé")) {
    return translate(
      "onboarding.already_approved",
      "Votre dossier a déjà été validé par l'administration."
    );
  }

  // Check for technical leakage
  const hasTechnicalArtifacts =
    rawMessage.includes("[CONVEX") ||
    rawMessage.includes("Server Error") ||
    rawMessage.includes("Request ID") ||
    rawMessage.includes(".ts:") ||
    rawMessage.includes(".js:") ||
    rawMessage.includes("    at ") ||
    cleanMessage.includes("Server Error") ||
    cleanMessage.includes(".ts:");

  if (hasTechnicalArtifacts) {
    return defaultError;
  }

  if (cleanMessage.length > 0 && cleanMessage.length < 200 && !cleanMessage.includes("\n")) {
    return cleanMessage;
  }

  return defaultError;
}

/**
 * Sanitizes errors from the booking and appointment creation workflows (Module 4 & 5).
 * Completely strips Convex internal tags, Request IDs, server paths, line numbers,
 * and stack traces. Returns clean, user-friendly messages for zone mismatch, slot collision,
 * leave, or availability errors.
 */
export function sanitizeBookingError(
  err: unknown,
  t?: any,
  fallbackMessage?: string
): string {
  const translate = (key: string, fallback: string): string => {
    if (typeof t === "function") {
      try {
        const val = t(key, fallback);
        if (typeof val === "string") return val;
      } catch {
        // Fallback gracefully
      }
    }
    return fallback;
  };

  const defaultError =
    fallbackMessage ||
    translate(
      "booking.unexpected_error",
      "Une erreur est survenue lors de la réservation. Veuillez vérifier vos informations et réessayer."
    );

  if (!err) return defaultError;

  const rawMessage =
    typeof err === "string"
      ? err
      : (err as any)?.message
      ? String((err as any).message)
      : String(err);

  // Extract clean message from Convex Uncaught Error format
  let cleanMessage = rawMessage;
  const uncaughtMatch = rawMessage.match(/Uncaught Error:\s*([^\n\r]+)/);
  if (uncaughtMatch && uncaughtMatch[1]) {
    cleanMessage = uncaughtMatch[1].trim();
  }

  // Strip Convex internal tags e.g. [CONVEX M(...)]
  cleanMessage = cleanMessage.replace(/\[CONVEX[^\]]*\]/g, "").trim();

  // Unconfigured availability or services
  if (cleanMessage.includes("pas encore configuré ses disponibilités")) {
    return "Ce professionnel n'a pas encore configuré ses disponibilités.";
  }
  if (cleanMessage.includes("pas encore configuré ses prestations")) {
    return "Ce professionnel n'a pas encore configuré ses prestations de soins.";
  }
  if (cleanMessage.includes("sélectionner une prestation de soins active")) {
    return "Veuillez sélectionner une prestation de soins active proposée par ce praticien.";
  }
  if (cleanMessage.includes("prestation sélectionnée n'est pas disponible")) {
    return "La prestation sélectionnée n'est pas disponible auprès de ce praticien.";
  }

  // Zone incompatibility
  if (cleanMessage.includes("n'intervient que dans les zones")) {
    const firstSentence = cleanMessage.split("\n")[0].trim();
    if (firstSentence && !firstSentence.includes(".ts:") && !firstSentence.includes("Request ID")) {
      return firstSentence;
    }
    return "Ce soignant n'intervient pas dans la zone sélectionnée. Veuillez choisir une zone couverte ou un autre praticien.";
  }

  // Slot collision
  if (cleanMessage.includes("vient d'être réservé") || cleanMessage.includes("créneau") || cleanMessage.includes("collision")) {
    return translate(
      "booking.slot_taken",
      "Ce créneau vient d'être réservé par un autre patient. Veuillez sélectionner un autre créneau."
    );
  }

  // Practitioner on leave
  if (cleanMessage.includes("en congé")) {
    const firstSentence = cleanMessage.split("\n")[0].trim();
    if (firstSentence && !firstSentence.includes(".ts:") && !firstSentence.includes("Request ID")) {
      return firstSentence;
    }
    return "Ce professionnel de santé est actuellement en congé à cette période.";
  }

  // Practitioner unavailable
  if (cleanMessage.includes("indisponible") || cleanMessage.includes("non disponible")) {
    return "Ce professionnel de santé n'est pas disponible pour de nouvelles réservations à cette date.";
  }

  // Self booking prevention
  if (cleanMessage.includes("avec vous-même")) {
    return "Vous ne pouvez pas réserver de consultation avec vous-même.";
  }

  // Check for technical leakage
  const hasTechnicalArtifacts =
    rawMessage.includes("[CONVEX") ||
    rawMessage.includes("Server Error") ||
    rawMessage.includes("Request ID") ||
    rawMessage.includes(".ts:") ||
    rawMessage.includes(".js:") ||
    rawMessage.includes("    at ") ||
    cleanMessage.includes("Server Error") ||
    cleanMessage.includes(".ts:");

  if (hasTechnicalArtifacts) {
    return defaultError;
  }

  if (cleanMessage.length > 0 && cleanMessage.length < 200 && !cleanMessage.includes("\n")) {
    return cleanMessage;
  }

  return defaultError;
}
