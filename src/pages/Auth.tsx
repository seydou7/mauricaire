import { useState, useEffect, useRef } from "react";
import { useNavigate, Link } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { validatePasswordRequirements, sanitizeAuthError } from "@/lib/authValidation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import logo from "@/assets/logo.svg";
import {
  User,
  Stethoscope,
  Shield,
  Mail,
  Lock,
  Phone,
  Calendar,
  MapPin,
  CheckCircle2,
  AlertCircle,
  Loader2,
  ArrowRight,
  ArrowLeft,
  Upload,
  RefreshCw,
  Sparkles,
  Eye,
  EyeOff,
  UserCheck,
} from "lucide-react";
import { toast } from "sonner";

type AuthMode =
  | "login"
  | "signup-patient"
  | "signup-pro"
  | "forgot-password"
  | "reset-password-otp"
  | "verify-email-otp";

type SpecialtyType = "infirmier" | "aide_soignant" | "medecin" | "kinestherapeute";

export default function AuthPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const navigate = useNavigate();
  const { isLoading: authLoading, isAuthenticated, user, role, isAdmin, signIn, signOut } = useAuth();

  // Mode state
  const [mode, setMode] = useState<AuthMode>("login");
  const [isAdminLogin, setIsAdminLogin] = useState(false);
  const [isUatOtpMode, setIsUatOtpMode] = useState(false);

  // Login form state
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [uatOtp, setUatOtp] = useState("");

  // Patient registration multi-step state (Steps 1, 2, 3)
  const [patientStep, setPatientStep] = useState<1 | 2 | 3>(1);
  const [pFirstName, setPFirstName] = useState("");
  const [pLastName, setPLastName] = useState("");
  const [pBirthDate, setPBirthDate] = useState("");
  const [pGender, setPGender] = useState<"homme" | "femme">("homme");
  const [pPhone, setPPhone] = useState("");
  const [pCity, setPCity] = useState("Nouakchott");
  const [pAddress, setPAddress] = useState("");
  const [pEmail, setPEmail] = useState("");
  const [pPassword, setPPassword] = useState("");
  const [pConfirmPassword, setPConfirmPassword] = useState("");
  const [pAcceptCgu, setPAcceptCgu] = useState(false);

  // Professional registration multi-step state (Steps 1, 2, 3)
  const [proStep, setProStep] = useState<1 | 2 | 3>(1);
  const [proFirstName, setProFirstName] = useState("");
  const [proLastName, setProLastName] = useState("");
  const [proBirthDate, setProBirthDate] = useState("");
  const [proPhone, setProPhone] = useState("");
  const [proSpecialty, setProSpecialty] = useState<SpecialtyType>("infirmier");
  const [proCity, setProCity] = useState("Nouakchott");
  const [proEmail, setProEmail] = useState("");
  const [proPassword, setProPassword] = useState("");
  const [proConfirmPassword, setProConfirmPassword] = useState("");
  const [proAcceptCgu, setProAcceptCgu] = useState(false);

  // Avatar upload state
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarStorageId, setAvatarStorageId] = useState<string | null>(null);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Forgot password & OTP verification state
  const [forgotEmail, setForgotEmail] = useState("");
  const [resetOtp, setResetOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");

  // Email verification OTP state
  const [verifyEmailAddress, setVerifyEmailAddress] = useState("");
  const [verifyOtpCode, setVerifyOtpCode] = useState("");
  const [countdown, setCountdown] = useState(0);

  // Common UI state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Convex mutations and actions
  const generateAvatarUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const saveAvatar = useMutation(api.users.saveAvatar);
  const requestEmailOtpAction = useAction(api.authOtpService.requestEmailVerificationOtp);
  const verifyEmailOtpMutation = useMutation(api.authOtpService.verifyEmailOtp);
  const requestPasswordResetAction = useAction(api.authOtpService.requestPasswordReset);
  const confirmPasswordResetAction = useAction(api.authOtpService.confirmPasswordReset);
  const prepareQaOtpMutation = useMutation(api.auth.emailOtp.prepareDeterministicQaOtpLogin);

  // Resend cooldown timer
  useEffect(() => {
    if (countdown <= 0) return;
    const interval = setInterval(() => {
      setCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(interval);
  }, [countdown]);

  // Session routing guard: redirect authenticated users according to their verified role
  useEffect(() => {
    if (!authLoading && isAuthenticated && user) {
      if (isAdmin || user.role === "admin") {
        navigate("/admin", { replace: true });
        return;
      }

      if (isAdminLogin) {
        // Non-admin attempted to login via Admin portal
        signOut();
        setFormError(t("auth.admin_account_unauthorized", "Compte administrateur introuvable ou non autorisé."));
        return;
      }

      // Check email verification status: if unverified, stay strictly on verify-email-otp and NEVER navigate to dashboard
      if (user.emailVerified === false) {
        if (mode !== "verify-email-otp") {
          setVerifyEmailAddress(user.email || "");
          setMode("verify-email-otp");
        }
        return;
      }

      if (user.role === "patient" || user.role === "professionnel") {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, user, isAdmin, isAdminLogin, navigate, mode, signOut, t]);

  // Avatar file selection and upload
  const handleAvatarSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setFormError("Veuillez sélectionner un fichier image valide (JPG, PNG).");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setFormError("L'image ne doit pas dépasser 5 Mo.");
      return;
    }

    setAvatarFile(file);
    const objectUrl = URL.createObjectURL(file);
    setAvatarPreview(objectUrl);
    setFormError(null);

    // If already authenticated, upload directly to Convex storage
    if (isAuthenticated) {
      try {
        setIsUploadingAvatar(true);
        const uploadUrl = await generateAvatarUploadUrl();
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": file.type },
          body: file,
        });
        const { storageId } = await response.json();
        setAvatarStorageId(storageId);
        await saveAvatar({ storageId });
        toast.success(t("auth.avatar_success", "Photo ajoutée avec succès"));
      } catch (err: any) {
        console.warn("Avatar upload error:", err);
      } finally {
        setIsUploadingAvatar(false);
      }
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: LOGIN (Email + Password OR Legacy UAT OTP)
  // ---------------------------------------------------------------------------
  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    const email = loginEmail.toLowerCase().trim();
    if (!email) {
      setFormError("Veuillez saisir votre adresse e-mail.");
      return;
    }

    setIsSubmitting(true);
    try {
      if (isUatOtpMode) {
        // Controlled UAT / QA deterministic OTP login (DEV-only)
        if (!uatOtp || uatOtp.length !== 6) {
          setFormError(t("auth.otp_six_digits_required", "Veuillez saisir le code OTP à 6 chiffres."));
          setIsSubmitting(false);
          return;
        }

        // 1. Prepare and validate deterministic QA OTP on server (DEV-guarded)
        const prep = await prepareQaOtpMutation({
          email,
          code: uatOtp,
          portal: isAdminLogin ? "admin" : "user",
        });

        // 2. Perform authentic Convex Auth session creation via email-otp
        await signIn("email-otp", { email, code: uatOtp });

        // 3. Post-auth security check: if in Admin portal, verify admin role
        if (isAdminLogin && prep.role !== "admin") {
          await signOut();
          setFormError(t("auth.admin_account_unauthorized", "Compte administrateur introuvable ou non autorisé."));
          setIsSubmitting(false);
          return;
        }

        toast.success(t("auth.login_success", "Connexion réussie"));
      } else {
        // Canonical Product Password Login
        if (!loginPassword) {
          setFormError(t("auth.password_required", "Veuillez saisir votre mot de passe."));
          setIsSubmitting(false);
          return;
        }
        await signIn("password", {
          flow: "signIn",
          email,
          password: loginPassword,
        });
        toast.success(t("auth.login_success", "Connexion réussie"));
      }
    } catch (err: any) {
      console.warn("Login failed:", err);
      if (isUatOtpMode) {
        setFormError(
          sanitizeAuthError(
            err,
            t,
            t("auth.unexpected_error", "Une erreur est survenue. Veuillez réessayer.")
          )
        );
      } else {
        setFormError(
          sanitizeAuthError(
            err,
            t,
            t("auth.invalid_credentials", "Identifiants incorrects. Veuillez vérifier votre adresse e-mail et votre mot de passe.")
          )
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: PATIENT SIGNUP
  // ---------------------------------------------------------------------------
  const handlePatientSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = pEmail.toLowerCase().trim();
    if (!pFirstName.trim() || !pLastName.trim()) {
      setFormError(t("auth.fill_required_fields", "Veuillez renseigner votre prénom et votre nom."));
      return;
    }
    if (!email) {
      setFormError(t("auth.invalid_email", "Veuillez renseigner une adresse e-mail valide."));
      return;
    }
    const passwordCheck = validatePasswordRequirements(pPassword);
    if (!passwordCheck.isValid) {
      setFormError(t(passwordCheck.errorKey, passwordCheck.defaultMessage));
      return;
    }
    if (pPassword !== pConfirmPassword) {
      setFormError(t("auth.passwords_dont_match", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    if (!pAcceptCgu) {
      setFormError(t("auth.accept_cgu_required", "Veuillez accepter les conditions générales d'utilisation pour continuer."));
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create account with Convex Auth Password Provider
      await signIn("password", {
        flow: "signUp",
        email,
        password: pPassword,
        role: "patient",
        firstName: pFirstName.trim(),
        lastName: pLastName.trim(),
        phone: pPhone.trim(),
        city: pCity,
        address: pAddress.trim(),
        birthDate: pBirthDate,
        gender: pGender,
      });

      // 2. Dispatch Email Verification OTP
      await requestEmailOtpAction({
        email,
        name: pFirstName.trim(),
      });

      setVerifyEmailAddress(email);
      setCountdown(60);
      setMode("verify-email-otp");
      toast.success(t("auth.code_sent", "Code de vérification envoyé"));
    } catch (err: any) {
      console.warn("Patient signup error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          t("auth.unexpected_error", "Erreur lors de la création du compte.")
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: PROFESSIONAL SIGNUP
  // ---------------------------------------------------------------------------
  const handleProSignupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = proEmail.toLowerCase().trim();
    if (!proFirstName.trim() || !proLastName.trim()) {
      setFormError(t("auth.fill_required_fields", "Veuillez renseigner votre prénom et votre nom."));
      return;
    }
    if (!email) {
      setFormError(t("auth.invalid_email", "Veuillez renseigner une adresse e-mail valide."));
      return;
    }
    const passwordCheck = validatePasswordRequirements(proPassword);
    if (!passwordCheck.isValid) {
      setFormError(t(passwordCheck.errorKey, passwordCheck.defaultMessage));
      return;
    }
    if (proPassword !== proConfirmPassword) {
      setFormError(t("auth.passwords_dont_match", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    if (!proAcceptCgu) {
      setFormError(t("auth.accept_cgu_required", "Veuillez accepter les conditions générales d'utilisation pour continuer."));
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Create professional account with Convex Auth
      await signIn("password", {
        flow: "signUp",
        email,
        password: proPassword,
        role: "professionnel",
        firstName: proFirstName.trim(),
        lastName: proLastName.trim(),
        phone: proPhone.trim(),
        city: proCity,
        specialty: proSpecialty,
        birthDate: proBirthDate,
      });

      // 2. Dispatch Email Verification OTP
      await requestEmailOtpAction({
        email,
        name: proFirstName.trim(),
      });

      setVerifyEmailAddress(email);
      setCountdown(60);
      setMode("verify-email-otp");
      toast.success(t("auth.code_sent", "Code de vérification envoyé"));
    } catch (err: any) {
      console.warn("Professional signup error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          t("auth.unexpected_error", "Erreur lors de la création du compte professionnel.")
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: VERIFY EMAIL OTP
  // ---------------------------------------------------------------------------
  const handleVerifyEmailOtpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!verifyOtpCode || verifyOtpCode.length !== 6) {
      setFormError(t("auth.invalid_code", "Veuillez saisir le code à 6 chiffres."));
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await verifyEmailOtpMutation({
        email: verifyEmailAddress,
        code: verifyOtpCode,
      });

      if (res.success) {
        toast.success(t("auth.email_verified_success", "Votre e-mail a été vérifié avec succès !"));
        if (res.role === "professionnel") {
          toast.info(t("auth.pro_registered_notice", "Votre compte professionnel est créé avec succès. Veuillez renseigner votre dossier d'accréditation."));
        }
        navigate("/dashboard", { replace: true });
      }
    } catch (err: any) {
      console.warn("OTP verification error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          t("auth.invalid_code", "Code incorrect ou expiré.")
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: RESEND EMAIL OTP
  // ---------------------------------------------------------------------------
  const handleResendEmailOtp = async () => {
    if (countdown > 0) return;
    setFormError(null);
    try {
      await requestEmailOtpAction({ email: verifyEmailAddress });
      setCountdown(60);
      toast.success(t("auth.code_sent", "Nouveau code envoyé"));
    } catch (err: any) {
      console.warn("Resend OTP error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          "Impossible de renvoyer le code pour le moment."
        )
      );
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: FORGOT PASSWORD REQUEST
  // ---------------------------------------------------------------------------
  const handleForgotPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    const email = forgotEmail.toLowerCase().trim();
    if (!email) {
      setFormError(t("auth.invalid_email", "Veuillez saisir votre adresse e-mail."));
      return;
    }

    setIsSubmitting(true);
    try {
      await requestPasswordResetAction({ email });
      setCountdown(60);
      setMode("reset-password-otp");
      toast.success(t("auth.code_sent", "Code de sécurité envoyé"));
    } catch (err: any) {
      console.warn("Forgot password error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          "Erreur lors de la demande de réinitialisation."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  // ---------------------------------------------------------------------------
  // HANDLER: CONFIRM PASSWORD RESET
  // ---------------------------------------------------------------------------
  const handleConfirmPasswordResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);

    if (!resetOtp || resetOtp.length !== 6) {
      setFormError(t("auth.invalid_code", "Veuillez saisir le code à 6 chiffres."));
      return;
    }
    const passwordCheck = validatePasswordRequirements(newPassword);
    if (!passwordCheck.isValid) {
      setFormError(t(passwordCheck.errorKey, passwordCheck.defaultMessage));
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setFormError(t("auth.passwords_dont_match", "Les deux mots de passe ne correspondent pas."));
      return;
    }

    setIsSubmitting(true);
    try {
      await confirmPasswordResetAction({
        email: forgotEmail.toLowerCase().trim(),
        code: resetOtp,
        newPassword,
      });

      toast.success("Mot de passe réinitialisé avec succès ! Connectez-vous maintenant.");
      setLoginEmail(forgotEmail);
      setLoginPassword("");
      setMode("login");
    } catch (err: any) {
      console.warn("Reset password confirmation error:", err);
      setFormError(
        sanitizeAuthError(
          err,
          t,
          "Échec de la réinitialisation du mot de passe."
        )
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={`min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col justify-between ${isRtl ? "rtl" : "ltr"}`}>
      {/* Top Bar with Brand & Language Switcher */}
      <header className="px-4 lg:px-8 py-4 flex items-center justify-between border-b border-slate-200/80 dark:border-slate-800 bg-white/70 dark:bg-slate-900/70 backdrop-blur-md sticky top-0 z-20">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="w-10 h-10 rounded-xl bg-teal-600/10 flex items-center justify-center border border-teal-600/20 group-hover:scale-105 transition-transform">
            <img src={logo} alt="MauriCare Logo" className="w-6 h-6 object-contain" />
          </div>
          <div>
            <span className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">MauriCare</span>
            <span className="hidden sm:inline-block text-xs text-teal-600 dark:text-teal-400 font-medium ml-2">
              | {t("app.tagline", "Vos soins à domicile")}
            </span>
          </div>
        </Link>
        <div className="flex items-center gap-3">
          <LanguageSwitcher />
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 flex items-center justify-center p-4 sm:p-6 lg:p-8">
        <div className="w-full max-w-lg">
          {/* Notifications & Error banner */}
          {formError && (
            <div className="mb-4 p-3.5 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800/60 text-red-700 dark:text-red-300 text-sm flex items-start gap-2.5 animate-in fade-in duration-200">
              <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
              <span className="leading-relaxed">{sanitizeAuthError(formError, t)}</span>
            </div>
          )}

          {formSuccess && (
            <div className="mb-4 p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800/60 text-emerald-800 dark:text-emerald-300 text-sm flex items-start gap-2.5 animate-in fade-in duration-200">
              <CheckCircle2 className="w-5 h-5 shrink-0 mt-0.5 text-emerald-600" />
              <span>{formSuccess}</span>
            </div>
          )}

          {/* ================================================================= */}
          {/* VIEW 1: NORMAL LOGIN (EMAIL + PASSWORD)                           */}
          {/* ================================================================= */}
          {mode === "login" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl shadow-slate-200/40 dark:shadow-none bg-white dark:bg-slate-900">
              <CardHeader className="space-y-1.5 pb-5">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-semibold px-2.5 py-0.5 border-teal-500/30 text-teal-700 dark:text-teal-400 bg-teal-50/50 dark:bg-teal-950/30">
                    {isAdminLogin ? "Portail Administrateur" : "Espace Utilisateur"}
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setIsAdminLogin(!isAdminLogin)}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 transition-colors"
                  >
                    {isAdminLogin ? "Connexion normale" : "Accès administrateur"}
                  </button>
                </div>
                <CardTitle className="text-2xl font-bold tracking-tight text-slate-900 dark:text-white">
                  {isAdminLogin ? "Connexion Administrateur" : t("auth.login_title", "Connexion à votre espace")}
                </CardTitle>
                <CardDescription className="text-sm text-slate-500 dark:text-slate-400">
                  {isAdminLogin
                    ? t("auth.admin_badge", "Portail réservé aux administrateurs accrédités")
                    : t("auth.login_subtitle", "Accédez à votre compte MauriCare avec votre email et mot de passe")}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleLoginSubmit}>
                <CardContent className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {t("auth.email_label", "Adresse e-mail")}
                    </label>
                    <Input
                      type="email"
                      value={loginEmail}
                      onChange={(e) => setLoginEmail(e.target.value)}
                      placeholder="votre.email@exemple.com"
                      required
                      className="h-10 bg-slate-50/60 dark:bg-slate-800/60"
                      dir="ltr"
                    />
                  </div>

                  {!isUatOtpMode ? (
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Lock className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.password_label", "Mot de passe")}
                        </label>
                        {!isAdminLogin && (
                          <button
                            type="button"
                            onClick={() => {
                              setForgotEmail(loginEmail);
                              setMode("forgot-password");
                            }}
                            className="text-xs text-teal-600 hover:text-teal-700 dark:text-teal-400 hover:underline"
                          >
                            {t("auth.forgot_password_link", "Mot de passe oublié ?")}
                          </button>
                        )}
                      </div>
                      <div className="relative">
                        <Input
                          type={showPassword ? "text" : "password"}
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                          className="h-10 pr-10 bg-slate-50/60 dark:bg-slate-800/60"
                          dir="ltr"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200"
                        >
                          {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-2 p-3 bg-amber-50/80 dark:bg-amber-950/30 rounded-lg border border-amber-200/80 dark:border-amber-800/50">
                      <span className="text-xs font-semibold text-amber-800 dark:text-amber-300 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5" />
                        {t("auth.uat_otp_login_mode", "Connexion rapide UAT / Démo (OTP)")}
                      </span>
                      <Input
                        type="text"
                        maxLength={6}
                        value={uatOtp}
                        onChange={(e) => setUatOtp(e.target.value.trim())}
                        placeholder="Ex: 111111 (Patient) ou 222222 (Infirmier)"
                        className="h-10 font-mono tracking-widest text-center"
                        dir="ltr"
                      />
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-md shadow-teal-600/20"
                  >
                    {isSubmitting ? (
                      <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    ) : (
                      <UserCheck className="w-4 h-4 mr-2" />
                    )}
                    {t("auth.btn_login", "Se connecter")}
                  </Button>

                  {/* Toggle UAT Mode */}
                  <div className="text-center pt-1">
                    <button
                      type="button"
                      onClick={() => setIsUatOtpMode(!isUatOtpMode)}
                      className="text-xs text-slate-400 hover:text-slate-600 dark:hover:text-slate-300 underline"
                    >
                      {isUatOtpMode ? "Basculer vers connexion standard (Mot de passe)" : "Accès rapide démo UAT (OTP déterministe)"}
                    </button>
                  </div>
                </CardContent>
              </form>

              {!isAdminLogin && (
                <CardFooter className="flex flex-col gap-3 pt-3 border-t border-slate-100 dark:border-slate-800/80">
                  <span className="text-xs text-slate-500 font-medium">
                    {t("auth.no_account_prompt", "Pas encore de compte ?")}
                  </span>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 w-full">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormError(null);
                        setPatientStep(1);
                        setMode("signup-patient");
                      }}
                      className="h-10 text-xs font-semibold justify-center gap-2 border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-slate-800"
                    >
                      <User className="w-3.5 h-3.5 text-teal-600" />
                      {t("auth.signup_patient_tab", "Compte Patient")}
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setFormError(null);
                        setProStep(1);
                        setMode("signup-pro");
                      }}
                      className="h-10 text-xs font-semibold justify-center gap-2 border-slate-200 dark:border-slate-700 hover:bg-teal-50 dark:hover:bg-slate-800"
                    >
                      <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                      {t("auth.signup_pro_tab", "Compte Soignant")}
                    </Button>
                  </div>
                </CardFooter>
              )}
            </Card>
          )}

          {/* ================================================================= */}
          {/* VIEW 2: PATIENT SIGNUP (3 STEPS + OTP)                           */}
          {/* ================================================================= */}
          {mode === "signup-patient" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="space-y-1.5 pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50">
                    Patient • Étape {patientStep}/3
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t("auth.back_to_login", "Connexion")}
                  </button>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("auth.signup_patient_title", "Inscription Patient")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t("auth.signup_patient_subtitle", "Recherchez des soignants qualifiés et réservez vos soins à domicile")}
                </CardDescription>

                {/* Stepper Progress Bar */}
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className={`h-1.5 rounded-full ${patientStep >= 1 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <div className={`h-1.5 rounded-full ${patientStep >= 2 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <div className={`h-1.5 rounded-full ${patientStep >= 3 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
              </CardHeader>

              <form onSubmit={patientStep === 3 ? handlePatientSignupSubmit : (e) => { e.preventDefault(); setPatientStep((prev) => (prev + 1) as any); }}>
                <CardContent className="space-y-4 pt-1">
                  {/* Step 1: Identity */}
                  {patientStep === 1 && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.first_name_label", "Prénom")} *
                          </label>
                          <Input
                            value={pFirstName}
                            onChange={(e) => setPFirstName(e.target.value)}
                            placeholder="Sidi"
                            required
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.last_name_label", "Nom")} *
                          </label>
                          <Input
                            value={pLastName}
                            onChange={(e) => setPLastName(e.target.value)}
                            placeholder="Mohamed"
                            required
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                            <Calendar className="w-3.5 h-3.5 text-slate-400" />
                            {t("auth.birth_date_label", "Date de naissance")}
                          </label>
                          <Input
                            type="date"
                            value={pBirthDate}
                            onChange={(e) => setPBirthDate(e.target.value)}
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.gender_label", "Sexe")}
                          </label>
                          <select
                            value={pGender}
                            onChange={(e) => setPGender(e.target.value as any)}
                            className="h-10 w-full px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                          >
                            <option value="homme">{t("auth.gender_male", "Homme")}</option>
                            <option value="femme">{t("auth.gender_female", "Femme")}</option>
                          </select>
                        </div>
                      </div>

                      {/* Photo preview and input */}
                      <div className="space-y-1.5 pt-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {t("auth.avatar_label", "Photo de profil (facultative)")}
                        </label>
                        <div className="flex items-center gap-3">
                          <div className="w-12 h-12 rounded-full border border-slate-200 dark:border-slate-700 bg-slate-100 dark:bg-slate-800 flex items-center justify-center overflow-hidden">
                            {avatarPreview ? (
                              <img src={avatarPreview} alt="Avatar" className="w-full h-full object-cover" />
                            ) : (
                              <User className="w-6 h-6 text-slate-400" />
                            )}
                          </div>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() => fileInputRef.current?.click()}
                            className="text-xs gap-1.5"
                          >
                            <Upload className="w-3.5 h-3.5" />
                            Choisir une photo
                          </Button>
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept="image/*"
                            onChange={handleAvatarSelect}
                            className="hidden"
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Step 2: Contact & Address */}
                  {patientStep === 2 && (
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.phone_label", "Téléphone mobile")} *
                        </label>
                        <Input
                          value={pPhone}
                          onChange={(e) => setPPhone(e.target.value)}
                          placeholder="+222 45 12 34 56"
                          required
                          dir="ltr"
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.city_label", "Ville")} *
                        </label>
                        <select
                          value={pCity}
                          onChange={(e) => setPCity(e.target.value)}
                          className="h-10 w-full px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                        >
                          <option value="Nouakchott">Nouakchott (نواكشوط)</option>
                          <option value="Nouadhibou">Nouadhibou (نواذيبو)</option>
                          <option value="Kiffa">Kiffa (كيفة)</option>
                          <option value="Rosso">Rosso (روصو)</option>
                          <option value="Autre">Autre commune</option>
                        </select>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                          {t("auth.address_label", "Quartier / Adresse de résidence")} *
                        </label>
                        <Input
                          value={pAddress}
                          onChange={(e) => setPAddress(e.target.value)}
                          placeholder="Tevragh Zeina, Rue 42"
                          required
                          className="h-10"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 3: Security & Credentials */}
                  {patientStep === 3 && (
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.email_label", "Adresse e-mail")} *
                        </label>
                        <Input
                          type="email"
                          value={pEmail}
                          onChange={(e) => setPEmail(e.target.value)}
                          placeholder="votre.email@domaine.com"
                          required
                          dir="ltr"
                          className="h-10"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            {t("auth.password_label", "Mot de passe")} *
                          </label>
                          <Input
                            type="password"
                            value={pPassword}
                            onChange={(e) => setPPassword(e.target.value)}
                            placeholder="Min. 8 caractères"
                            required
                            dir="ltr"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                            <Lock className="w-3.5 h-3.5 text-slate-400" />
                            {t("auth.confirm_password_label", "Confirmer")} *
                          </label>
                          <Input
                            type="password"
                            value={pConfirmPassword}
                            onChange={(e) => setPConfirmPassword(e.target.value)}
                            placeholder="Confirmer"
                            required
                            dir="ltr"
                            className="h-10"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t("auth.password_hint", "Au moins 8 caractères avec lettres et chiffres.")}
                      </p>

                      <div className="pt-2 flex items-start gap-2.5">
                        <input
                          id="cgu_patient"
                          type="checkbox"
                          checked={pAcceptCgu}
                          onChange={(e) => setPAcceptCgu(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor="cgu_patient" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer">
                          {t("auth.accept_cgu", "J'accepte les conditions générales d'utilisation et la politique de confidentialité de MauriCare.")}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Multi-step Navigation Buttons */}
                  <div className="flex items-center justify-between pt-3 gap-2">
                    {patientStep > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPatientStep((prev) => (prev - 1) as any)}
                        className="h-10 text-xs gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t("auth.btn_back", "Retour")}
                      </Button>
                    ) : (
                      <div />
                    )}

                    {patientStep < 3 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          if (patientStep === 1 && (!pFirstName || !pLastName)) {
                            setFormError("Veuillez renseigner prénom et nom.");
                            return;
                          }
                          setFormError(null);
                          setPatientStep((prev) => (prev + 1) as any);
                        }}
                        className="h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5 font-medium"
                      >
                        {t("auth.btn_next", "Continuer")}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isSubmitting || !pAcceptCgu}
                        className="h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-5"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {t("auth.btn_create_account", "Créer mon compte")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </form>
            </Card>
          )}

          {/* ================================================================= */}
          {/* VIEW 3: PROFESSIONAL SIGNUP (3 STEPS + ONBOARDING DIRECTIVE)      */}
          {/* ================================================================= */}
          {mode === "signup-pro" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="space-y-1.5 pb-4">
                <div className="flex items-center justify-between">
                  <Badge variant="outline" className="text-xs font-semibold text-teal-700 dark:text-teal-400 bg-teal-50/50">
                    Professionnel • Étape {proStep}/3
                  </Badge>
                  <button
                    type="button"
                    onClick={() => setMode("login")}
                    className="text-xs text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 flex items-center gap-1"
                  >
                    <ArrowLeft className="w-3.5 h-3.5" />
                    {t("auth.back_to_login", "Connexion")}
                  </button>
                </div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("auth.signup_pro_title", "Inscription Professionnel de Santé")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t("auth.signup_pro_subtitle", "Rejoignez le réseau mauritanien des praticiens à domicile")}
                </CardDescription>

                <div className="grid grid-cols-3 gap-2 pt-2">
                  <div className={`h-1.5 rounded-full ${proStep >= 1 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <div className={`h-1.5 rounded-full ${proStep >= 2 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                  <div className={`h-1.5 rounded-full ${proStep >= 3 ? "bg-teal-600" : "bg-slate-200 dark:bg-slate-700"}`} />
                </div>
              </CardHeader>

              <form onSubmit={proStep === 3 ? handleProSignupSubmit : (e) => { e.preventDefault(); setProStep((prev) => (prev + 1) as any); }}>
                <CardContent className="space-y-4 pt-1">
                  {/* Step 1: Identity */}
                  {proStep === 1 && (
                    <div className="space-y-3.5">
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.first_name_label", "Prénom")} *
                          </label>
                          <Input
                            value={proFirstName}
                            onChange={(e) => setProFirstName(e.target.value)}
                            placeholder="Ahmedou"
                            required
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.last_name_label", "Nom")} *
                          </label>
                          <Input
                            value={proLastName}
                            onChange={(e) => setProLastName(e.target.value)}
                            placeholder="Bilal"
                            required
                            className="h-10"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Phone className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.phone_label", "Téléphone mobile")} *
                        </label>
                        <Input
                          value={proPhone}
                          onChange={(e) => setProPhone(e.target.value)}
                          placeholder="+222 46 23 45 67"
                          required
                          dir="ltr"
                          className="h-10"
                        />
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1">
                          <Calendar className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.birth_date_label", "Date de naissance")}
                        </label>
                        <Input
                          type="date"
                          value={proBirthDate}
                          onChange={(e) => setProBirthDate(e.target.value)}
                          className="h-10"
                        />
                      </div>
                    </div>
                  )}

                  {/* Step 2: Medical Specialty & City */}
                  {proStep === 2 && (
                    <div className="space-y-3.5">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.specialty_label", "Spécialité médicale")} *
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                          {[
                            { id: "infirmier", label: "Infirmier / Infirmière", desc: "Soins techniques et perfusions" },
                            { id: "aide_soignant", label: "Aide-soignant(e)", desc: "Assistance et hygiène quotidienne" },
                            { id: "medecin", label: "Médecin généraliste", desc: "Consultations et diagnostics" },
                            { id: "kinestherapeute", label: "Kinésithérapeute", desc: "Rééducation et mobilité" },
                          ].map((item) => (
                            <button
                              key={item.id}
                              type="button"
                              onClick={() => setProSpecialty(item.id as any)}
                              className={`p-3 rounded-lg border text-left transition-all ${
                                proSpecialty === item.id
                                  ? "border-teal-600 bg-teal-50/60 dark:bg-teal-950/40 text-teal-900 dark:text-teal-200 shadow-sm"
                                  : "border-slate-200 dark:border-slate-800 hover:border-slate-300"
                              }`}
                            >
                              <div className="text-xs font-semibold">{item.label}</div>
                              <div className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">{item.desc}</div>
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.city_label", "Ville principale d'intervention")} *
                        </label>
                        <select
                          value={proCity}
                          onChange={(e) => setProCity(e.target.value)}
                          className="h-10 w-full px-3 rounded-md border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 text-sm"
                        >
                          <option value="Nouakchott">Nouakchott (نواكشوط)</option>
                          <option value="Nouadhibou">Nouadhibou (نواذيبو)</option>
                          <option value="Kiffa">Kiffa (كيفة)</option>
                          <option value="Rosso">Rosso (روصو)</option>
                        </select>
                      </div>
                    </div>
                  )}

                  {/* Step 3: Security & CGU */}
                  {proStep === 3 && (
                    <div className="space-y-3.5">
                      <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                          <Mail className="w-3.5 h-3.5 text-slate-400" />
                          {t("auth.email_label", "Adresse e-mail professionnelle")} *
                        </label>
                        <Input
                          type="email"
                          value={proEmail}
                          onChange={(e) => setProEmail(e.target.value)}
                          placeholder="praticien@domaine.com"
                          required
                          dir="ltr"
                          className="h-10"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.password_label", "Mot de passe")} *
                          </label>
                          <Input
                            type="password"
                            value={proPassword}
                            onChange={(e) => setProPassword(e.target.value)}
                            placeholder="Min. 8 caractères"
                            required
                            dir="ltr"
                            className="h-10"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                            {t("auth.confirm_password_label", "Confirmer")} *
                          </label>
                          <Input
                            type="password"
                            value={proConfirmPassword}
                            onChange={(e) => setProConfirmPassword(e.target.value)}
                            placeholder="Confirmer"
                            required
                            dir="ltr"
                            className="h-10"
                          />
                        </div>
                      </div>
                      <p className="text-[11px] text-slate-500">
                        {t("auth.password_hint", "Au moins 8 caractères avec lettres et chiffres.")}
                      </p>

                      <div className="pt-2 flex items-start gap-2.5">
                        <input
                          id="cgu_pro"
                          type="checkbox"
                          checked={proAcceptCgu}
                          onChange={(e) => setProAcceptCgu(e.target.checked)}
                          className="mt-1 w-4 h-4 rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor="cgu_pro" className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed cursor-pointer">
                          {t("auth.accept_cgu", "J'accepte les conditions générales d'utilisation et la politique de confidentialité de MauriCare.")}
                        </label>
                      </div>
                    </div>
                  )}

                  {/* Navigation Buttons */}
                  <div className="flex items-center justify-between pt-3 gap-2">
                    {proStep > 1 ? (
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setProStep((prev) => (prev - 1) as any)}
                        className="h-10 text-xs gap-1.5"
                      >
                        <ArrowLeft className="w-3.5 h-3.5" />
                        {t("auth.btn_back", "Retour")}
                      </Button>
                    ) : (
                      <div />
                    )}

                    {proStep < 3 ? (
                      <Button
                        type="button"
                        onClick={() => {
                          if (proStep === 1 && (!proFirstName || !proLastName)) {
                            setFormError("Veuillez renseigner prénom et nom.");
                            return;
                          }
                          setFormError(null);
                          setProStep((prev) => (prev + 1) as any);
                        }}
                        className="h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs gap-1.5 font-medium"
                      >
                        {t("auth.btn_next", "Continuer")}
                        <ArrowRight className="w-3.5 h-3.5" />
                      </Button>
                    ) : (
                      <Button
                        type="submit"
                        disabled={isSubmitting || !proAcceptCgu}
                        className="h-10 bg-teal-600 hover:bg-teal-700 text-white text-xs font-semibold px-5"
                      >
                        {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                        {t("auth.btn_create_account", "Créer mon compte")}
                      </Button>
                    )}
                  </div>
                </CardContent>
              </form>
            </Card>
          )}

          {/* ================================================================= */}
          {/* VIEW 4: EMAIL OTP VERIFICATION                                    */}
          {/* ================================================================= */}
          {mode === "verify-email-otp" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900 text-center">
              <CardHeader className="space-y-2 pb-4">
                <div className="mx-auto w-12 h-12 rounded-full bg-teal-50 dark:bg-teal-950/60 border border-teal-200 dark:border-teal-800 flex items-center justify-center text-teal-600">
                  <Mail className="w-6 h-6" />
                </div>
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("auth.verify_title", "Vérifiez votre e-mail")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t("auth.verify_subtitle_1", "Nous avons envoyé un code de confirmation à")}
                  <div className="font-semibold text-slate-800 dark:text-slate-200 mt-0.5">{verifyEmailAddress}</div>
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleVerifyEmailOtpSubmit}>
                <CardContent className="space-y-5 pt-2">
                  <div className="flex justify-center">
                    <InputOTP
                      maxLength={6}
                      value={verifyOtpCode}
                      onChange={(val) => setVerifyOtpCode(val)}
                      disabled={isSubmitting}
                    >
                      <InputOTPGroup className="gap-2">
                        <InputOTPSlot index={0} className="w-11 h-12 text-lg font-mono" />
                        <InputOTPSlot index={1} className="w-11 h-12 text-lg font-mono" />
                        <InputOTPSlot index={2} className="w-11 h-12 text-lg font-mono" />
                        <InputOTPSlot index={3} className="w-11 h-12 text-lg font-mono" />
                        <InputOTPSlot index={4} className="w-11 h-12 text-lg font-mono" />
                        <InputOTPSlot index={5} className="w-11 h-12 text-lg font-mono" />
                      </InputOTPGroup>
                    </InputOTP>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || verifyOtpCode.length !== 6}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t("auth.verify_btn", "Confirmer mon compte")}
                  </Button>

                  <div className="flex items-center justify-center gap-2 text-xs text-slate-500">
                    <span>{t("auth.not_received", "Vous n'avez pas reçu le code ?")}</span>
                    <button
                      type="button"
                      disabled={countdown > 0}
                      onClick={handleResendEmailOtp}
                      className="font-semibold text-teal-600 dark:text-teal-400 hover:underline disabled:opacity-50"
                    >
                      {countdown > 0 ? `Renvoyer (${countdown}s)` : t("auth.resend_code", "Renvoyer le code")}
                    </button>
                  </div>
                </CardContent>
              </form>

              <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {t("auth.back_to_login", "Retour à la connexion")}
                </button>
              </CardFooter>
            </Card>
          )}

          {/* ================================================================= */}
          {/* VIEW 5: FORGOT PASSWORD (EMAIL INPUT)                             */}
          {/* ================================================================= */}
          {mode === "forgot-password" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="space-y-1.5 pb-4">
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("auth.forgot_password_title", "Mot de passe oublié")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t("auth.forgot_password_subtitle", "Saisissez votre e-mail pour recevoir votre code de sécurité à 6 chiffres")}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleForgotPasswordSubmit}>
                <CardContent className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300 flex items-center gap-1.5">
                      <Mail className="w-3.5 h-3.5 text-slate-400" />
                      {t("auth.email_label", "Adresse e-mail")}
                    </label>
                    <Input
                      type="email"
                      value={forgotEmail}
                      onChange={(e) => setForgotEmail(e.target.value)}
                      placeholder="votre.email@domaine.com"
                      required
                      dir="ltr"
                      className="h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t("auth.btn_send_reset_code", "Envoyer le code de réinitialisation")}
                  </Button>
                </CardContent>
              </form>

              <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 flex items-center gap-1"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  {t("auth.back_to_login", "Retour à la connexion")}
                </button>
              </CardFooter>
            </Card>
          )}

          {/* ================================================================= */}
          {/* VIEW 6: RESET PASSWORD (OTP + NEW PASSWORD)                       */}
          {/* ================================================================= */}
          {mode === "reset-password-otp" && (
            <Card className="border-slate-200/90 dark:border-slate-800 shadow-xl bg-white dark:bg-slate-900">
              <CardHeader className="space-y-1.5 pb-4">
                <CardTitle className="text-xl font-bold text-slate-900 dark:text-white">
                  {t("auth.reset_password_title", "Nouveau mot de passe")}
                </CardTitle>
                <CardDescription className="text-xs text-slate-500">
                  {t("auth.reset_password_subtitle", "Entrez le code reçu par e-mail et choisissez votre nouveau mot de passe")}
                </CardDescription>
              </CardHeader>

              <form onSubmit={handleConfirmPasswordResetSubmit}>
                <CardContent className="space-y-4 pt-1">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      Code de sécurité reçu (6 chiffres)
                    </label>
                    <Input
                      type="text"
                      maxLength={6}
                      value={resetOtp}
                      onChange={(e) => setResetOtp(e.target.value.trim())}
                      placeholder="123456"
                      required
                      dir="ltr"
                      className="h-10 font-mono tracking-widest text-center text-base"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t("auth.new_password_label", "Nouveau mot de passe")}
                    </label>
                    <Input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Min. 8 caractères"
                      required
                      dir="ltr"
                      className="h-10"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-slate-700 dark:text-slate-300">
                      {t("auth.confirm_password_label", "Confirmer le mot de passe")}
                    </label>
                    <Input
                      type="password"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      placeholder="Confirmer"
                      required
                      dir="ltr"
                      className="h-10"
                    />
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting}
                    className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-medium"
                  >
                    {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
                    {t("auth.btn_confirm_reset", "Mettre à jour le mot de passe")}
                  </Button>
                </CardContent>
              </form>

              <CardFooter className="justify-center border-t border-slate-100 dark:border-slate-800 pt-3">
                <button
                  type="button"
                  onClick={() => setMode("login")}
                  className="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300"
                >
                  {t("auth.back_to_login", "Annuler et revenir à la connexion")}
                </button>
              </CardFooter>
            </Card>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="py-4 text-center text-xs text-slate-400 dark:text-slate-600 border-t border-slate-200/60 dark:border-slate-800/60">
        © 2026 MauriCare. {t("auth.footer", "Soins de santé à domicile en Mauritanie")}
      </footer>
    </div>
  );
}
