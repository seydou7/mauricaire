import React from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Badge } from "../ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import {
  ShieldCheck,
  Activity,
  Calendar,
  AlertTriangle,
  Clock,
  ArrowRight,
  CheckCircle2,
} from "lucide-react";

interface PatientRelayTimelineCardProps {
  patientId: string;
}

export const PatientRelayTimelineCard: React.FC<PatientRelayTimelineCardProps> = ({
  patientId,
}) => {
  const { t } = useTranslation();

  const history = useQuery(
    api.relay.getPatientRelayHistory,
    patientId ? { patientId: patientId as Id<"users"> } : "skip"
  );

  return (
    <Card className="border border-slate-200 shadow-sm">
      <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-teal-600" />
            <CardTitle className="text-base font-bold text-slate-900">
              {t("relay.history_title", "Historique de télé-expertise Relay")}
            </CardTitle>
          </div>
          <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
            {t("relay.care_continuity", "Continuité des soins")}
          </Badge>
        </div>
        <p className="text-xs text-slate-500 mt-1">
          {t("relay.history_desc", "Synthèses des avis et coordinations cliniques réalisés par vos praticiens.")}
        </p>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {!history || history.length === 0 ? (
          <div className="p-6 text-center text-slate-400 text-xs">
            <Activity className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
            <p className="font-medium text-slate-600">{t("relay.history_empty", "Aucun avis médical enregistré")}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">
              {t("relay.history_empty_desc", "Toutes les concertations médicales menées pour votre suivi apparaîtront ici.")}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {history.map((item) => (
              <div
                key={item._id}
                className="p-3.5 bg-slate-50/70 border border-slate-200 rounded-lg space-y-2 text-xs"
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-slate-800 capitalize">
                      {item.requesterSpecialty}
                    </span>
                    <ArrowRight className="w-3 h-3 text-slate-400 rtl:rotate-180" />
                    <span className="font-semibold text-teal-700 capitalize">
                      {item.responderSpecialty}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {item.urgencyLevel === "priority" && (
                      <Badge className="bg-rose-600 text-white text-[10px] py-0">
                        {t("relay.priority", "Prioritaire")}
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {item.completedAt ? new Date(item.completedAt).toLocaleDateString() : ""}
                    </span>
                  </div>
                </div>

                <div>
                  <span className="text-slate-500 font-medium block text-[11px]">
                    {t("relay.reason_prefix", "Motif : ")} {item.reasonCategory}
                  </span>
                  <div className="mt-1 p-2 bg-white rounded border border-slate-200 text-slate-700 leading-relaxed">
                    <div className="flex items-start gap-1.5">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                      <div>
                        <span className="font-semibold text-slate-800 block text-[11px]">
                          {t("relay.coordination_summary_label", "Synthèse de coordination :")}
                        </span>
                        <p className="text-slate-600 mt-0.5">{item.careOutcome}</p>
                      </div>
                    </div>

                    {item.recommendationSummary && (
                      <div className="mt-2 pt-2 border-t border-slate-100 text-[11px]">
                        <span className="font-semibold text-teal-800">
                          Recommandation :
                        </span>{" "}
                        <span className="text-slate-700">{item.recommendationSummary}</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
