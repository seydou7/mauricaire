import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import {
  HeartHandshake,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  Loader2,
  Calendar,
  AlertCircle,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { toast } from "sonner";

export const PERMISSION_LABELS: Record<string, string> = {
  VIEW_APPOINTMENTS: "Consulter les rendez-vous de soins",
  BOOK_APPOINTMENTS: "Réserver des consultations à domicile",
  MANAGE_APPOINTMENTS: "Gérer et reprogrammer les rendez-vous",
  RECEIVE_APPOINTMENT_NOTIFICATIONS: "Recevoir les alertes et notifications",
  VIEW_CARE_SUMMARY: "Lire les comptes-rendus de visite simplifiés",
  VIEW_SELECTED_HEALTH_DATA: "Consulter les constantes de suivi autorisées",
  VIEW_HOMELAB_STATUS: "Suivre l'avancement des analyses HomeLab",
  MANAGE_HOMELAB: "Commander des prélèvements d'analyses",
};

export const RELATIONSHIP_LABELS: Record<string, string> = {
  child: "Enfant",
  spouse: "Conjoint(e)",
  parent: "Parent",
  sibling: "Frère / Sœur",
  family: "Famille proche",
  caregiver: "Aidant familial",
  trusted_person: "Personne de confiance",
  other: "Proche de confiance",
};

export function getLocalizedPermissionLabel(perm: string, t: any): string {
  switch (perm) {
    case "VIEW_APPOINTMENTS":
      return t("circle.perm_view_appointments", "Consulter les rendez-vous de soins");
    case "BOOK_APPOINTMENTS":
      return t("circle.perm_book_appointments", "Réserver des consultations à domicile");
    case "MANAGE_APPOINTMENTS":
      return t("circle.perm_manage_appointments", "Gérer et reprogrammer les rendez-vous");
    case "RECEIVE_APPOINTMENT_NOTIFICATIONS":
      return t("circle.perm_notifications", "Recevoir les alertes et notifications");
    case "VIEW_CARE_SUMMARY":
      return t("circle.perm_care_summary", "Lire les comptes-rendus de visite simplifiés");
    case "VIEW_SELECTED_HEALTH_DATA":
      return t("circle.perm_health_data_desc", "Consulter les constantes de suivi autorisées");
    case "VIEW_HOMELAB_STATUS":
      return t("circle.perm_view_homelab", "Suivre l'avancement des analyses HomeLab");
    case "MANAGE_HOMELAB":
      return t("circle.perm_manage_homelab", "Commander des prélèvements d'analyses");
    default:
      return PERMISSION_LABELS[perm] || perm;
  }
}

export function getLocalizedRelationshipLabel(rel: string, t: any): string {
  const key = `circle.relationships.${rel}`;
  const translated = t(key);
  if (translated && translated !== key) return translated;
  return RELATIONSHIP_LABELS[rel] || rel;
}

interface PendingCircleInvitationsCardProps {
  showEmptyState?: boolean;
  onAccepted?: () => void;
}

export function PendingCircleInvitationsCard({
  showEmptyState = false,
  onAccepted,
}: PendingCircleInvitationsCardProps) {
  const { t } = useTranslation();
  const pendingInvitations = useQuery(api.circle.getMyPendingInvitations);
  const acceptMutation = useMutation(api.circle.acceptInvitation);
  const declineMutation = useMutation(api.circle.declineInvitation);
  const syncNotifsMutation = useMutation(api.circle.syncMyInvitationNotifications);

  const [loadingAction, setLoadingAction] = useState<string | null>(null);

  // Sync in-app notifications if user arrived after invite creation
  useEffect(() => {
    if (pendingInvitations && pendingInvitations.length > 0) {
      syncNotifsMutation().catch(() => {});
    }
  }, [pendingInvitations, syncNotifsMutation]);

  if (pendingInvitations === undefined) {
    return null;
  }

  if (pendingInvitations.length === 0) {
    if (!showEmptyState) return null;
    return (
      <div className="text-center py-8 bg-white rounded-2xl border border-dashed border-slate-200">
        <HeartHandshake className="w-10 h-10 text-slate-300 mx-auto mb-2" />
        <p className="text-slate-600 font-medium text-sm">
          {t("circle.no_pending_received", "Aucune invitation reçue en attente.")}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          Lorsqu'un proche vous invite à coordonner ses soins, son invitation apparaîtra ici.
        </p>
      </div>
    );
  }

  const handleAccept = async (invitationId: Id<"circleInvitations">) => {
    setLoadingAction(`accept_${invitationId}`);
    try {
      await acceptMutation({ invitationId });
      toast.success("Félicitations ! Vous faites désormais partie du Cercle de soins.");
      if (onAccepted) onAccepted();
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'acceptation de l'invitation.");
    } finally {
      setLoadingAction(null);
    }
  };

  const handleDecline = async (invitationId: Id<"circleInvitations">) => {
    if (!window.confirm("Voulez-vous vraiment décliner cette invitation ?")) {
      return;
    }
    setLoadingAction(`decline_${invitationId}`);
    try {
      await declineMutation({ invitationId });
      toast.info("L'invitation a été déclinée.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du refus de l'invitation.");
    } finally {
      setLoadingAction(null);
    }
  };

  return (
    <div className="space-y-4">
      {pendingInvitations.map((inv) => {
        const isAccepting = loadingAction === `accept_${inv._id}`;
        const isDeclining = loadingAction === `decline_${inv._id}`;
        const relationshipName = getLocalizedRelationshipLabel(inv.relationship, t);

        return (
          <Card
            key={inv._id}
            className="border-2 border-emerald-400/80 bg-gradient-to-br from-emerald-50/90 via-teal-50/50 to-white shadow-md shadow-emerald-500/5 rounded-2xl overflow-hidden"
          >
            <CardHeader className="pb-3 border-b border-emerald-100/60 bg-emerald-50/40">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm shrink-0">
                    {inv.patient.name?.charAt(0) || "P"}
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge className="bg-emerald-600 text-white text-xs font-semibold">
                        <Sparkles className="w-3 h-3 mr-1" />
                        {t("circle.received_invitations_title", "Invitation reçue")}
                      </Badge>
                      <Badge
                        variant="outline"
                        className="border-emerald-300 text-emerald-800 bg-white/80 text-xs font-medium"
                      >
                        {t("circle.relationship_label", "Lien")} : {relationshipName}
                      </Badge>
                    </div>
                    <CardTitle className="text-base font-bold text-slate-900 mt-1">
                      {inv.patient.name}
                    </CardTitle>
                    <p className="text-xs text-slate-600">
                      {t("circle.received_invitations_desc", "Vous invite à rejoindre son Cercle de soins à domicile")}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1.5 text-xs text-slate-500 bg-white/70 px-2.5 py-1 rounded-lg border border-emerald-200/50 self-start sm:self-center">
                  <Clock className="w-3.5 h-3.5 text-emerald-600" />
                  <span>
                    Expire le {new Date(inv.expiresAt).toLocaleDateString(t("app.date_locale", "fr-FR"))}
                  </span>
                </div>
              </div>
            </CardHeader>

            <CardContent className="pt-4 space-y-4">
              {/* Permissions list */}
              <div className="bg-white/90 border border-emerald-200/70 rounded-xl p-3.5 space-y-2.5 shadow-xs">
                <span className="text-xs font-bold text-slate-800 flex items-center gap-1.5 uppercase tracking-wide">
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                  {t("circle.permissions_title", "Autorisations déléguées par le patient :")}
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  {inv.permissions.map((perm: string) => (
                    <div
                      key={perm}
                      className="flex items-center gap-2 text-xs text-slate-700 bg-slate-50/80 px-3 py-2 rounded-lg border border-slate-200/60"
                    >
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="font-medium">
                        {getLocalizedPermissionLabel(perm, t)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 pt-1">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isAccepting || isDeclining}
                  onClick={() => handleDecline(inv._id)}
                  className="text-slate-600 hover:text-red-700 hover:bg-red-50 hover:border-red-200 text-xs rounded-xl h-9 px-4 transition-colors"
                >
                  {isDeclining ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin mr-1.5" />
                  ) : (
                    <XCircle className="w-3.5 h-3.5 mr-1.5" />
                  )}
                  {t("circle.btn_decline", "Refuser")}
                </Button>
                <Button
                  size="sm"
                  disabled={isAccepting || isDeclining}
                  onClick={() => handleAccept(inv._id)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 rounded-xl h-9 shadow-sm gap-2 transition-all hover:scale-[1.01]"
                >
                  {isAccepting ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-3.5 h-3.5" />
                  )}
                  {t("circle.btn_accept", "Accepter l'invitation")}
                </Button>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
