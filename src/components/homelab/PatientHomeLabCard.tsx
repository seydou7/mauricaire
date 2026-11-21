import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { HomeLabResultModal } from "./HomeLabResultModal";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import {
  FlaskConical,
  FileText,
  Calendar,
  Building,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
} from "lucide-react";

interface PatientHomeLabCardProps {
  patientId: string;
  userRole?: string;
}

export const PatientHomeLabCard: React.FC<PatientHomeLabCardProps> = ({
  patientId,
  userRole,
}) => {
  const { t } = useTranslation();

  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);

  const history = useQuery(
    api.homeLab.getPatientHomeLabHistory,
    patientId ? { patientId: patientId as Id<"users"> } : "skip"
  );

  return (
    <>
      <Card className="border border-slate-200 shadow-sm">
        <CardHeader className="pb-3 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-emerald-600" />
              <CardTitle className="text-base font-bold text-slate-900">
                {t("homelab.title", "Analyses & Prélèvements HomeLab")}
              </CardTitle>
            </div>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              {t("homelab.badge_biology", "Biologie médicale")}
            </Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            {t("homelab.subtitle", "Résultats officiels des bilans sanguins et examens réalisés à domicile par les laboratoires partenaires.")}
          </p>
        </CardHeader>

        <CardContent className="pt-4 space-y-3">
          {!history || history.length === 0 ? (
            <div className="p-6 text-center text-slate-400 text-xs">
              <FlaskConical className="w-8 h-8 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
              <p className="font-medium text-slate-600">{t("homelab.empty_results", "Aucun résultat d'analyse disponible")}</p>
              <p className="text-[11px] text-slate-400 mt-0.5">
                {t("homelab.empty_results_desc", "Les comptes-rendus d'analyses publiés par le laboratoire apparaîtront ici.")}
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {history.map((item) => (
                <div
                  key={item._id}
                  className="p-3 bg-slate-50/80 border border-slate-200 rounded-lg text-xs space-y-2 hover:border-slate-300 transition-colors"
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {item.sampleCode}
                      </span>
                      {item.version > 1 ? (
                        <Badge className="bg-amber-600 text-white text-[10px] py-0">
                          {t("homelab.rectified", "Rectifié")} (v{item.version})
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] py-0">
                          {t("homelab.validated", "Validé")}
                        </Badge>
                      )}
                    </div>

                    <span className="text-[11px] text-slate-400 flex items-center gap-1">
                      <Calendar className="w-3 h-3" />
                      {new Date(item.publishedAt).toLocaleDateString()}
                    </span>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {item.analyses.map((name: string, idx: number) => (
                      <Badge key={idx} variant="secondary" className="text-[10px] font-normal">
                        {name}
                      </Badge>
                    ))}
                  </div>

                  {item.generalConclusion && (
                    <p className="text-slate-600 italic bg-white p-2 rounded border border-slate-100 text-[11px]">
                      "{item.generalConclusion}"
                    </p>
                  )}

                  <div className="flex items-center justify-between pt-1 border-t border-slate-200">
                    <span className="text-[11px] text-slate-500 flex items-center gap-1">
                      <Building className="w-3 h-3 text-slate-400" />
                      {item.laboratoryName}
                    </span>

                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setSelectedRequestId(item.requestId)}
                      className="text-xs text-emerald-700 hover:text-emerald-800 hover:bg-emerald-50 p-1.5 h-auto font-medium gap-1"
                    >
                      <span>{t("homelab.view_report", "Voir le compte-rendu")}</span>
                      <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Result Modal */}
      <HomeLabResultModal
        requestId={selectedRequestId}
        patientId={patientId}
        isOpen={Boolean(selectedRequestId)}
        onClose={() => setSelectedRequestId(null)}
        userRole={userRole}
      />
    </>
  );
};
