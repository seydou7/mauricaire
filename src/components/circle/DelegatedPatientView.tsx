import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { getLocalizedServiceLabel } from "@/lib/services";
import {
  Heart,
  Calendar,
  Clock,
  Shield,
  ShieldCheck,
  MapPin,
  Phone,
  ArrowLeft,
  ChevronRight,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Stethoscope,
  Info,
  CalendarPlus,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { BookingStepper } from "@/components/BookingStepper";
import {
  RELATIONSHIP_LABELS,
  PERMISSION_LABELS,
  getLocalizedPermissionLabel,
  getLocalizedRelationshipLabel,
} from "./PendingCircleInvitationsCard";

interface DelegatedPatientViewProps {
  patientId: Id<"users">;
  onBack: () => void;
  onNavigate?: (section: any) => void;
}

export function DelegatedPatientView({
  patientId,
  onBack,
  onNavigate: _onNavigate,
}: DelegatedPatientViewProps) {
  const { t, i18n } = useTranslation();

  // Authoritative server-side verification of active circle membership
  const context = useQuery(api.circle.getAccompaniedPatientContext, { patientId });

  // Query appointments strictly if permitted
  const appointments = useQuery(
    api.circle.getBeneficiaryAppointments,
    context?.authorized && context.permissions?.includes("VIEW_APPOINTMENTS")
      ? { beneficiaryId: patientId }
      : "skip"
  );

  // Selected appointment for care summary view
  const [selectedSummaryApptId, setSelectedSummaryApptId] = useState<Id<"appointments"> | null>(null);

  // Query care summary when requested
  const careSummary = useQuery(
    api.circle.getBeneficiaryCareSummary,
    selectedSummaryApptId ? { appointmentId: selectedSummaryApptId } : "skip"
  );

  // 1. Loading State
  if (context === undefined) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-10 w-48 bg-slate-200 rounded-xl" />
        <div className="h-44 bg-slate-100 rounded-2xl border border-slate-200" />
        <div className="h-64 bg-slate-100 rounded-2xl border border-slate-200" />
      </div>
    );
  }

  // 2. Authorization Failure / Revocation State
  if (!context || !context.authorized) {
    let errorTitle = t("circle.cannot_access_patient", "Impossible d'accéder à cette personne accompagnée.");
    let errorDesc = t("circle.no_active_auth", "Vous ne disposez pas d'une autorisation active pour accompagner ce patient.");

    if (context?.reason === "revoked") {
      errorTitle = t("circle.mandate_revoked_title", "Votre accès à cette personne a été révoqué.");
      errorDesc = t("circle.mandate_revoked_desc", "Le patient a révoqué votre mandat dans son Cercle de proches. Vous ne pouvez plus consulter ni gérer ses soins.");
    } else if (context?.reason === "expired") {
      errorTitle = t("circle.mandate_expired_title", "Votre mandat temporaire a expiré.");
      errorDesc = t("circle.mandate_expired_desc", "L'autorisation temporaire accordée par le patient pour la coordination de ses soins est arrivée à échéance.");
    }

    return (
      <div className="space-y-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 gap-1.5"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t("common.back_dashboard", "Retour au tableau de bord")}
        </Button>

        <Card className="border-red-200 bg-gradient-to-b from-red-50/70 to-white p-8 text-center space-y-4 rounded-2xl shadow-sm">
          <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
            <AlertCircle className="w-7 h-7" />
          </div>
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-slate-900">{errorTitle}</h3>
            <p className="text-sm text-slate-600 max-w-md mx-auto">{errorDesc}</p>
          </div>
          <div className="pt-2">
            <Button
              onClick={onBack}
              className="bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs px-5 h-9"
            >
              <ArrowLeft className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0 rtl:rotate-180" />
              {t("common.back", "Retour")}
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const patient = context.patient!;
  const relationship = getLocalizedRelationshipLabel(context.relationship!, t);
  const permissions = context.permissions || [];
  const canBook = permissions.includes("BOOK_APPOINTMENTS");
  const canView = permissions.includes("VIEW_APPOINTMENTS");
  const canViewSummary = permissions.includes("VIEW_CARE_SUMMARY");

  const todayStr = new Date().toISOString().split("T")[0];
  const upcomingList = (appointments || []).filter(
    (a) => a.date >= todayStr && a.status !== "annule" && a.status !== "termine"
  );
  const pastList = (appointments || []).filter(
    (a) => a.date < todayStr || a.status === "termine" || a.status === "annule"
  );

  return (
    <div className="space-y-6">
      {/* Top navigation back button */}
      <div className="flex items-center justify-between">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-xl gap-1.5 text-xs font-medium"
        >
          <ArrowLeft className="w-4 h-4 rtl:rotate-180" />
          {t("circle.back_to_accompanied", "Retour aux personnes accompagnées")}
        </Button>
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs gap-1 font-medium"
        >
          <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
          {t("circle.active_mandate_verified", "Mandat actif vérifié")}
        </Badge>
      </div>

      {/* Patient Header Banner */}
      <Card className="border border-emerald-200/80 bg-gradient-to-r from-emerald-50 via-teal-50 to-white rounded-2xl shadow-sm overflow-hidden">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div className="flex items-start gap-4">
              <div className="w-14 h-14 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-xl shadow-md shrink-0">
                {patient.name?.charAt(0) || "P"}
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <h2 className="text-xl font-bold text-slate-900">
                    {t("circle.you_accompany", { name: patient.name, defaultValue: `Vous accompagnez ${patient.name}` })}
                  </h2>
                  <Badge className="bg-emerald-600 text-white text-xs">
                    {t("circle.link_prefix", "Lien : ")} {relationship}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600">
                  {t("circle.delegated_space_desc", "Espace de coordination des soins délégué par votre proche (MauriCare Circle - Module 5)")}
                </p>

                {(patient.neighborhood || patient.city || patient.phone) && (
                  <div className="flex items-center gap-4 text-xs text-slate-500 pt-1 flex-wrap">
                    {(patient.neighborhood || patient.city) && (
                      <span className="flex items-center gap-1">
                        <MapPin className="w-3.5 h-3.5 text-slate-400" />
                        {[patient.neighborhood, patient.city].filter(Boolean).join(", ")}
                      </span>
                    )}
                    {patient.phone && (
                      <span className="flex items-center gap-1">
                        <Phone className="w-3.5 h-3.5 text-slate-400" />
                        {patient.phone}
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Quick Action: Delegated Booking */}
            {canBook && (
              <div className="shrink-0">
                <BookingStepper initialBeneficiaryId={patient._id}>
                  <Button className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs px-5 h-10 rounded-xl shadow-sm gap-2">
                    <CalendarPlus className="w-4 h-4" />
                    {t("circle.book_care_for", { name: patient.name, defaultValue: `Réserver un soin pour ${patient.name}` })}
                  </Button>
                </BookingStepper>
              </div>
            )}
          </div>

          {/* Delegated Permissions Bar */}
          <div className="mt-5 pt-4 border-t border-emerald-200/60">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-3.5 h-3.5 text-emerald-700" />
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wide">
                {t("circle.permissions_granted", "Autorisations accordées par le patient :")}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {permissions.map((p: string) => (
                <span
                  key={p}
                  className="inline-flex items-center gap-1.5 text-xs bg-white/90 text-slate-700 border border-emerald-200 px-3 py-1 rounded-lg font-medium shadow-2xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  {getLocalizedPermissionLabel(p, t)}
                </span>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Content Area */}
      <div className="space-y-6">
        {/* Module 1: Appointments List (if VIEW_APPOINTMENTS) */}
        {canView ? (
          <div className="space-y-6">
            {/* Upcoming Appointments */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-emerald-600" />
                  <h3 className="font-bold text-slate-900 text-base">
                    {t("appointments.upcoming", "Rendez-vous à venir")} ({upcomingList.length})
                  </h3>
                </div>
              </div>

              {upcomingList.length === 0 ? (
                <Card className="border border-dashed border-slate-200 bg-white p-6 rounded-2xl text-center">
                  <p className="text-xs text-slate-500">
                    {t("appointments.no_upcoming_for", { name: patient.name, defaultValue: `Aucun soin planifié à venir pour ${patient.name}.` })}
                  </p>
                  {canBook && (
                    <div className="mt-3">
                      <BookingStepper initialBeneficiaryId={patient._id}>
                        <Button
                          size="sm"
                          variant="outline"
                          className="border-emerald-300 text-emerald-700 hover:bg-emerald-50 text-xs rounded-xl"
                        >
                          <CalendarPlus className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
                          {t("appointments.schedule_care", "Programmer une consultation")}
                        </Button>
                      </BookingStepper>
                    </div>
                  )}
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {upcomingList.map((appt) => (
                    <Card
                      key={appt._id}
                      className="border border-slate-200 hover:border-emerald-300 rounded-xl p-4 bg-white shadow-xs transition-all space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <Badge
                            variant="secondary"
                            className="bg-emerald-50 text-emerald-700 text-xs mb-1"
                          >
                            {getLocalizedServiceLabel(appt.serviceSnapshot?.name || appt.serviceType, i18n.language)}
                          </Badge>
                          <div className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            {appt.date} {t("common.at", "à")} {appt.time}
                          </div>
                        </div>
                        <Badge
                          className={
                            appt.status === "confirme"
                              ? "bg-emerald-600 text-white text-xs"
                              : "bg-amber-500 text-white text-xs"
                          }
                        >
                          {appt.status === "confirme"
                            ? t("status.confirme", "Confirmé")
                            : t("status.en_attente", "En attente")}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-2 border-t border-slate-100">
                        <div className="flex items-center gap-1.5 font-medium">
                          <Stethoscope className="w-3.5 h-3.5 text-teal-600" />
                          <span>{appt.providerName}</span>
                          <span className="text-slate-400 font-normal">
                            ({appt.providerSpecialty})
                          </span>
                        </div>
                        {appt.address && (
                          <div className="flex items-center gap-1.5 text-slate-500">
                            <MapPin className="w-3.5 h-3.5 text-slate-400" />
                            <span className="truncate">{appt.address}</span>
                          </div>
                        )}
                        {appt.bookedByName && (
                          <div className="text-[11px] text-slate-400 italic">
                            {t("appointments.booked_by", "Réservé par :")} {appt.bookedByName}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}
            </div>

            {/* Past Appointments History & Care Summaries */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-slate-900 text-base">
                    {t("appointments.history", "Historique des soins")} ({pastList.length})
                  </h3>
                </div>
              </div>

              {pastList.length === 0 ? (
                <Card className="border border-dashed border-slate-200 bg-white p-6 rounded-2xl text-center">
                  <p className="text-xs text-slate-500">
                    {t("appointments.no_past_for", { name: patient.name, defaultValue: `Aucune consultation passée enregistrée pour ${patient.name}.` })}
                  </p>
                </Card>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {pastList.map((appt) => (
                    <Card
                      key={appt._id}
                      className="border border-slate-200 rounded-xl p-4 bg-white shadow-xs space-y-3"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span className="font-semibold text-slate-900 text-sm block">
                            {getLocalizedServiceLabel(appt.serviceSnapshot?.name || appt.serviceType, i18n.language)}
                          </span>
                          <span className="text-xs text-slate-500">
                            {appt.date} {t("common.at", "à")} {appt.time}
                          </span>
                        </div>
                        <Badge
                          variant="outline"
                          className={
                            appt.status === "termine"
                              ? "bg-slate-100 text-slate-700 border-slate-200 text-xs"
                              : "bg-red-50 text-red-600 border-red-200 text-xs"
                          }
                        >
                          {appt.status === "termine"
                            ? t("status.termine", "Terminé")
                            : t("status.annule", "Annulé")}
                        </Badge>
                      </div>

                      <div className="text-xs text-slate-600 space-y-1 pt-1 border-t border-slate-100">
                        <div className="flex items-center gap-1.5">
                          <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                          <span>{appt.providerName}</span>
                        </div>
                      </div>

                      {/* View Care Summary Button if allowed */}
                      {appt.status === "termine" && canViewSummary && (
                        <div className="pt-2 border-t border-slate-100 flex justify-end">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedSummaryApptId(appt._id)}
                            className="text-xs text-emerald-700 border-emerald-300 hover:bg-emerald-50 gap-1.5 h-8 rounded-lg"
                          >
                            <FileText className="w-3.5 h-3.5" />
                            {t("circle.view_care_summary", "Voir le compte-rendu simplifié")}
                          </Button>
                        </div>
                      )}
                    </Card>
                  ))}
                </div>
              )}
            </div>
          </div>
        ) : (
          <Card className="border border-slate-200 bg-slate-50 p-6 rounded-2xl text-center space-y-2">
            <Lock className="w-6 h-6 text-slate-400 mx-auto" />
            <p className="text-xs font-medium text-slate-700">
              {t("circle.appts_not_authorized", "Consultation des rendez-vous non autorisée")}
            </p>
            <p className="text-[11px] text-slate-500">
              {t("circle.no_view_permission", "Votre mandat n'inclut pas l'autorisation 'VIEW_APPOINTMENTS'.")}
            </p>
          </Card>
        )}
      </div>

      {/* Simplified Care Summary Dialog (Module 5 Privacy Safe) */}
      <Dialog
        open={Boolean(selectedSummaryApptId)}
        onOpenChange={(open) => !open && setSelectedSummaryApptId(null)}
      >
        <DialogContent className="max-w-md rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base text-slate-900">
              <FileText className="w-5 h-5 text-emerald-600" />
              {t("circle.care_summary_title", "Compte-rendu de soins simplifié")}
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              {t("circle.care_summary_desc", "Informations essentielles de visite partagées avec les membres du Cercle de confiance.")}
            </DialogDescription>
          </DialogHeader>

          {careSummary ? (
            <div className="space-y-4 pt-2">
              <div className="bg-emerald-50/80 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-900">
                    {getLocalizedServiceLabel(careSummary.serviceName, i18n.language)}
                  </span>
                  <Badge className="bg-emerald-600 text-white text-[11px]">
                    {t("circle.visit_completed", "Visite effectuée")}
                  </Badge>
                </div>
                <div className="text-xs text-slate-600 flex items-center gap-4">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5 text-slate-400" />
                    {careSummary.date}
                  </span>
                  <span className="flex items-center gap-1">
                    <Clock className="w-3.5 h-3.5 text-slate-400" />
                    {careSummary.time} ({careSummary.duration} min)
                  </span>
                </div>
              </div>

              <div className="space-y-2 text-xs text-slate-700">
                <div className="flex items-center gap-2 font-medium">
                  <Stethoscope className="w-4 h-4 text-emerald-600" />
                  <span>{t("appointments.caregiver", "Soignant")} : {careSummary.provider.name} ({careSummary.provider.specialty})</span>
                </div>
                {careSummary.address && (
                  <div className="flex items-center gap-2 text-slate-500">
                    <MapPin className="w-4 h-4 text-slate-400" />
                    <span>{t("appointments.location", "Lieu d'intervention")} : {careSummary.address}</span>
                  </div>
                )}
              </div>

              <div className="bg-slate-50 p-3 rounded-xl border border-slate-200 text-xs text-slate-700">
                <p className="font-medium text-slate-900 mb-1">{t("circle.summary_of_service", "Résumé de la prestation :")}</p>
                <p>{careSummary.summaryText}</p>
              </div>

              <div className="p-3 bg-amber-50/80 border border-amber-200/80 rounded-xl text-[11px] text-amber-900 flex items-start gap-2">
                <Info className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <span>
                  {t("circle.privacy_note", "Ce résumé respecte le principe de minimisation des données (Module 5). Les notes médicales détaillées et les échanges confraternels restent sanctuarisés entre le soignant et le patient.")}
                </span>
              </div>
            </div>
          ) : (
            <div className="py-8 text-center text-xs text-slate-400">
              {t("common.loading", "Chargement...")}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
