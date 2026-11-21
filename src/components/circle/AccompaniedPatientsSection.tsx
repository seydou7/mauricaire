import React from "react";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import {
  Heart,
  Calendar,
  Clock,
  Shield,
  MapPin,
  Phone,
  ChevronRight,
  UserCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

import { BookingStepper } from "@/components/BookingStepper";

interface AccompaniedPatientsSectionProps {
  onSelectBeneficiaryForBooking?: (patientId: Id<"users">) => void;
  onViewBeneficiaryAppointments?: (patientId: Id<"users">) => void;
  onSelectAccompaniedPatient?: (patientId: Id<"users">) => void;
}

export function AccompaniedPatientsSection({
  onSelectBeneficiaryForBooking: _onSelectBeneficiaryForBooking,
  onViewBeneficiaryAppointments: _onViewBeneficiaryAppointments,
  onSelectAccompaniedPatient,
}: AccompaniedPatientsSectionProps) {
  const { t } = useTranslation();
  const accompanied = useQuery(api.circle.getAccompaniedPatients);

  if (!accompanied || accompanied.length === 0) {
    return null; // Don't clutter UI if user doesn't accompany anyone
  }

  const handleCardClick = (patientId: Id<"users">) => {
    if (onSelectAccompaniedPatient) {
      onSelectAccompaniedPatient(patientId);
    }
  };

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <span className="p-2 bg-emerald-50 text-emerald-700 rounded-xl">
            <Heart className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-slate-900 text-base">
              {t("circle.accompanied_patients_title", "Personnes que j'accompagne")}
            </h3>
            <p className="text-xs text-slate-500">
              {t("circle.accompanied_patients_desc", "Patients qui vous ont confié un mandat de coordination de leurs soins")}
            </p>
          </div>
        </div>
        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold">
          {t("circle.patients_count", { count: accompanied.length, defaultValue: `${accompanied.length} patient(s)` })}
        </Badge>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
        {accompanied.map((item: any) => {
          const patient = item.patient;
          const canBook = item.permissions.includes("BOOK_APPOINTMENTS");

          return (
            <div
              key={item.membershipId}
              onClick={() => handleCardClick(patient._id)}
              className="border-2 border-slate-200 hover:border-emerald-400 hover:shadow-md rounded-2xl p-4 transition-all bg-gradient-to-b from-slate-50/50 to-white flex flex-col justify-between gap-4 cursor-pointer group"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-600 text-white flex items-center justify-center font-bold text-base shadow-sm shrink-0 group-hover:scale-105 transition-transform">
                      {patient.name?.charAt(0) || "P"}
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition-colors flex items-center gap-1.5">
                        {patient.name}
                        <ChevronRight className="w-4 h-4 text-slate-400 group-hover:text-emerald-600 transition-transform group-hover:translate-x-0.5 rtl:group-hover:-translate-x-0.5 rtl:rotate-180" />
                      </h4>
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-[11px] mt-0.5">
                        {String(t(`circle.relationships.${item.relationship}` as any, item.relationship))}
                      </Badge>
                    </div>
                  </div>

                  {item.upcomingAppointmentsCount > 0 && (
                    <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs gap-1">
                      <Clock className="w-3 h-3" />
                      {t("circle.upcoming_appts_count", { count: item.upcomingAppointmentsCount, defaultValue: `${item.upcomingAppointmentsCount} rdv à venir` })}
                    </Badge>
                  )}
                </div>

                {/* Patient location and phone if available */}
                <div className="text-xs text-slate-500 space-y-1">
                  {(patient.neighborhood || patient.city) && (
                    <div className="flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" />
                      <span>{[patient.neighborhood, patient.city].filter(Boolean).join(", ")}</span>
                    </div>
                  )}
                  {patient.phone && (
                    <div className="flex items-center gap-1.5">
                      <Phone className="w-3.5 h-3.5 text-slate-400" />
                      <span>{patient.phone}</span>
                    </div>
                  )}
                </div>

                {/* Permissions summary */}
                <div className="pt-2 border-t border-slate-100 flex flex-wrap gap-1">
                  {item.permissions.map((p: string) => (
                    <span
                      key={p}
                      className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded-md font-medium"
                    >
                      {p === "BOOK_APPOINTMENTS" && t("circle.perm_book_appointments", "Réservation autorisée")}
                      {p === "VIEW_APPOINTMENTS" && t("circle.perm_view_appointments", "Consultation rdv")}
                      {p === "MANAGE_APPOINTMENTS" && t("circle.perm_manage_appointments", "Gestion soins")}
                      {p === "RECEIVE_APPOINTMENT_NOTIFICATIONS" && t("circle.perm_notifications", "Alertes de suivi")}
                      {p === "VIEW_CARE_SUMMARY" && t("circle.perm_care_summary", "Comptes-rendus")}
                      {p === "VIEW_SELECTED_HEALTH_DATA" && t("circle.perm_health_data_desc", "Constantes autorisées")}
                      {p === "VIEW_HOMELAB_STATUS" && t("circle.perm_view_homelab", "Suivi HomeLab")}
                      {p === "MANAGE_HOMELAB" && t("circle.perm_manage_homelab", "Commandes HomeLab")}
                    </span>
                  ))}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
                <Button
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCardClick(patient._id);
                  }}
                  className="bg-emerald-700 hover:bg-emerald-800 text-white text-xs gap-1.5 flex-1 h-9 rounded-xl font-medium shadow-2xs"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                  <span>{t("circle.btn_access_care_space", "Accéder à l'espace de soins")}</span>
                  <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                </Button>

                {canBook && (
                  <div onClick={(e) => e.stopPropagation()}>
                    <BookingStepper initialBeneficiaryId={patient._id}>
                      <Button
                        size="sm"
                        variant="outline"
                        className="border-emerald-300 text-emerald-800 hover:bg-emerald-50 text-xs gap-1 h-9 rounded-xl"
                      >
                        <Calendar className="w-3.5 h-3.5" />
                        <span>{t("circle.btn_book_appointment", "Réserver")}</span>
                      </Button>
                    </BookingStepper>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
