import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSlot,
} from "@/components/ui/input-otp";

import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { ArrowRight, Heart, Loader2, Mail, UserX } from "lucide-react";
import { Suspense, useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";

interface AuthProps {
  redirectAfterAuth?: string;
}

function Auth({ redirectAfterAuth }: AuthProps = {}) {
  const { t } = useTranslation();
  const { isLoading: authLoading, isAuthenticated, signIn } = useAuth();
  const navigate = useNavigate();
  const [step, setStep] = useState<"signIn" | { email: string; role: string }>("signIn");
  const [otp, setOtp] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && isAuthenticated) {
      const redirect = redirectAfterAuth || "/dashboard";
      navigate(redirect);
    }
  }, [authLoading, isAuthenticated, navigate, redirectAfterAuth]);

  const handleEmailSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      await signIn("email-otp", formData);
      setStep({ email: formData.get("email") as string, role: formData.get("role") as string });
      setIsLoading(false);
    } catch (error) {
      console.error("Erreur de connexion:", error);
      setError(
        error instanceof Error
          ? error.message
          : "Échec de l'envoi du code. Veuillez réessayer.",
      );
      setIsLoading(false);
    }
  };

  const handleOtpSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsLoading(true);
    setError(null);
    try {
      const formData = new FormData(event.currentTarget);
      const role = formData.get("role") as string;
      if (role) {
        localStorage.setItem("userRole", role === "aide-soignant" ? "professionnel" : "patient");
      }
      await signIn("email-otp", formData);

      const redirect = redirectAfterAuth || "/dashboard";
      navigate(redirect);
    } catch (error) {
      console.error("Erreur de vérification:", error);

      setError(t("auth.error_wrong_code"));
      setIsLoading(false);
      setOtp("");
    }
  };

  const handleGuestLogin = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const selectedRole = document.querySelector<HTMLInputElement>('input[name="role"]:checked')?.value || "patient";
      localStorage.setItem("userRole", selectedRole === "aide-soignant" ? "professionnel" : "patient");

      await signIn("anonymous");
      const redirect = redirectAfterAuth || "/dashboard";
      navigate(redirect);
    } catch (error) {
      console.error("Erreur de connexion invité:", error);
      setError(`Échec de la connexion en tant qu'invité: ${error instanceof Error ? error.message : 'Erreur inconnue'}`);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-b from-background to-primary/5">
      {/* Auth Content */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <div className="flex items-center justify-center h-full flex-col w-full max-w-[420px]">
          <Card className="w-full border-primary/20 shadow-xl shadow-primary/5 bg-card/95 backdrop-blur-sm">
            {step === "signIn" ? (
              <>
                <CardHeader className="text-center pb-6">
                  <div className="flex justify-center mb-4">
                    <div className="flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/10">
                      <img
                        src={logo}
                        alt={t("app.title")}
                        width={36}
                        height={36}
                        className="cursor-pointer"
                        onClick={() => navigate("/")}
                      />
                    </div>
                  </div>
                  <CardTitle className="text-2xl font-bold">{t("auth.title")}</CardTitle>
                  <CardDescription className="text-sm mt-2">
                    {t("auth.subtitle")}
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleEmailSubmit}>
                  <CardContent className="space-y-4">
                    <div className="flex gap-4 mb-2">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="role" value="patient" defaultChecked className="accent-primary" />
                        <span className="text-sm">Patient</span>
                      </label>
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input type="radio" name="role" value="aide-soignant" className="accent-primary" />
                        <span className="text-sm">Aide-soignant</span>
                      </label>
                    </div>
                    <div className="relative flex items-center gap-2">
                      <div className="relative flex-1">
                        <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground rtl:right-3 rtl:left-auto" />
                        <Input
                          name="email"
                          placeholder={t("auth.email_placeholder")}
                          type="email"
                          className="pl-9 rtl:pr-9 rtl:pl-3 h-11"
                          disabled={isLoading}
                          required
                        />
                      </div>
                      <Button
                        type="submit"
                        variant="default"
                        size="icon"
                        disabled={isLoading}
                        className="h-11 w-11 shrink-0 bg-primary hover:bg-primary/90 text-primary-foreground"
                      >
                        {isLoading ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                        )}
                      </Button>
                    </div>
                    {error && (
                      <p className="mt-3 text-sm text-destructive">{error}</p>
                    )}

                    <div className="mt-6">
                      <div className="relative">
                        <div className="absolute inset-0 flex items-center">
                          <span className="w-full border-t border-border/60" />
                        </div>
                        <div className="relative flex justify-center text-xs uppercase">
                          <span className="bg-card/95 px-3 text-muted-foreground">
                            {t("auth.or")}
                          </span>
                        </div>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        className="w-full mt-4 h-11 border-border/60 hover:bg-muted/50"
                        onClick={handleGuestLogin}
                        disabled={isLoading}
                      >
                        <UserX className="mx-2 h-4 w-4" />
                        {t("auth.guest_login")}
                      </Button>
                    </div>
                  </CardContent>
                </form>
              </>
            ) : (
              <>
                <CardHeader className="text-center pt-8">
                  <div className="flex justify-center mb-3">
                    <div className="flex items-center justify-center w-12 h-12 rounded-full bg-primary/10">
                      <Mail className="h-5 w-5 text-primary" />
                    </div>
                  </div>
                  <CardTitle className="text-xl">{t("auth.verify_title")}</CardTitle>
                  <CardDescription className="text-sm mt-2">
                    {t("auth.verify_subtitle_1")}{" "}
                    <span className="font-medium text-foreground">{step.email}</span>
                  </CardDescription>
                </CardHeader>
                <form onSubmit={handleOtpSubmit}>
                  <CardContent className="pb-4">
                    <input type="hidden" name="email" value={step.email} />
                    <input type="hidden" name="role" value={step.role} />
                    <input type="hidden" name="code" value={otp} />

                    <div className="flex justify-center my-4" dir="ltr">
                      <InputOTP
                        value={otp}
                        onChange={setOtp}
                        maxLength={6}
                        disabled={isLoading}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" && otp.length === 6 && !isLoading) {
                            const form = (e.target as HTMLElement).closest("form");
                            if (form) {
                              form.requestSubmit();
                            }
                          }
                        }}
                      >
                        <InputOTPGroup>
                          {Array.from({ length: 6 }).map((_, index) => (
                            <InputOTPSlot key={index} index={index} />
                          ))}
                        </InputOTPGroup>
                      </InputOTP>
                    </div>
                    {error && (
                      <p className="mt-2 text-sm text-destructive text-center">
                        {error}
                      </p>
                    )}
                    <p className="text-sm text-muted-foreground text-center mt-4">
                      {t("auth.not_received")}{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-primary"
                        onClick={() => setStep("signIn")}
                      >
                        {t("auth.retry")}
                      </Button>
                    </p>
                  </CardContent>
                  <CardFooter className="flex-col gap-2 px-6 pb-6">
                    <Button
                      type="submit"
                      className="w-full h-11 text-base bg-primary hover:bg-primary/90 text-primary-foreground"
                      disabled={isLoading || otp.length !== 6}
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="mx-2 h-4 w-4 animate-spin" />
                          {t("auth.verifying_btn")}
                        </>
                      ) : (
                        <>
                          {t("auth.verify_btn")}
                          <ArrowRight className="mx-2 h-4 w-4 rtl:rotate-180" />
                        </>
                      )}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setStep("signIn")}
                      disabled={isLoading}
                      className="w-full h-11 text-muted-foreground hover:bg-muted/50"
                    >
                      {t("auth.another_email")}
                    </Button>
                  </CardFooter>
                </form>
              </>
            )}

            <div className="py-4 px-6 text-xs text-center text-muted-foreground bg-primary/5 border-t border-primary/10 rounded-b-lg flex items-center justify-center gap-1.5">
              <Heart className="h-3 w-3 text-primary" />
              {t("auth.footer")}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

export default function AuthPage(props: AuthProps) {
  return (
    <Suspense fallback={<div className="h-screen w-full flex items-center justify-center"><Loader2 className="animate-spin text-primary w-8 h-8"/></div>}>
      <Auth {...props} />
    </Suspense>
  );
}
