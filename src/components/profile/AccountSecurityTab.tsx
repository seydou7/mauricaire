import { useState } from "react";
import { useQuery, useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { validatePasswordRequirements, sanitizeAuthError } from "@/lib/authValidation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  KeyRound,
  Mail,
  Smartphone,
  History,
  AlertTriangle,
  Loader2,
  CheckCircle2,
  XCircle,
  LogOut,
  RefreshCw,
  Lock,
  ArrowRight,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";

interface AccountSecurityTabProps {
  currentEmail?: string;
  role?: string;
  onSignedOut?: () => void;
}

export function AccountSecurityTab({ currentEmail, role, onSignedOut }: AccountSecurityTabProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  // Actions & Mutations
  const changePasswordAction = useAction(api.accountSecurity.changePassword);
  const requestEmailChangeAction = useAction(api.accountSecurity.requestEmailChange);
  const confirmEmailChangeAction = useAction(api.accountSecurity.confirmEmailChange);
  const logoutOtherSessionsAction = useAction(api.accountSecurity.logoutOtherSessions);
  const deactivateAccountMutation = useMutation(api.accountSecurity.deactivateAccount);

  // Queries
  const sessions = useQuery(api.accountSecurity.getActiveSessions) || [];
  const auditLogs = useQuery(api.accountSecurity.getSecurityAuditTrail) || [];

  // Password State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isChangingPassword, setIsChangingPassword] = useState(false);

  // Email Change State
  const [newEmail, setNewEmail] = useState("");
  const [reauthPassword, setReauthPassword] = useState("");
  const [isRequestingEmail, setIsRequestingEmail] = useState(false);
  const [emailOtpSent, setEmailOtpSent] = useState(false);
  const [emailOtpCode, setEmailOtpCode] = useState("");
  const [isConfirmingEmail, setIsConfirmingEmail] = useState(false);

  // Sessions State
  const [isLoggingOutOthers, setIsLoggingOutOthers] = useState(false);

  // Deactivation State
  const [deactivateModalOpen, setDeactivateModalOpen] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [isDeactivating, setIsDeactivating] = useState(false);

  // Handle Change Password
  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) {
      toast.error("Veuillez saisir votre mot de passe actuel.");
      return;
    }
    const passwordCheck = validatePasswordRequirements(newPassword);
    if (!passwordCheck.isValid) {
      toast.error(t(passwordCheck.errorKey, passwordCheck.defaultMessage));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("auth.passwords_dont_match", "Les deux mots de passe ne correspondent pas."));
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("Le nouveau mot de passe doit être différent de l'actuel.");
      return;
    }

    setIsChangingPassword(true);
    try {
      const res = await changePasswordAction({
        currentPassword,
        newPassword,
      });
      toast.success(res.message);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err: any) {
      toast.error(sanitizeAuthError(err, t, "Erreur lors du changement de mot de passe."));
    } finally {
      setIsChangingPassword(false);
    }
  };

  // Handle Request Email Change
  const handleRequestEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEmail.trim() || !newEmail.includes("@")) {
      toast.error("Veuillez saisir une adresse e-mail valide.");
      return;
    }

    setIsRequestingEmail(true);
    try {
      const res = await requestEmailChangeAction({
        newEmail: newEmail.trim(),
        currentPassword: reauthPassword || undefined,
      });
      toast.success(res.message);
      setEmailOtpSent(true);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la demande de modification d'e-mail.");
    } finally {
      setIsRequestingEmail(false);
    }
  };

  // Handle Confirm Email Change
  const handleConfirmEmailChange = async (e: React.FormEvent) => {
    e.preventDefault();
    if (emailOtpCode.trim().length !== 6) {
      toast.error("Veuillez saisir le code à 6 chiffres reçu par e-mail.");
      return;
    }

    setIsConfirmingEmail(true);
    try {
      const res = await confirmEmailChangeAction({
        code: emailOtpCode.trim(),
      });
      toast.success(res.message);
      setEmailOtpSent(false);
      setNewEmail("");
      setEmailOtpCode("");
      setReauthPassword("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la validation du code.");
    } finally {
      setIsConfirmingEmail(false);
    }
  };

  // Handle Logout Others
  const handleLogoutOthers = async () => {
    setIsLoggingOutOthers(true);
    try {
      const res = await logoutOtherSessionsAction();
      toast.success(res.message);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la déconnexion des sessions.");
    } finally {
      setIsLoggingOutOthers(false);
    }
  };

  // Handle Deactivate Account
  const handleConfirmDeactivate = async () => {
    if (confirmText.trim().toUpperCase() !== "DESACTIVER") {
      toast.error("Veuillez taper 'DESACTIVER' pour confirmer.");
      return;
    }

    setIsDeactivating(true);
    try {
      const res = await deactivateAccountMutation({ confirmText });
      toast.success(res.message);
      setDeactivateModalOpen(false);
      if (onSignedOut) onSignedOut();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la désactivation du compte.");
    } finally {
      setIsDeactivating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-3xl" dir={isRtl ? "rtl" : "ltr"}>
      {/* 1. Password Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-primary" />
            {t("security.password_title", "Modifier mon mot de passe")}
          </CardTitle>
          <CardDescription className="text-xs">
            {t(
              "security.password_desc",
              "Pour votre sécurité, choisissez un mot de passe robuste d'au moins 8 caractères combinant lettres et chiffres."
            )}
          </CardDescription>
        </CardHeader>

        <form onSubmit={handleChangePassword}>
          <CardContent className="space-y-3.5 text-xs">
            <div className="space-y-1">
              <label className="font-semibold text-foreground">Mot de passe actuel *</label>
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nouveau mot de passe *</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t("profile.confirm_new_password", "Confirmer le nouveau mot de passe *")}</label>
                <input
                  type="password"
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Min. 8 caractères"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
            <p className="text-[11px] text-muted-foreground mt-1.5">
              {t("auth.password_hint", "Au moins 8 caractères avec lettres et chiffres.")}
            </p>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/40 flex justify-end">
            <Button
              type="submit"
              size="sm"
              disabled={isChangingPassword || !currentPassword || !newPassword}
              className="rounded-xl text-xs gap-1.5"
            >
              {isChangingPassword ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <Lock className="h-3.5 w-3.5" />}
              Mettre à jour le mot de passe
            </Button>
          </CardFooter>
        </form>
      </Card>

      {/* 2. Email Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Mail className="h-4 w-4 text-primary" />
            {t("security.email_title", "Adresse e-mail du compte")}
          </CardTitle>
          <CardDescription className="text-xs">
            Adresse actuelle : <strong className="text-foreground">{currentEmail || "Non renseignée"}</strong>
          </CardDescription>
        </CardHeader>

        {!emailOtpSent ? (
          <form onSubmit={handleRequestEmailChange}>
            <CardContent className="space-y-3.5 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Nouvelle adresse e-mail *</label>
                <input
                  type="email"
                  required
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="nouvelle.adresse@exemple.mr"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">
                  Mot de passe actuel (par sécurité)
                </label>
                <input
                  type="password"
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/40 flex justify-end">
              <Button
                type="submit"
                size="sm"
                disabled={isRequestingEmail || !newEmail.trim()}
                className="rounded-xl text-xs gap-1.5"
              >
                {isRequestingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <ArrowRight className="h-3.5 w-3.5" />}
                Envoyer le code de validation
              </Button>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={handleConfirmEmailChange}>
            <CardContent className="space-y-3.5 text-xs">
              <div className="p-3 rounded-xl bg-primary/10 border border-primary/20 text-xs">
                Un code à 6 chiffres a été envoyé à <strong>{newEmail}</strong>. Veuillez le saisir pour confirmer le changement.
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t("profile.code_6_digits", "Code de confirmation à 6 chiffres *")}</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={emailOtpCode}
                  onChange={(e) => setEmailOtpCode(e.target.value.replace(/\D/g, ""))}
                  placeholder="123456"
                  className="w-full h-10 px-3 rounded-xl border border-border/50 bg-background text-center text-base tracking-widest font-mono font-bold focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </CardContent>

            <CardFooter className="pt-2 border-t border-border/40 flex items-center justify-between">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setEmailOtpSent(false);
                  setEmailOtpCode("");
                }}
                className="rounded-xl text-xs"
              >
                Changer d'adresse
              </Button>

              <Button
                type="submit"
                size="sm"
                disabled={isConfirmingEmail || emailOtpCode.length !== 6}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                {isConfirmingEmail ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Confirmer le nouvel e-mail
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>

      {/* 3. Sessions Section */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Smartphone className="h-4 w-4 text-primary" />
                {t("security.sessions_title", "Sessions actives")}
              </CardTitle>
              <CardDescription className="text-xs">
                {t(
                  "security.sessions_desc",
                  "Consultez les sessions ouvertes sur votre compte et déconnectez les autres appareils."
                )}
              </CardDescription>
            </div>

            {sessions.length > 1 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleLogoutOthers}
                disabled={isLoggingOutOthers}
                className="rounded-xl text-xs gap-1.5 self-start sm:self-auto border-destructive/20 text-destructive hover:bg-destructive/10"
              >
                {isLoggingOutOthers ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : <LogOut className="h-3 w-3" />}
                Déconnecter les autres sessions
              </Button>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-2 text-xs">
          {sessions.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t("profile.no_active_sessions", "Aucune session active enregistrée.")}</p>
          ) : (
            sessions.map((s: any) => (
              <div
                key={s.sessionId}
                className="p-3 rounded-xl border border-border/40 bg-muted/20 flex items-center justify-between"
              >
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-foreground">
                      Session ouverte le {new Date(s.createdAt).toLocaleDateString()} à {new Date(s.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                    </span>
                    {s.isCurrent && (
                      <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        Cette session (actuelle)
                      </Badge>
                    )}
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    Valide jusqu'au {new Date(s.expirationTime).toLocaleDateString()}
                  </p>
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 4. Security Audit History */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4 text-primary" />
            {t("security.history_title", "Historique de sécurité du compte")}
          </CardTitle>
          <CardDescription className="text-xs">
            Journal immuable des événements sensibles liés à votre identité et vos accès.
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-2 text-xs">
          {auditLogs.length === 0 ? (
            <p className="text-muted-foreground text-center py-4">{t("profile.no_security_events", "Aucun événement de sécurité récent.")}</p>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {auditLogs.map((log: any) => (
                <div
                  key={log._id}
                  className="p-2.5 rounded-xl border border-border/30 bg-muted/15 flex items-center justify-between text-[11px]"
                >
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[9px] uppercase font-bold tracking-wider">
                      {log.eventType.replace(/_/g, " ")}
                    </Badge>
                    {log.metadata?.targetEmail && (
                      <span className="text-muted-foreground font-mono">({log.metadata.targetEmail})</span>
                    )}
                  </div>
                  <span className="text-muted-foreground">
                    {new Date(log.timestamp).toLocaleDateString()} • {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 5. Danger Zone: Deactivation */}
      {role !== "admin" && (
        <Card className="border-rose-500/20 bg-rose-500/[0.02] shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2 text-rose-600">
              <AlertTriangle className="h-4 w-4" />
              Zone sensible : Suspension de compte
            </CardTitle>
            <CardDescription className="text-xs text-muted-foreground">
              Vous pouvez suspendre temporairement votre compte. Vos historiques médicaux, ordonnances et rendez-vous passés demeurent protégés et archivés légalement.
            </CardDescription>
          </CardHeader>

          <CardFooter className="pt-2 border-t border-rose-500/10 flex justify-end">
            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setConfirmText("");
                setDeactivateModalOpen(true);
              }}
              className="rounded-xl text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20"
            >
              Suspendre mon compte
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* Deactivation Modal */}
      <Dialog open={deactivateModalOpen} onOpenChange={setDeactivateModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" />
              Confirmation de suspension de compte
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Votre profil sera désactivé et masqué de l'annuaire. Pour confirmer cette opération, veuillez saisir <strong>DESACTIVER</strong> ci-dessous :
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2 text-xs">
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder="DESACTIVER"
              className="w-full h-10 px-3 rounded-xl border border-destructive/40 bg-background text-xs font-mono font-bold focus:outline-none focus:ring-2 focus:ring-destructive/20"
            />
          </div>

          <DialogFooter className="gap-2 pt-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setDeactivateModalOpen(false)}
              className="rounded-xl text-xs"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeactivating || confirmText.trim().toUpperCase() !== "DESACTIVER"}
              onClick={handleConfirmDeactivate}
              className="rounded-xl text-xs"
            >
              {isDeactivating ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirmer la suspension
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
