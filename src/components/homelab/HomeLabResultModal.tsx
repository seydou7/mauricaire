import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  FileText,
  Download,
  AlertTriangle,
  CheckCircle2,
  ExternalLink,
  FlaskConical,
  ShieldCheck,
  Share2,
  Calendar,
  Building,
  Loader2,
} from "lucide-react";
import { CreateRelayModal } from "../relay/CreateRelayModal";

interface HomeLabResultModalProps {
  requestId: string | null;
  patientId?: string;
  isOpen: boolean;
  onClose: () => void;
  userRole?: string;
}

export const HomeLabResultModal: React.FC<HomeLabResultModalProps> = ({
  requestId,
  patientId,
  isOpen,
  onClose,
  userRole,
}) => {
  const { t } = useTranslation();

  const [openRelayModal, setOpenRelayModal] = useState(false);

  const result = useQuery(
    api.homeLab.getHomeLabResult,
    requestId ? { requestId: requestId as Id<"homeLabRequests"> } : "skip"
  );

  if (!isOpen || !requestId) return null;

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">
                MauriCare HomeLab
              </Badge>
              {result && result.version > 1 ? (
                <Badge className="bg-amber-600 text-white text-xs">
                  Résultat rectifié (v{result.version})
                </Badge>
              ) : (
                <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-xs">
                  Résultat officiel (v1)
                </Badge>
              )}
            </div>

            <DialogTitle className="text-xl font-bold text-slate-900 mt-1">
              Compte-rendu d'analyses médicales
            </DialogTitle>
            <DialogDescription className="text-xs text-slate-500">
              Échantillon réf. : <strong className="text-slate-700">{result?.sampleCode || "HL"}</strong> • Validé par le laboratoire partenaire
            </DialogDescription>
          </DialogHeader>

          {!result ? (
            <div className="flex flex-col items-center justify-center p-12 text-slate-400">
              <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mb-2" />
              <p className="text-xs">{t("homelab.loading_report", "Chargement du compte-rendu en cours...")}</p>
            </div>
          ) : (
            <div className="space-y-4 py-2">
              {/* Lab Header Box */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
                <div>
                  <div className="flex items-center gap-1.5 font-semibold text-slate-800">
                    <Building className="w-4 h-4 text-emerald-600" />
                    <span>{result.laboratoryName}</span>
                  </div>
                  {result.laboratoryPhone && (
                    <span className="text-slate-500 block mt-0.5">Tél : {result.laboratoryPhone}</span>
                  )}
                </div>

                <div className="text-right">
                  <span className="text-slate-400 block text-[11px]">Date de publication</span>
                  <span className="font-medium text-slate-700">
                    {new Date(result.publishedAt).toLocaleDateString()} à{" "}
                    {new Date(result.publishedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>

              {/* Amendment notice if applicable */}
              {result.amendmentReason && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{t("homelab.amendment_notice")}</span>
                    <p className="mt-0.5">
                      <strong className="text-amber-800">Motif :</strong> {result.amendmentReason}
                    </p>
                  </div>
                </div>
              )}

              {/* General Conclusion if provided */}
              {result.generalConclusion && (
                <div className="p-4 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                  <div className="flex items-center gap-2 mb-1.5">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <h4 className="text-xs font-bold uppercase text-emerald-900 tracking-wider">
                      Conclusion du biologiste médical
                    </h4>
                  </div>
                  <p className="text-xs text-slate-800 leading-relaxed whitespace-pre-wrap">
                    {result.generalConclusion}
                  </p>
                </div>
              )}

              {/* Structured Results Table */}
              {result.structuredResults && result.structuredResults.length > 0 && (
                <div className="border border-slate-200 rounded-lg overflow-hidden">
                  <div className="p-3 bg-slate-50 border-b border-slate-200">
                    <h4 className="text-xs font-bold uppercase text-slate-600 tracking-wider">
                      Résultats analytiques mesurés
                    </h4>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-100/70 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="py-2.5 px-3">{t("homelab.param_analysis", "Paramètre / Analyse")}</th>
                          <th className="py-2.5 px-3">{t("homelab.measured_value", "Valeur mesurée")}</th>
                          <th className="py-2.5 px-3">{t("homelab.unit", "Unité")}</th>
                          <th className="py-2.5 px-3">{t("homelab.ref_values", "Valeurs de référence (Laboratoire)")}</th>
                          <th className="py-2.5 px-3 text-right">{t("homelab.status", "Statut")}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.structuredResults.map((item, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/50">
                            <td className="py-2.5 px-3 font-medium text-slate-900">
                              {item.testName} {item.analyte && `(${item.analyte})`}
                            </td>
                            <td className="py-2.5 px-3 font-bold text-slate-900">
                              {item.value}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {item.unit || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-slate-500">
                              {item.referenceRange || "-"}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              {item.abnormalFlag ? (
                                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px]">
                                  Hors normes
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">
                                  Normal
                                </Badge>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Official Document Download Card */}
              {result.documentUrl ? (
                <div className="p-4 bg-white border border-slate-200 rounded-lg flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700">
                      <FileText className="w-5 h-5" />
                    </div>
                    <div>
                      <span className="text-sm font-semibold text-slate-900 block">
                        Compte-rendu officiel du laboratoire (PDF signé)
                      </span>
                      <span className="text-xs text-slate-400">
                        Document médical certifié par le biologiste
                      </span>
                    </div>
                  </div>

                  <a
                    href={result.documentUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-medium shadow-sm transition-colors shrink-0"
                  >
                    <Download className="w-4 h-4" />
                    <span>{t("homelab.download_pdf", "Télécharger (PDF)")}</span>
                  </a>
                </div>
              ) : (
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-xs text-slate-500 text-center">
                  Aucun document PDF scanné n'est joint ; les résultats structurés ci-dessus font foi.
                </div>
              )}

              {/* Cross-Module Integration with Relay for Healthcare Professionals */}
              {userRole === "professionnel" && patientId && (
                <div className="p-3.5 bg-teal-50/70 border border-teal-200 rounded-lg flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-4 h-4 text-teal-700 shrink-0" />
                    <div>
                      <span className="text-xs font-bold text-teal-900 block">
                        Coordination confraternelle (MauriCare Relay)
                      </span>
                      <span className="text-[11px] text-teal-800">
                        Besoin d'un avis spécialisé (ex: diabétologue, cardiologue) suite à ce résultat ?
                      </span>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => setOpenRelayModal(true)}
                    className="bg-teal-700 hover:bg-teal-800 text-white text-xs shrink-0"
                  >
                    Initier un Relay
                  </Button>
                </div>
              )}

              {/* Disclaimer */}
              <p className="text-[11px] text-slate-400 italic text-center pt-2">
                Les valeurs de référence et conclusions sont fournies sous l'entière responsabilité du laboratoire d'analyses agréé.
              </p>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button variant="outline" onClick={onClose} className="text-xs">
              Fermer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Embedded Relay Modal if triggered from this result */}
      {patientId && (
        <CreateRelayModal
          isOpen={openRelayModal}
          onClose={() => setOpenRelayModal(false)}
          initialPatientId={patientId}
        />
      )}
    </>
  );
};
