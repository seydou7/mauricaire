import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import {
  Users,
  UserPlus,
  Shield,
  Clock,
  Mail,
  CheckCircle2,
  XCircle,
  RotateCw,
  Copy,
  Trash2,
  Edit,
  Eye,
  Calendar,
  Bell,
  FileText,
  Activity,
  HeartHandshake,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PendingCircleInvitationsCard } from "./PendingCircleInvitationsCard";
import { AccompaniedPatientsSection } from "./AccompaniedPatientsSection";

const PERMISSION_CONFIGS = [
  {
    key: "VIEW_APPOINTMENTS",
    labelKey: "perm_view_appointments",
    icon: Calendar,
    desc: "Peut consulter vos dates et horaires de rendez-vous",
  },
  {
    key: "BOOK_APPOINTMENTS",
    labelKey: "perm_book_appointments",
    icon: Calendar,
    desc: "Peut réserver un soin à domicile pour vous",
  },
  {
    key: "MANAGE_APPOINTMENTS",
    labelKey: "perm_manage_appointments",
    icon: Clock,
    desc: "Peut annuler ou reprogrammer une consultation",
  },
  {
    key: "RECEIVE_APPOINTMENT_NOTIFICATIONS",
    labelKey: "perm_notifications",
    icon: Bell,
    desc: "Reçoit les alertes de confirmation et rappels de soins",
  },
  {
    key: "VIEW_CARE_SUMMARY",
    labelKey: "perm_care_summary",
    icon: FileText,
    desc: "Consulte le compte-rendu simplifié une fois la visite terminée",
  },
  {
    key: "VIEW_SELECTED_HEALTH_DATA",
    labelKey: "perm_health_data",
    icon: Activity,
    desc: "Accès préparatoire aux données de suivi autorisées",
  },
];

const RELATIONSHIP_OPTIONS = [
  { value: "child", labelKey: "relationships.child" },
  { value: "spouse", labelKey: "relationships.spouse" },
  { value: "parent", labelKey: "relationships.parent" },
  { value: "sibling", labelKey: "relationships.sibling" },
  { value: "family", labelKey: "relationships.family" },
  { value: "caregiver", labelKey: "relationships.caregiver" },
  { value: "trusted_person", labelKey: "relationships.trusted_person" },
  { value: "other", labelKey: "relationships.other" },
];

export function CircleManagement({
  onSelectAccompaniedPatient,
}: {
  onSelectAccompaniedPatient?: (patientId: Id<"users">) => void;
} = {}) {
  const { t } = useTranslation();
  const circleData = useQuery(api.circle.getMyCircle);
  const [currentTimestamp] = useState(() => Date.now());

  const inviteMemberMutation = useMutation(api.circle.inviteMember);
  const cancelInvitationMutation = useMutation(api.circle.cancelInvitation);
  const resendInvitationMutation = useMutation(api.circle.resendInvitation);
  const updatePermissionsMutation = useMutation(api.circle.updateMemberPermissions);
  const revokeMemberMutation = useMutation(api.circle.revokeMemberAccess);

  // Modal states
  const [isInviteOpen, setIsInviteOpen] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRelationship, setInviteRelationship] = useState("child");
  const [invitePermissions, setInvitePermissions] = useState<string[]>([
    "VIEW_APPOINTMENTS",
    "BOOK_APPOINTMENTS",
    "RECEIVE_APPOINTMENT_NOTIFICATIONS",
    "VIEW_CARE_SUMMARY",
  ]);
  const [inviteDurationDays, setInviteDurationDays] = useState<number | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Edit member modal
  const [editingMember, setEditingMember] = useState<any>(null);
  const [editPermissions, setEditPermissions] = useState<string[]>([]);
  const [editRelationship, setEditRelationship] = useState("child");

  const handleToggleInvitePerm = (permKey: string) => {
    setInvitePermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleToggleEditPerm = (permKey: string) => {
    setEditPermissions((prev) =>
      prev.includes(permKey) ? prev.filter((p) => p !== permKey) : [...prev, permKey]
    );
  };

  const handleSendInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteEmail.trim()) {
      toast.error("Veuillez saisir une adresse email.");
      return;
    }
    if (invitePermissions.length === 0) {
      toast.error("Veuillez sélectionner au moins une autorisation.");
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await inviteMemberMutation({
        inviteeEmail: inviteEmail.trim(),
        relationship: inviteRelationship,
        permissions: invitePermissions,
        expiresInDays: 7,
        membershipDurationDays: inviteDurationDays,
      });

      toast.success("Invitation envoyée avec succès par email !");
      setIsInviteOpen(false);
      setInviteEmail("");
      setInvitePermissions([
        "VIEW_APPOINTMENTS",
        "BOOK_APPOINTMENTS",
        "RECEIVE_APPOINTMENT_NOTIFICATIONS",
        "VIEW_CARE_SUMMARY",
      ]);

      // If token returned, copy invite link automatically for testing convenience
      if (res.token) {
        const fullUrl = `${window.location.origin}/circle/invite/${res.token}`;
        navigator.clipboard.writeText(fullUrl);
        toast.info("Lien direct copié dans votre presse-papier pour partage WhatsApp/SMS.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'envoi de l'invitation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async (invitationId: Id<"circleInvitations">) => {
    try {
      const res = await resendInvitationMutation({ invitationId });
      toast.success("Invitation renvoyée avec une prolongation de 7 jours !");
      if (res.token) {
        const fullUrl = `${window.location.origin}/circle/invite/${res.token}`;
        navigator.clipboard.writeText(fullUrl);
        toast.info("Nouveau lien direct copié dans le presse-papier.");
      }
    } catch (err: any) {
      toast.error(err.message || "Erreur lors du renvoi.");
    }
  };

  const handleCancelInvite = async (invitationId: Id<"circleInvitations">) => {
    if (!confirm("Voulez-vous vraiment annuler cette invitation ?")) return;
    try {
      await cancelInvitationMutation({ invitationId });
      toast.success("Invitation annulée.");
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de l'annulation.");
    }
  };

  const handleRevoke = async (membershipId: Id<"circleMembers">, name: string) => {
    if (!confirm(`Voulez-vous révoquer définitivement l'accès de ${name} à votre Cercle ?`)) return;
    try {
      await revokeMemberMutation({ membershipId });
      toast.success(`Accès révoqué pour ${name}.`);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la révocation.");
    }
  };

  const handleOpenEdit = (member: any) => {
    setEditingMember(member);
    setEditPermissions(member.permissions || []);
    setEditRelationship(member.relationship || "child");
  };

  const handleSaveEdit = async () => {
    if (!editingMember) return;
    if (editPermissions.length === 0) {
      toast.error("Veuillez conserver au moins une autorisation.");
      return;
    }
    setIsSubmitting(true);
    try {
      await updatePermissionsMutation({
        membershipId: editingMember._id,
        permissions: editPermissions,
        relationship: editRelationship,
      });
      toast.success("Autorisations mises à jour.");
      setEditingMember(null);
    } catch (err: any) {
      toast.error(err.message || "Erreur lors de la mise à jour.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!circleData) {
    return (
      <div className="flex justify-center items-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-teal-600"></div>
      </div>
    );
  }

  const { members, invitations, auditLogs } = circleData;
  const activeMembers = members.filter((m: any) => m.status === "active" && !m.isExpired);
  const revokedMembers = members.filter((m: any) => m.status === "revoked" || m.isExpired);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-teal-50 via-emerald-50 to-teal-50 border border-teal-200 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="p-2 bg-teal-100 text-teal-700 rounded-xl">
                <HeartHandshake className="w-6 h-6" />
              </span>
              <h2 className="text-xl font-bold text-slate-800">
                {t("circle.title", "Cercle MauriCare")}
              </h2>
            </div>
            <p className="text-sm text-slate-600 max-w-2xl">
              {t(
                "circle.subtitle",
                "Autorisez vos proches de confiance (enfants, conjoint, famille, aidant) à vous aider à coordonner vos soins à domicile tout en protégeant votre intimité médicale."
              )}
            </p>
          </div>
          <Button
            onClick={() => setIsInviteOpen(true)}
            className="bg-teal-700 hover:bg-teal-800 text-white gap-2 shadow-sm font-medium"
          >
            <UserPlus className="w-4 h-4" />
            {t("circle.btn_invite", "Inviter un proche")}
          </Button>
        </div>
      </div>

      {/* Pending Invitations Received by this user */}
      <PendingCircleInvitationsCard />

      {/* Personnes que j'accompagne */}
      <AccompaniedPatientsSection onSelectAccompaniedPatient={onSelectAccompaniedPatient} />

      {/* Tabs */}
      <Tabs defaultValue="members" className="w-full">
        <TabsList className="bg-slate-100 p-1 rounded-xl">
          <TabsTrigger value="members" className="gap-2 rounded-lg text-xs md:text-sm">
            <Users className="w-4 h-4" />
            {t("circle.tab_members", "Mon Cercle (membres actifs)")} ({activeMembers.length})
          </TabsTrigger>
          <TabsTrigger value="invitations" className="gap-2 rounded-lg text-xs md:text-sm">
            <Mail className="w-4 h-4" />
            {t("circle.tab_invitations_sent", "Invitations envoyées")} ({invitations.length})
          </TabsTrigger>
          <TabsTrigger value="audit" className="gap-2 rounded-lg text-xs md:text-sm">
            <Shield className="w-4 h-4" />
            {t("circle.tab_audit", "Sécurité & Audit")}
          </TabsTrigger>
        </TabsList>

        {/* Tab 1: Active Members */}
        <TabsContent value="members" className="mt-4 space-y-4">
          {activeMembers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">
                {t("circle.empty_members", "Vous n'avez pas encore ajouté de membre à votre Cercle.")}
              </p>
              <p className="text-xs text-slate-400 mt-1 max-w-md mx-auto">
                Invitez un proche pour lui permettre de suivre vos rendez-vous et de réserver des soins à domicile pour vous.
              </p>
              <Button
                onClick={() => setIsInviteOpen(true)}
                variant="outline"
                className="mt-4 border-teal-600 text-teal-700 hover:bg-teal-50"
              >
                <UserPlus className="w-4 h-4 mr-2" />
                {t("circle.btn_invite", "Inviter un proche")}
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {activeMembers.map((member: any) => (
                <div
                  key={member._id}
                  className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm hover:border-teal-300 transition-all space-y-4"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-full bg-teal-100 text-teal-800 flex items-center justify-center font-bold text-lg">
                        {member.memberUser?.name?.charAt(0) || "P"}
                      </div>
                      <div>
                        <h4 className="font-semibold text-slate-900">
                          {member.memberUser?.name || "Membre du Cercle"}
                        </h4>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                            {String(t(`circle.relationships.${member.relationship}` as any, member.relationship))}
                          </Badge>
                          <span className="text-xs text-slate-500">{member.memberUser?.email}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleOpenEdit(member)}
                        className="text-slate-600 hover:text-teal-700 h-8 w-8 p-0"
                        title={t("circle.edit_permissions", "Modifier les autorisations")}
                      >
                        <Edit className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleRevoke(member._id, member.memberUser?.name || "ce proche")}
                        className="text-slate-400 hover:text-red-600 h-8 w-8 p-0"
                        title={t("circle.revoke_member", "Révoquer l'accès")}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>

                  {/* Permissions Checklist */}
                  <div className="border-t border-slate-100 pt-3">
                    <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">
                      {t("circle.permissions_title", "Cette personne peut :")}
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {member.permissions.map((pKey: string) => {
                        const cfg = PERMISSION_CONFIGS.find((c) => c.key === pKey);
                        return (
                          <Badge
                            key={pKey}
                            variant="secondary"
                            className="bg-slate-100 text-slate-700 text-xs font-normal py-1"
                          >
                            <CheckCircle2 className="w-3 h-3 text-teal-600 mr-1 inline" />
                            {cfg ? t(`circle.${cfg.labelKey}`, cfg.desc) : pKey}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  {/* Expiration badge if any */}
                  {member.expiresAt && (
                    <div className="text-xs text-amber-600 bg-amber-50 px-2.5 py-1 rounded-md flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5" />
                      Mandat temporaire : expire le {new Date(member.expiresAt).toLocaleDateString("fr-FR")}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Revoked history if any */}
          {revokedMembers.length > 0 && (
            <div className="mt-8 pt-6 border-t border-slate-200">
              <h4 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">
                Accès révoqués ou expirés
              </h4>
              <div className="space-y-2">
                {revokedMembers.map((m: any) => (
                  <div
                    key={m._id}
                    className="flex items-center justify-between text-xs bg-slate-50 p-3 rounded-lg border border-slate-200 text-slate-500"
                  >
                    <span>
                      <strong>{m.memberUser?.name || "Ancien membre"}</strong> ({String(t(`circle.relationships.${m.relationship}` as any, m.relationship))})
                    </span>
                    <Badge variant="outline" className="text-xs text-slate-400">
                      {m.isExpired ? "Expiré" : "Révoqué"}
                    </Badge>
                  </div>
                ))}
              </div>
            </div>
          )}
        </TabsContent>

        {/* Tab 2: Pending Invitations */}
        <TabsContent value="invitations" className="mt-4 space-y-4">
          {invitations.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl border border-dashed border-slate-200">
              <Mail className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <p className="text-slate-600 font-medium">
                {t("circle.empty_invitations", "Aucune invitation en attente.")}
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {invitations.map((inv: any) => {
                const daysLeft = Math.max(
                  0,
                  Math.ceil((inv.expiresAt - currentTimestamp) / (1000 * 60 * 60 * 24))
                );

                return (
                  <div
                    key={inv._id}
                    className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-sm"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-slate-900">{inv.inviteeEmail}</span>
                        <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                          {String(t(`circle.relationships.${inv.relationship}` as any, inv.relationship))}
                        </Badge>
                        <Badge variant="secondary" className="text-xs text-slate-600">
                          {inv.permissions.length} autorisations
                        </Badge>
                      </div>
                      <p className="text-xs text-slate-400">
                        Envoyée le {new Date(inv.invitedAt).toLocaleDateString("fr-FR")} • Expire dans {daysLeft} jour(s)
                      </p>
                    </div>

                    <div className="flex items-center gap-2 w-full md:w-auto">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleResend(inv._id)}
                        className="text-xs text-slate-700 gap-1.5"
                      >
                        <RotateCw className="w-3.5 h-3.5" />
                        {t("circle.resend_invite", "Renvoyer")}
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleCancelInvite(inv._id)}
                        className="text-xs text-red-600 hover:text-red-700 hover:bg-red-50 gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t("circle.cancel_invite", "Annuler")}
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* Tab 3: Security & Audit Trail */}
        <TabsContent value="audit" className="mt-4">
          <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold text-slate-900 text-sm flex items-center gap-2">
                <Shield className="w-4 h-4 text-teal-600" />
                Journal des événements de sécurité du Cercle
              </h3>
              <Badge variant="outline" className="text-xs text-slate-500">
                Immuable & auditable
              </Badge>
            </div>

            {auditLogs.length === 0 ? (
              <p className="text-xs text-slate-400 py-4 text-center">
                {t("circle.empty_audit", "Aucun événement d'audit récent.")}
              </p>
            ) : (
              <div className="divide-y divide-slate-100">
                {auditLogs.map((log: any) => (
                  <div key={log._id} className="py-2.5 flex items-start justify-between text-xs gap-4">
                    <div className="space-y-0.5">
                      <p className="font-medium text-slate-800">
                        {log.action === "invitation_created" && "Invitation envoyée"}
                        {log.action === "invitation_resent" && "Invitation renvoyée"}
                        {log.action === "invitation_accepted" && "Invitation acceptée"}
                        {log.action === "invitation_declined" && "Invitation déclinée"}
                        {log.action === "invitation_cancelled" && "Invitation annulée"}
                        {log.action === "permission_changed" && "Autorisations modifiées"}
                        {log.action === "access_revoked" && "Accès au Cercle révoqué"}
                        {log.action === "delegated_booking_created" && "Réservation de soin effectuée par un proche"}
                        {log.action === "delegated_appointment_cancelled" && "Rendez-vous annulé par un proche"}
                      </p>
                      <p className="text-slate-500">
                        Acteur : <span className="text-slate-700">{log.actorName}</span>
                      </p>
                    </div>
                    <span className="text-slate-400 whitespace-nowrap">
                      {new Date(log.timestamp).toLocaleString("fr-FR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* Modal: Invite Member */}
      <Dialog open={isInviteOpen} onOpenChange={setIsInviteOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-slate-900">
              <UserPlus className="w-5 h-5 text-teal-600" />
              {t("circle.modal_invite_title", "Inviter un proche de confiance")}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t(
                "circle.modal_invite_desc",
                "La personne invitée recevra un lien sécurisé pour accepter son mandat avec les autorisations choisies."
              )}
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSendInvite} className="space-y-4 py-2">
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                {t("circle.email_label", "Adresse email du proche")} *
              </Label>
              <Input
                type="email"
                required
                placeholder="ex: seydou.diallo@example.com"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                className="mt-1"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-slate-700">
                {t("circle.relationship_label", "Lien de relation")} *
              </Label>
              <select
                value={inviteRelationship}
                onChange={(e) => setInviteRelationship(e.target.value)}
                className="w-full mt-1 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                {RELATIONSHIP_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {t(`circle.${opt.labelKey}`, opt.value)}
                  </option>
                ))}
              </select>
            </div>

            {/* Permissions Selection (Section 28) */}
            <div>
              <Label className="text-xs font-semibold text-slate-700 block mb-2">
                {t("circle.permissions_title", "Cette personne pourra :")} *
              </Label>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {PERMISSION_CONFIGS.map((cfg) => {
                  const isChecked = invitePermissions.includes(cfg.key);
                  return (
                    <label
                      key={cfg.key}
                      onClick={() => handleToggleInvitePerm(cfg.key)}
                      className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                        isChecked
                          ? "bg-teal-50 border-teal-300 text-teal-900"
                          : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {}}
                        className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                      />
                      <div>
                        <div className="font-semibold">{t(`circle.${cfg.labelKey}`, cfg.desc)}</div>
                        <div className="text-slate-500 text-[11px] mt-0.5">{cfg.desc}</div>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Optional Temporary Duration */}
            <div>
              <Label className="text-xs font-semibold text-slate-700">
                {t("circle.duration_label", "Durée de validité du mandat")}
              </Label>
              <select
                value={inviteDurationDays || ""}
                onChange={(e) =>
                  setInviteDurationDays(e.target.value ? Number(e.target.value) : undefined)
                }
                className="w-full mt-1 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
              >
                <option value="">{t("circle.duration_permanent", "Permanent (révocable à tout moment)")}</option>
                <option value="30">{t("circle.duration_30d", "30 jours")}</option>
                <option value="90">{t("circle.duration_90d", "90 jours")}</option>
                <option value="365">{t("circle.duration_1y", "1 an")}</option>
              </select>
            </div>

            <DialogFooter className="mt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsInviteOpen(false)}
                disabled={isSubmitting}
              >
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="bg-teal-700 hover:bg-teal-800 text-white font-medium"
              >
                {isSubmitting ? "Envoi..." : t("circle.btn_send_invite", "Envoyer l'invitation")}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal: Edit Permissions */}
      {editingMember && (
        <Dialog open={!!editingMember} onOpenChange={() => setEditingMember(null)}>
          <DialogContent className="max-w-lg">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2 text-slate-900">
                <Edit className="w-5 h-5 text-teal-600" />
                {t("circle.modal_edit_title", "Modifier les autorisations du membre")}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500">
                Membre : {editingMember.memberUser?.name} ({editingMember.memberUser?.email})
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-2">
              <div>
                <Label className="text-xs font-semibold text-slate-700">
                  {t("circle.relationship_label", "Lien de relation")}
                </Label>
                <select
                  value={editRelationship}
                  onChange={(e) => setEditRelationship(e.target.value)}
                  className="w-full mt-1 border border-slate-300 rounded-md px-3 py-2 text-sm bg-white"
                >
                  {RELATIONSHIP_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {t(`circle.${opt.labelKey}`, opt.value)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-slate-700 block mb-2">
                  {t("circle.permissions_title", "Autorisations actives :")}
                </Label>
                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {PERMISSION_CONFIGS.map((cfg) => {
                    const isChecked = editPermissions.includes(cfg.key);
                    return (
                      <label
                        key={cfg.key}
                        onClick={() => handleToggleEditPerm(cfg.key)}
                        className={`flex items-start gap-3 p-2.5 rounded-lg border text-xs cursor-pointer transition-all ${
                          isChecked
                            ? "bg-teal-50 border-teal-300 text-teal-900"
                            : "bg-white border-slate-200 text-slate-700 hover:bg-slate-50"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => {}}
                          className="mt-0.5 rounded text-teal-600 focus:ring-teal-500"
                        />
                        <div>
                          <div className="font-semibold">{t(`circle.${cfg.labelKey}`, cfg.desc)}</div>
                          <div className="text-slate-500 text-[11px] mt-0.5">{cfg.desc}</div>
                        </div>
                      </label>
                    );
                  })}
                </div>
              </div>

              <DialogFooter className="mt-4">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditingMember(null)}
                  disabled={isSubmitting}
                >
                  Annuler
                </Button>
                <Button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={isSubmitting}
                  className="bg-teal-700 hover:bg-teal-800 text-white font-medium"
                >
                  {isSubmitting ? "Sauvegarde..." : t("circle.btn_save_permissions", "Enregistrer les modifications")}
                </Button>
              </DialogFooter>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
