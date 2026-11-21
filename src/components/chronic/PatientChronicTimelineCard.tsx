import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Activity, Heart, Droplet, Scale, AlertCircle, ChevronRight, Thermometer } from "lucide-react";

interface PatientChronicTimelineCardProps {
  patientId?: Id<"users"> | string;
  onNavigateToChronic?: () => void;
  userRole?: "patient" | "professionnel";
}

export const PatientChronicTimelineCard: React.FC<PatientChronicTimelineCardProps> = ({
  patientId,
  onNavigateToChronic,
  userRole = "patient",
}) => {
  const { t } = useTranslation();
  const summary = useQuery(api.chronic.getPatientChronicSummary, {
    patientId: patientId as Id<"users"> | undefined,
  });

  if (summary === undefined) {
    return (
      <Card className="border border-gray-200 shadow-sm rounded-2xl overflow-hidden bg-white animate-pulse">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            Suivi Santé & Constantes
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-10 bg-gray-100 rounded-xl" />
        </CardContent>
      </Card>
    );
  }

  if (!summary || summary.totalObservations === 0) {
    return (
      <Card className="border border-gray-200 shadow-sm rounded-2xl overflow-hidden bg-white">
        <CardHeader className="pb-3 flex flex-row items-center justify-between">
          <CardTitle className="text-sm font-bold text-gray-900 flex items-center gap-2">
            <Activity className="h-4 w-4 text-teal-600" />
            {t("chronic.title", "Suivi Santé & Constantes")}
          </CardTitle>
          {onNavigateToChronic && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onNavigateToChronic}
              className="text-xs text-teal-600 h-7 px-2"
            >
              {t("chronic.access_tracking", "Accéder au suivi")} <ChevronRight className="h-3.5 w-3.5 ml-1 rtl:mr-1 rtl:ml-0 rtl:rotate-180" />
            </Button>
          )}
        </CardHeader>
        <CardContent>
          <p className="text-xs text-gray-400 italic">
            {t("chronic.empty_observations", "Aucune constante ou observation de santé enregistrée pour le moment.")}
          </p>
        </CardContent>
      </Card>
    );
  }

  const latest = summary.latestByCode || {};
  const bp = latest.bp || latest.blood_pressure;
  const glucose = latest.glucose || latest.blood_glucose;
  const pulse = latest.pulse || latest.heart_rate;
  const temp = latest.temperature || latest.temp;
  const weight = latest.weight;

  return (
    <Card className="border border-gray-200 shadow-sm rounded-2xl overflow-hidden bg-white">
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <div className="flex items-center gap-2">
          <Activity className="h-4 w-4 text-teal-600" />
          <CardTitle className="text-sm font-bold text-gray-900">
            {t("chronic.title", "Suivi Santé & Constantes")}
          </CardTitle>
          {summary.activeProgramsCount > 0 && (
            <Badge className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">
              {t("chronic.active_programs", { count: summary.activeProgramsCount, defaultValue: `${summary.activeProgramsCount} prog. actif${summary.activeProgramsCount > 1 ? "s" : ""}` })}
            </Badge>
          )}
        </div>
        {onNavigateToChronic && (
          <Button
            variant="ghost"
            size="sm"
            onClick={onNavigateToChronic}
            className="text-xs text-teal-600 h-7 px-2"
          >
            {t("chronic.see_evolution", "Voir l'évolution")} <ChevronRight className="h-3.5 w-3.5 ml-1 rtl:mr-1 rtl:ml-0 rtl:rotate-180" />
          </Button>
        )}
      </CardHeader>

      <CardContent className="space-y-3">
        {summary.hasRecentAttentionFlag && (
          <div className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-xl flex items-center gap-2 text-xs text-amber-900">
            <AlertCircle className="h-4 w-4 text-amber-600 shrink-0" />
            <span>{t("chronic.attention_recommended", "Attention recommandée sur récentes constantes.")}</span>
          </div>
        )}

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          {/* Blood Pressure */}
          <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
              <Heart className="h-3 w-3 text-red-500" />
              <span>{t("chronic.blood_pressure", "Tension")}</span>
            </div>
            <div className="mt-1 font-bold text-gray-900 text-sm">
              {bp ? `${bp.numericValue}/${bp.secondaryNumericValue || 80}` : "—"}
              <span className="text-[10px] font-normal text-gray-400 ml-1 rtl:mr-1 rtl:ml-0">mmHg</span>
            </div>
          </div>

          {/* Blood Glucose */}
          <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
              <Droplet className="h-3 w-3 text-blue-500" />
              <span>{t("chronic.blood_glucose", "Glycémie")}</span>
            </div>
            <div className="mt-1 font-bold text-gray-900 text-sm">
              {glucose ? glucose.numericValue : "—"}
              <span className="text-[10px] font-normal text-gray-400 ml-1 rtl:mr-1 rtl:ml-0">{glucose?.unit || "mg/dL"}</span>
            </div>
          </div>

          {/* Heart Rate */}
          <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
            <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
              <Activity className="h-3 w-3 text-rose-500" />
              <span>{t("chronic.pulse", "Pouls")}</span>
            </div>
            <div className="mt-1 font-bold text-gray-900 text-sm">
              {pulse ? pulse.numericValue : "—"}
              <span className="text-[10px] font-normal text-gray-400 ml-1 rtl:mr-1 rtl:ml-0">bpm</span>
            </div>
          </div>

          {/* Temperature or Weight */}
          {temp ? (
            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                <Thermometer className="h-3 w-3 text-sky-500" />
                <span>{t("chronic.temperature", "Température")}</span>
              </div>
              <div className="mt-1 font-bold text-gray-900 text-sm">
                {temp.numericValue}
                <span className="text-[10px] font-normal text-gray-400 ml-1 rtl:mr-1 rtl:ml-0">{temp.unit || "°C"}</span>
              </div>
            </div>
          ) : (
            <div className="p-2.5 bg-gray-50 rounded-xl border border-gray-100">
              <div className="flex items-center gap-1.5 text-gray-500 text-[11px]">
                <Scale className="h-3 w-3 text-amber-500" />
                <span>{t("chronic.weight", "Poids")}</span>
              </div>
              <div className="mt-1 font-bold text-gray-900 text-sm">
                {weight ? weight.numericValue : "—"}
                <span className="text-[10px] font-normal text-gray-400 ml-1 rtl:mr-1 rtl:ml-0">kg</span>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};
