import React, { useState } from "react";
import { useParams, useNavigate, Link } from "react-router";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { useTranslation } from "react-i18next";
import {
  HeartHandshake,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Calendar,
  Clock,
  Bell,
  FileText,
  Activity,
  ArrowRight,
  ShieldCheck,
  User,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";

const PERMISSION_EXPLANATIONS: Record<string, { label: string; desc: string }> = {
  VIEW_APPOINTMENTS: {
    label: "Voir les rendez-vous",
    desc: "Consulter les dates, heures, soignants et statuts des soins",
  },
  BOOK_APPOINTMENTS: {
    label: "Réserver des consultations",
    desc: "Programmer des soins à domicile pour ce patient",
  },
  MANAGE_APPOINTMENTS: {
    label: "Gérer et annuler",
    desc: "Modifier ou annuler les rendez-vous selon les besoins",
  },
  RECEIVE_APPOINTMENT_NOTIFICATIONS: {
    label: "Recevoir les alertes de suivi",
    desc: "Être informé(e) des confirmations, rappels et visites terminées",
  },
  VIEW_CARE_SUMMARY: {
    label: "Consulter les comptes-rendus de visite",
    desc: "Lire le récapitulatif simplifié après le passage du soignant",
  },
  VIEW_SELECTED_HEALTH_DATA: {
    label: "Données de santé autorisées",
    desc: "Accéder aux informations de suivi clinique déléguées",
  },
};

export default function AcceptInvitation() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { isAuthenticated, isLoading: authLoading } = useAuth();

  const [isSubmitting, setIsSubmitting] = useState(false);

  const invitationData = useQuery(
    api.circle.getInvitationByToken,
    token ? { token } : "skip"
  );

  const acceptMutation = useMutation(api.circle.acceptInvitation);
  const declineMutation = useMutation(api.circle.declineInvitation);

  const handleAccept = async () => {
    if (!token) return;
    setIsSubmitting(true);
    try {
      await acceptMutation({ token });
      toast.success("Félicitations ! Vous faites désormais partie du Cercle MauriCare.");
      navigate("/dashboard");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'acceptation de l'invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDecline = async () => {
    if (!token) return;
    if (!confirm("Voulez-vous vraiment décliner cette invitation ?")) return;
    setIsSubmitting(true);
    try {
      await declineMutation({ token });
      toast.info("L'invitation a été déclinée.");
      navigate("/");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du refus de l'invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!token) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6">
          <AlertTriangle className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h2 className="text-lg font-bold text-slate-800">Lien d'invitation manquant</h2>
          <p className="text-sm text-slate-500 mt-2">
            Le lien utilisé ne contient aucun jeton d'invitation valide.
          </p>
          <Button onClick={() => navigate("/")} className="mt-4 bg-teal-700 hover:bg-teal-800">
            Retour à l'accueil
          </Button>
        </Card>
      </div>
    );
  }

  if (invitationData === undefined || authLoading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  if (!invitationData.valid) {
    const isExpired = invitationData.reason === "expired";
    const isAccepted = invitationData.reason === "accepted";
    const isCancelled = invitationData.reason === "cancelled";

    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <Card className="max-w-md w-full text-center p-6 space-y-4">
          {isAccepted ? (
            <CheckCircle2 className="w-12 h-12 text-emerald-600 mx-auto" />
          ) : (
            <XCircle className="w-12 h-12 text-red-500 mx-auto" />
          )}
          <h2 className="text-lg font-bold text-slate-800">
            {isAccepted
              ? "Invitation déjà acceptée"
              : isExpired
              ? "Invitation expirée"
              : isCancelled
              ? "Invitation annulée"
              : "Invitation invalide ou introuvable"}
          </h2>
          <p className="text-sm text-slate-500">
            {isAccepted
              ? "Cette invitation a déjà été acceptée. Vous pouvez accéder directement à votre espace."
              : isExpired
              ? "Ce lien d'invitation a dépassé sa durée de validité de 7 jours. Veuillez demander au patient de vous renvoyer une nouvelle invitation."
              : isCancelled
              ? "Cette invitation a été annulée par le patient."
              : "Ce lien d'invitation est introuvable ou a été révoqué."}
          </p>
          <Button
            onClick={() => navigate(isAuthenticated ? "/dashboard" : "/")}
            className="w-full bg-teal-700 hover:bg-teal-800"
          >
            {isAuthenticated ? "Accéder à mon tableau de bord" : "Retour à l'accueil"}
          </Button>
        </Card>
      </div>
    );
  }

  const { invitation, patient } = invitationData;

  return (
    <div className="min-h-screen bg-slate-50 py-12 px-4 flex items-center justify-center">
      <Card className="max-w-xl w-full border border-slate-200 shadow-md rounded-2xl overflow-hidden bg-white">
        <div className="bg-gradient-to-r from-teal-700 to-emerald-800 p-6 text-white text-center">
          <div className="w-16 h-16 rounded-full bg-white/20 backdrop-blur-sm mx-auto flex items-center justify-center mb-3">
            <HeartHandshake className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold">Rejoindre le Cercle MauriCare</h1>
          <p className="text-teal-100 text-xs mt-1">
            Coordination familiale des soins de santé à domicile en Mauritanie
          </p>
        </div>

        <CardContent className="p-6 space-y-6">
          {/* Patient Card */}
          <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-xl">
              {patient?.name?.charAt(0) || "P"}
            </div>
            <div>
              <p className="text-xs text-slate-500 uppercase tracking-wider font-semibold">
                Invitation émise par
              </p>
              <h3 className="text-base font-bold text-slate-900">{patient?.name}</h3>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                  {String(t(`circle.relationships.${invitation?.relationship || "other"}` as any, invitation?.relationship || "Autre"))}
                </Badge>
                {(patient?.neighborhood || patient?.city) && (
                  <span className="text-xs text-slate-500">
                    {[patient?.neighborhood, patient?.city].filter(Boolean).join(", ")}
                  </span>
                )}
              </div>
            </div>
          </div>

          {/* Requested Permissions List */}
          <div>
            <h4 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Autorisations confiées dans ce mandat :
            </h4>
            <div className="space-y-2.5">
              {invitation?.permissions?.map((pKey: string) => {
                const info = PERMISSION_EXPLANATIONS[pKey] || {
                  label: pKey,
                  desc: "Autorisation spécifique accordée par le patient",
                };
                return (
                  <div
                    key={pKey}
                    className="flex items-start gap-3 p-3 rounded-lg border border-slate-100 bg-emerald-50/40 text-xs"
                  >
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
                    <div>
                      <span className="font-semibold text-slate-900">{info.label}</span>
                      <p className="text-slate-500 text-[11px] mt-0.5">{info.desc}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Medical Privacy Reassurance (Section 3, 11, 33) */}
          <div className="flex items-start gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
            <ShieldCheck className="w-5 h-5 text-teal-600 shrink-0 mt-0.5" />
            <p>
              <strong>Confidentialité médicale garantie :</strong> Ce mandat vous permet d'aider à la logistique des soins sans accéder au dossier médical complet ou aux données sensibles sans consentement direct du patient.
            </p>
          </div>

          {/* Authentication Prompt if not logged in */}
          {!isAuthenticated && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 space-y-3">
              <div className="font-semibold flex items-center gap-1.5">
                <User className="w-4 h-4" />
                Connexion requise pour valider l'invitation
              </div>
              <p>
                Pour garantir la sécurité et l'authenticité de ce mandat, vous devez vous connecter ou créer votre compte MauriCare.
              </p>
              <Link
                to={`/auth?redirect=/circle/invite/${token}`}
                className="inline-flex items-center gap-1.5 bg-amber-700 hover:bg-amber-800 text-white font-medium px-4 py-2 rounded-lg text-xs transition-colors"
              >
                Se connecter / Créer un compte
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          )}
        </CardContent>

        {isAuthenticated && (
          <CardFooter className="bg-slate-50 border-t border-slate-100 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
            <Button
              variant="ghost"
              onClick={handleDecline}
              disabled={isSubmitting}
              className="text-slate-500 hover:text-red-600 text-xs w-full sm:w-auto"
            >
              Décliner l'invitation
            </Button>
            <Button
              onClick={handleAccept}
              disabled={isSubmitting}
              className="bg-teal-700 hover:bg-teal-800 text-white font-medium text-xs px-6 py-2.5 w-full sm:w-auto shadow-sm"
            >
              {isSubmitting ? "Validation..." : "Accepter et rejoindre le Cercle"}
            </Button>
          </CardFooter>
        )}
      </Card>
    </div>
  );
}
