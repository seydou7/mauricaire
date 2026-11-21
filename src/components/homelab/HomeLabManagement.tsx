import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { CreateHomeLabRequestModal } from "./CreateHomeLabRequestModal";
import { HomeLabResultModal } from "./HomeLabResultModal";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  FlaskConical,
  Plus,
  Clock,
  Calendar,
  MapPin,
  Phone,
  FileText,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Truck,
  Building,
  User,
  ChevronRight,
  Search,
  Filter,
  Loader2,
  Share2,
  Check,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";

interface HomeLabManagementProps {
  role?: "patient" | "professionnel";
  userId?: string;
}

export const HomeLabManagement: React.FC<HomeLabManagementProps> = ({ role = "patient", userId }) => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"requests" | "collector" | "catalog">("requests");
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedResultRequestId, setSelectedResultRequestId] = useState<string | null>(null);
  const [selectedResultPatientId, setSelectedResultPatientId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");

  const requests = useQuery(api.homeLab.getMyHomeLabRequests, {}) || [];
  const collectorQueue = useQuery(api.homeLab.getCollectorQueue) || [];
  const catalog = useQuery(api.homeLab.getLabTestCatalog, {}) || [];
  const collectorEligibility = useQuery(api.homeLab.checkCollectorEligibility);

  // Mutations for collector actions & cancellation
  const assignCollector = useMutation(api.homeLab.assignCollector);
  const startCollection = useMutation(api.homeLab.startCollection);
  const confirmSampleCollected = useMutation(api.homeLab.confirmSampleCollected);
  const reportCollectionFailure = useMutation(api.homeLab.reportCollectionFailure);
  const cancelHomeLabRequest = useMutation(api.homeLab.cancelHomeLabRequest);

  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  const getStatusBadge = (status: string) => {
    const label = t(`status.${status}`, t(`homelab.status_${status}`, status));
    switch (status) {
      case "requested":
      case "validated":
        return <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-200 text-[10px]">{label}</Badge>;
      case "scheduled":
        return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">{label}</Badge>;
      case "collector_assigned":
        return <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-[10px]">{label}</Badge>;
      case "collection_in_progress":
        return <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-[10px] animate-pulse">{label}</Badge>;
      case "sample_collected":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">{label}</Badge>;
      case "in_transit":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">{label}</Badge>;
      case "received_by_lab":
      case "processing":
        return <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[10px]">{label}</Badge>;
      case "result_available":
      case "completed":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{label}</Badge>;
      case "collection_failed":
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">{label}</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-slate-100 text-slate-500 border-slate-200 text-[10px]">{label}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{label}</Badge>;
    }
  };

  const handleClaimMission = async (requestId: string) => {
    try {
      setActionLoadingId(requestId);
      await assignCollector({ requestId: requestId as Id<"homeLabRequests"> });
      toast.success("Mission prise en charge avec succès ! Vous êtes le soignant préleveur référent.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la prise en charge de la mission");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleStartCollection = async (requestId: string) => {
    try {
      setActionLoadingId(requestId);
      await startCollection({ requestId: requestId as Id<"homeLabRequests"> });
      toast.success("Visite de prélèvement démarrée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur de mise à jour");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleConfirmCollected = async (requestId: string) => {
    try {
      setActionLoadingId(requestId);
      await confirmSampleCollected({ requestId: requestId as Id<"homeLabRequests"> });
      toast.success("Prélèvement confirmé. Échantillon en cours d'acheminement.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur de confirmation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReportFailure = async (requestId: string) => {
    const reason = window.prompt("Indiquez le motif de non-réalisation du prélèvement (ex: Patient absent, non-respect du jeûne...) :");
    if (!reason || !reason.trim()) return;

    try {
      setActionLoadingId(requestId);
      await reportCollectionFailure({
        requestId: requestId as Id<"homeLabRequests">,
        reason: reason.trim(),
      });
      toast.info("Échec de prélèvement enregistré.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur d'enregistrement");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleCancelRequest = async (requestId: string) => {
    if (!window.confirm("Êtes-vous sûr de vouloir annuler cette demande de prélèvement ?")) return;

    try {
      setActionLoadingId(requestId);
      await cancelHomeLabRequest({ requestId: requestId as Id<"homeLabRequests"> });
      toast.info("Demande HomeLab annulée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'annulation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const filteredRequests = requests.filter((r) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    const matchCode = r.sampleCode.toLowerCase().includes(q);
    const matchPatient = r.patientName.toLowerCase().includes(q);
    const matchItems = r.itemNames.some((n: string) => n.toLowerCase().includes(q));
    return matchCode || matchPatient || matchItems;
  });

  const availableMissions = collectorQueue.filter((m) => m.isAvailable);
  const assignedMissions = collectorQueue.filter((m) => m.isAssignedToMe);

  return (
    <div className="space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 sm:p-6 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {t("homelab.title")}
            </h2>
            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs">
              Prélèvements à domicile
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {t("homelab.subtitle")} •{" "}
            <span className="text-emerald-700 font-medium">{t("homelab.no_ai_disclaimer")}</span>
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-auto font-medium"
        >
          <Plus className="w-4 h-4" />
          <span>{t("homelab.btn_request_analysis")}</span>
        </Button>
      </div>

      {/* Main Tabs Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Bar */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 pt-3 bg-slate-50/50">
          <div className="flex gap-2">
            <button
              onClick={() => setActiveTab("requests")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "requests"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FlaskConical className="w-4 h-4" />
              <span>{t("homelab.tab_my_requests")}</span>
              {requests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {requests.length}
                </span>
              )}
            </button>

            {role === "professionnel" && collectorEligibility?.eligible && (
              <button
                onClick={() => setActiveTab("collector")}
                className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                  activeTab === "collector"
                    ? "border-emerald-600 text-emerald-700"
                    : "border-transparent text-slate-500 hover:text-slate-800"
                }`}
              >
                <Truck className="w-4 h-4" />
                <span>{t("homelab.tab_collector")}</span>
                {collectorQueue.length > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px]">
                    {collectorQueue.length}
                  </span>
                )}
              </button>
            )}

            <button
              onClick={() => setActiveTab("catalog")}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "catalog"
                  ? "border-emerald-600 text-emerald-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <FileText className="w-4 h-4" />
              <span>{t("homelab.tab_catalog")}</span>
            </button>
          </div>

          {/* Search box for requests tab */}
          {activeTab === "requests" && (
            <div className="hidden sm:flex items-center gap-2 pb-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Rechercher par code, analyse..."
                  className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-emerald-500 w-56"
                />
              </div>
            </div>
          )}
        </div>

        {/* Tab 1: Requests List */}
        {activeTab === "requests" && (
          <div className="divide-y divide-slate-100">
            {filteredRequests.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <FlaskConical className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-medium text-slate-600">{t("homelab.empty_requests")}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Planifiez facilement une prise de sang ou un recueil d'analyses sans vous déplacer.
                </p>
                <Button
                  onClick={() => setIsCreateModalOpen(true)}
                  className="mt-4 bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  {t("homelab.btn_request_analysis")}
                </Button>
              </div>
            ) : (
              filteredRequests.map((item) => (
                <div
                  key={item._id}
                  className="p-4 sm:p-5 hover:bg-slate-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                >
                  <div className="space-y-1.5 flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                        {item.sampleCode}
                      </span>
                      {getStatusBadge(item.status)}
                      {item.fastingRequired && (
                        <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-medium">
                          Jeûne requis
                        </Badge>
                      )}
                      <span className="text-[11px] text-slate-500">
                        Prélèvement : <strong>{item.scheduledDate}</strong> ({item.scheduledTimeSlot})
                      </span>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-0.5">
                      {item.itemNames.map((name: string, idx: number) => (
                        <Badge key={idx} variant="secondary" className="text-xs font-normal">
                          {name}
                        </Badge>
                      ))}
                    </div>

                    <div className="flex items-center gap-4 text-[11px] text-slate-500 pt-1 flex-wrap">
                      <span>
                        Patient : <strong className="text-slate-700">{item.patientName}</strong>
                      </span>
                      <span>
                        Laboratoire : <strong className="text-slate-700">{item.laboratoryName}</strong>
                      </span>
                      {item.pricingSnapshot && (
                        <span className="text-emerald-700 font-bold">
                          {item.pricingSnapshot.totalAmount} MRU (Cash)
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                    {/* View Result Button if published */}
                    {item.hasPublishedResult && (
                      <Button
                        size="sm"
                        onClick={() => {
                          setSelectedResultRequestId(item._id);
                          setSelectedResultPatientId(item.patientId);
                        }}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t("homelab.btn_view_result")}</span>
                      </Button>
                    )}

                    {/* Cancel button if applicable */}
                    {(item.status === "scheduled" || item.status === "requested" || item.status === "validated") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleCancelRequest(item._id)}
                        disabled={actionLoadingId === item._id}
                        className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                      >
                        {actionLoadingId === item._id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          t("homelab.btn_cancel")
                        )}
                      </Button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}

        {/* Tab 2: Collector Tour (for Healthcare Professionals) */}
        {activeTab === "collector" && role === "professionnel" && (
          <div className="p-5 space-y-6">
            {collectorQueue.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Truck className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-medium text-slate-600">{t("homelab.no_missions_available", "Aucune mission de prélèvement disponible ou assignée.")}</p>
                <p className="text-xs text-slate-400 mt-1">
                  {t("homelab.no_missions_desc", "Les demandes de prélèvement à domicile dans votre secteur s'afficheront ici.")}
                </p>
              </div>
            ) : (
              <>
                {/* Section A: Available Missions (to claim) */}
                {availableMissions.length > 0 && (
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Badge className="bg-sky-600 text-white text-xs">
                          {availableMissions.length}
                        </Badge>
                        <h3 className="text-sm font-bold text-slate-900">
                          {t("homelab.available_missions_title", "Missions disponibles à prendre en charge dans votre zone")}
                        </h3>
                      </div>
                      <span className="text-xs text-slate-500">
                        {t("homelab.available_missions_sub", "Prenez en charge une mission pour l'intégrer à votre tournée")}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-3">
                      {availableMissions.map((mission) => (
                        <div
                          key={mission._id}
                          className="p-4 rounded-xl border border-sky-200 bg-sky-50/40 hover:bg-sky-50 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-xs">
                                {mission.sampleCode}
                              </span>
                              <Badge variant="outline" className="bg-white text-sky-800 border-sky-300 text-[10px] font-semibold">
                                À pourvoir
                              </Badge>
                              {mission.fastingRequired && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-medium">
                                  Jeûne requis
                                </Badge>
                              )}
                              <span className="text-xs text-slate-600 font-medium">
                                Passage prévu : <strong>{mission.scheduledDate}</strong> ({mission.scheduledTimeSlot})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-800 pt-0.5">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <strong className="text-slate-900">{mission.patientName}</strong>
                              <span className="text-slate-400">•</span>
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{mission.phone}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{mission.address}, {mission.city}</span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600 pt-1 flex-wrap">
                              <span>
                                Laboratoire : <strong className="text-slate-700">{mission.laboratoryName}</strong>
                              </span>
                              {mission.pricingSnapshot && (
                                <span className="text-emerald-700 font-bold">
                                  Total : {mission.pricingSnapshot.totalAmount} MRU (Cash à encaisser)
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 pt-1">
                              {mission.testNames.map((name: string, i: number) => (
                                <Badge key={i} variant="secondary" className="text-[10px]">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Claim Action */}
                          <div className="shrink-0 self-end sm:self-center">
                            <Button
                              size="sm"
                              onClick={() => handleClaimMission(mission._id)}
                              disabled={actionLoadingId === mission._id}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold shadow-sm"
                            >
                              {actionLoadingId === mission._id ? (
                                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                              ) : (
                                <Check className="w-3.5 h-3.5 mr-1.5" />
                              )}
                              <span>Prendre en charge la mission</span>
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section B: My Assigned Missions */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Badge className="bg-emerald-600 text-white text-xs">
                        {assignedMissions.length}
                      </Badge>
                      <h3 className="text-sm font-bold text-slate-900">
                        Mes prélèvements en cours (Tournée active)
                      </h3>
                    </div>
                  </div>

                  {assignedMissions.length === 0 ? (
                    <div className="p-8 text-center text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                      <p className="text-xs text-slate-500">
                        Vous n'avez aucun prélèvement en cours. Prenez en charge une mission ci-dessus pour démarrer votre tournée.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 gap-3">
                      {assignedMissions.map((mission) => (
                        <div
                          key={mission._id}
                          className="p-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50/60 transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs"
                        >
                          <div className="space-y-1.5 flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="font-mono text-xs font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded">
                                {mission.sampleCode}
                              </span>
                              {getStatusBadge(mission.status)}
                              {mission.fastingRequired && (
                                <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 font-medium">
                                  Jeûne requis
                                </Badge>
                              )}
                              <span className="text-xs text-slate-600 font-medium">
                                Prévu : <strong>{mission.scheduledDate}</strong> ({mission.scheduledTimeSlot})
                              </span>
                            </div>

                            <div className="flex items-center gap-2 text-xs text-slate-800">
                              <User className="w-3.5 h-3.5 text-slate-400" />
                              <strong>{mission.patientName}</strong>
                              <span className="text-slate-400">•</span>
                              <Phone className="w-3.5 h-3.5 text-slate-400" />
                              <span>{mission.phone}</span>
                            </div>

                            <div className="flex items-center gap-1.5 text-xs text-slate-600">
                              <MapPin className="w-3.5 h-3.5 text-slate-400" />
                              <span>{mission.address}, {mission.city}</span>
                            </div>

                            <div className="flex items-center gap-3 text-xs text-slate-600 pt-0.5 flex-wrap">
                              <span>
                                Laboratoire : <strong className="text-slate-700">{mission.laboratoryName}</strong>
                              </span>
                              {mission.pricingSnapshot && (
                                <span className="text-emerald-700 font-bold">
                                  Cash : {mission.pricingSnapshot.totalAmount} MRU
                                </span>
                              )}
                            </div>

                            <div className="flex flex-wrap gap-1 pt-1">
                              {mission.testNames.map((name: string, i: number) => (
                                <Badge key={i} variant="outline" className="text-[10px]">
                                  {name}
                                </Badge>
                              ))}
                            </div>
                          </div>

                          {/* Collector Actions */}
                          <div className="flex items-center gap-2 shrink-0 self-end sm:self-center">
                            {mission.status === "scheduled" || mission.status === "collector_assigned" ? (
                              <Button
                                size="sm"
                                onClick={() => handleStartCollection(mission._id)}
                                disabled={actionLoadingId === mission._id}
                                className="bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium"
                              >
                                {actionLoadingId === mission._id ? (
                                  <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                                ) : (
                                  <Truck className="w-3.5 h-3.5 mr-1.5" />
                                )}
                                <span>{t("homelab.start_visit", "Démarrer la visite")}</span>
                              </Button>
                            ) : mission.status === "collection_in_progress" ? (
                              <>
                                <Button
                                  size="sm"
                                  onClick={() => handleConfirmCollected(mission._id)}
                                  disabled={actionLoadingId === mission._id}
                                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5 font-medium shadow-xs"
                                >
                                  {actionLoadingId === mission._id ? (
                                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                  ) : (
                                    <CheckCircle2 className="w-3.5 h-3.5" />
                                  )}
                                  <span>{t("homelab.confirm_collected", "Confirmer prélèvement")}</span>
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handleReportFailure(mission._id)}
                                  disabled={actionLoadingId === mission._id}
                                  className="text-xs text-rose-600 border-rose-200 hover:bg-rose-50"
                                >
                                  {t("homelab.report_failure", "Signaler échec")}
                                </Button>
                              </>
                            ) : (
                              <Badge variant="outline" className="bg-slate-50 text-slate-600 text-xs">
                                {t("homelab.collection_completed", "Prélèvement achevé")}
                              </Badge>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        )}

        {/* Tab 3: Catalog View */}
        {activeTab === "catalog" && (
          <div className="p-5 space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {catalog.map((t) => (
                <div key={t.code} className="p-3.5 rounded-lg border border-slate-200 bg-slate-50/50 space-y-2">
                  <div className="flex items-start justify-between gap-2">
                    <h4 className="text-xs font-bold text-slate-900 leading-snug">{t.name}</h4>
                    <span className="font-bold text-xs text-emerald-700 shrink-0">{t.indicativePrice} MRU</span>
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.fastingRequired && (
                      <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200">
                        Jeûne requis
                      </Badge>
                    )}
                    {t.prescriptionRequired && (
                      <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200">
                        Ordonnance
                      </Badge>
                    )}
                  </div>
                  {t.preparationInstructions && (
                    <p className="text-[11px] text-slate-500 leading-relaxed pt-1 border-t border-slate-200">
                      {t.preparationInstructions}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Request Modal */}
      <CreateHomeLabRequestModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
      />

      {/* Result Modal */}
      <HomeLabResultModal
        requestId={selectedResultRequestId}
        patientId={selectedResultPatientId}
        isOpen={Boolean(selectedResultRequestId)}
        onClose={() => setSelectedResultRequestId(null)}
        userRole={role}
      />
    </div>
  );
};
