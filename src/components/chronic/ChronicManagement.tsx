import React, { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Activity,
  Heart,
  Plus,
  Clock,
  Calendar,
  Filter,
  Search,
  Share2,
  FileText,
  AlertCircle,
  Download,
  Users,
  CheckCircle2,
  Edit3,
  ChevronRight,
  TrendingUp,
  UserCheck,
  Droplet,
  Thermometer,
  ShieldCheck,
} from "lucide-react";
import { RecordMeasurementModal } from "./RecordMeasurementModal";
import { RecordCorrectionModal } from "./RecordCorrectionModal";
import { HealthChartsView, isMatchingMetric, normalizeMetricCode } from "./HealthChartsView";
import { RelayShareModal } from "./RelayShareModal";
import { CreateProgramModal } from "./CreateProgramModal";

interface ChronicManagementProps {
  role?: "patient" | "professionnel";
  userId?: string;
  initialPatientId?: string;
}

// Resilient Error Boundary to isolate runtime exceptions in clinical monitoring view
class ChronicErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error?: Error }
> {
  constructor(props: any) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("ChronicManagement error caught by boundary:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-8 text-center bg-white rounded-2xl border border-gray-200 shadow-sm space-y-4 my-6">
          <div className="h-12 w-12 rounded-xl bg-amber-50 text-amber-600 flex items-center justify-center mx-auto">
            <AlertCircle className="h-6 w-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-gray-900">
              Impossible d'afficher le suivi pour le moment
            </h3>
            <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
              Une erreur inattendue est survenue lors de l'affichage des constantes cliniques. Vos données restent sécurisées.
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => this.setState({ hasError: false })}
            className="text-xs"
          >
            Réessayer
          </Button>
        </div>
      );
    }
    return this.props.children;
  }
}

const ChronicManagementInner: React.FC<ChronicManagementProps> = ({
  role = "patient",
  userId,
  initialPatientId,
}) => {
  const { t, i18n } = useTranslation();
  const localeCode = i18n.language === "ar" ? "ar-MR" : "fr-FR";

  // Navigation tabs
  const [activeTab, setActiveTab] = useState<"overview" | "history" | "programs" | "monitored_patients">(
    role === "professionnel" ? "monitored_patients" : "overview"
  );

  // Patient selection for professionals
  const [selectedPatientId, setSelectedPatientId] = useState<Id<"users"> | undefined>(
    initialPatientId ? (initialPatientId as Id<"users">) : undefined
  );

  // Time range and metric filters
  const [timeRange, setTimeRange] = useState<"7d" | "30d" | "3m" | "6m" | "all">("30d");
  const [selectedMetric, setSelectedMetric] = useState<string>("blood_pressure");
  const [historyFilterMetric, setHistoryFilterMetric] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isCorrectionModalOpen, setIsCorrectionModalOpen] = useState(false);
  const [observationToCorrect, setObservationToCorrect] = useState<any | null>(null);
  const [isRelayModalOpen, setIsRelayModalOpen] = useState(false);
  const [isProgramModalOpen, setIsProgramModalOpen] = useState(false);

  // Monitored patients for professionals
  const rawMonitoredPatients = useQuery(
    api.chronic.getProfessionalMonitoredPatients,
    role === "professionnel" ? {} : "skip"
  );
  const monitoredPatients = rawMonitoredPatients ?? [];

  // Auto-select patient for professional if not set
  useEffect(() => {
    if (role === "professionnel" && !selectedPatientId && monitoredPatients.length > 0) {
      const firstPatient = monitoredPatients.find((p): p is NonNullable<typeof p> => p !== null);
      if (firstPatient) {
        const targetId = (firstPatient.patientId || firstPatient._id) as Id<"users">;
        setSelectedPatientId(targetId);
      }
    }
  }, [role, selectedPatientId, monitoredPatients]);

  // Determine query target patient ID:
  // For patient: always their own userId
  // For professional: selectedPatientId (skip if not selected yet)
  const targetQueryPatientId =
    role === "professionnel"
      ? selectedPatientId
      : (userId as Id<"users"> | undefined);

  const shouldSkipQueries = role === "professionnel" && !selectedPatientId;

  // Fetch chronic data
  const summary = useQuery(
    api.chronic.getPatientChronicSummary,
    shouldSkipQueries ? "skip" : { patientId: targetQueryPatientId }
  );

  const rawObservations = useQuery(
    api.chronic.getAllPatientObservations,
    shouldSkipQueries
      ? "skip"
      : {
          patientId: targetQueryPatientId,
          measurementCode: historyFilterMetric !== "all" ? historyFilterMetric : undefined,
        }
  );

  const rawPrograms = useQuery(
    api.chronic.getMonitoringPrograms,
    shouldSkipQueries ? "skip" : { patientId: targetQueryPatientId }
  );

  const updateProgramStatus = useMutation(api.chronic.updateProgramStatus);

  // Loading state gate: display clean skeleton while queries resolve
  const isDataLoading =
    (!shouldSkipQueries && (rawObservations === undefined || rawPrograms === undefined)) ||
    (role === "professionnel" && rawMonitoredPatients === undefined);

  // Safe normalized arrays
  const observationsData = rawObservations ?? [];
  const programs = rawPrograms ?? [];

  // Format observations for chart and list
  const observations = (observationsData as any[]).map((obs: any) => ({
    _id: String(obs._id),
    measurementCode: obs.measurementCode || "general",
    numericValue: obs.numericValue,
    secondaryNumericValue: obs.secondaryNumericValue,
    textValue: obs.textValue,
    unit: obs.unit,
    observedAt: obs.observedAt || obs._creationTime || 0,
    context: obs.context,
    clinicalNotes: obs.notes || obs.clinicalNotes,
    source: obs.source || "patient_manual",
    status: obs.isCorrection ? "corrected" : "active",
    attentionFlag: obs.attentionFlag
      ? {
          severity: obs.attentionSeverity || "info",
          message: "Mesure méritant attention",
        }
      : undefined,
  }));

  // Filter observations for history table
  const filteredHistory = observations.filter((obs: any) => {
    if (historyFilterMetric !== "all" && !isMatchingMetric(obs.measurementCode, historyFilterMetric)) {
      return false;
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const codeMatch = (obs.measurementCode || "").toLowerCase().includes(q);
      const notesMatch = (obs.clinicalNotes || "").toLowerCase().includes(q);
      const sourceMatch = (obs.source || "").toLowerCase().includes(q);
      return codeMatch || notesMatch || sourceMatch;
    }
    return true;
  });

  // Export to CSV
  const handleExportCSV = () => {
    if (observations.length === 0) {
      toast.error("Aucune mesure à exporter.");
      return;
    }

    const headers = ["ID", "Date", "Heure", "Type", "Valeur", "Unité", "Contexte", "Source", "Statut", "Notes"];
    const rows = observations.map((obs: any) => {
      const d = new Date(obs.observedAt);
      const dateStr = d.toLocaleDateString("fr-FR");
      const timeStr = d.toLocaleTimeString("fr-FR");
      const isBp = isMatchingMetric(obs.measurementCode, "blood_pressure");
      const valStr = isBp
        ? `${obs.numericValue ?? ""}/${obs.secondaryNumericValue ?? 80}`
        : obs.textValue || obs.numericValue || "";

      return [
        obs._id,
        dateStr,
        timeStr,
        obs.measurementCode,
        valStr,
        obs.unit || "",
        obs.context || "",
        obs.source,
        obs.status,
        `"${(obs.clinicalNotes || "").replace(/"/g, '""')}"`,
      ].join(",");
    });

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `mauricaire_suivi_sante_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    toast.success("Historique exporté au format CSV.");
  };

  const getSourceBadge = (source: string) => {
    switch (source) {
      case "patient_manual":
        return <Badge variant="outline" className="text-gray-600 bg-gray-50 border-gray-200">Patient</Badge>;
      case "professional_manual":
        return <Badge className="bg-teal-50 text-teal-700 border-teal-200">Professionnel</Badge>;
      case "consultation":
        return <Badge className="bg-blue-50 text-blue-700 border-blue-200">Consultation</Badge>;
      case "homelab":
        return <Badge className="bg-purple-50 text-purple-700 border-purple-200">HomeLab</Badge>;
      case "connected_device":
        return <Badge className="bg-amber-50 text-amber-700 border-amber-200">Dispositif</Badge>;
      default:
        return <Badge variant="outline">{source}</Badge>;
    }
  };

  const getMetricLabel = (code: string) => {
    const norm = normalizeMetricCode(code);
    switch (norm) {
      case "blood_pressure":
        return "Tension artérielle";
      case "heart_rate":
        return "Fréquence cardiaque";
      case "blood_glucose":
        return "Glycémie";
      case "temperature":
        return "Température";
      case "weight":
        return "Poids";
      case "spo2":
        return "SpO2";
      case "hba1c":
        return "HbA1c";
      default:
        return code;
    }
  };

  const handleStatusChange = async (programId: Id<"monitoringPrograms">, newStatus: any) => {
    try {
      await updateProgramStatus({ programId, status: newStatus });
      toast.success("Statut du programme actualisé.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour.");
    }
  };

  const selectedPatientObj = monitoredPatients.find(
    (p: any) => String(p.patientId || p._id) === String(selectedPatientId)
  );

  if (isDataLoading) {
    return (
      <div className="space-y-6 pb-12 animate-pulse">
        <div className="bg-white p-6 rounded-2xl border border-gray-200 h-24" />
        <div className="h-10 bg-gray-200/60 rounded-xl w-72" />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-white p-5 rounded-2xl border border-gray-200 h-40" />
          <div className="bg-white p-5 rounded-2xl border border-gray-200 h-40" />
          <div className="bg-white p-5 rounded-2xl border border-gray-200 h-40" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-12">
      {/* Header section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-gray-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-teal-50 text-teal-700 rounded-xl">
              <Activity className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                {t("chronic.title", "Suivi Santé & Constantes")}
              </h1>
              <p className="text-sm text-gray-500">
                {t(
                  "chronic.subtitle",
                  "Surveillance longitudinale des paramètres vitaux, des pathologies et des programmes de soins"
                )}
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Button
            variant="outline"
            onClick={handleExportCSV}
            className="flex items-center gap-2 text-xs border-gray-300"
          >
            <Download className="h-4 w-4 text-gray-600" />
            <span>Exporter (CSV)</span>
          </Button>

          {role === "professionnel" && selectedPatientId && (
            <Button
              variant="outline"
              onClick={() => setIsRelayModalOpen(true)}
              className="flex items-center gap-2 text-xs border-teal-200 text-teal-700 hover:bg-teal-50"
            >
              <Share2 className="h-4 w-4" />
              <span>Avis Relay</span>
            </Button>
          )}

          <Button
            onClick={() => setIsProgramModalOpen(true)}
            variant="outline"
            className="flex items-center gap-2 text-xs border-gray-300"
          >
            <Calendar className="h-4 w-4 text-gray-600" />
            <span>Nouveau programme</span>
          </Button>

          <Button
            onClick={() => setIsAddModalOpen(true)}
            className="flex items-center gap-2 text-xs bg-teal-600 hover:bg-teal-700 text-white font-medium shadow-sm shadow-teal-600/20"
          >
            <Plus className="h-4 w-4" />
            <span>{t("chronic.btn_add_measurement", "Ajouter une mesure")}</span>
          </Button>
        </div>
      </div>

      {/* Attention banner if any attention flags exist */}
      {summary?.attentionFlags && summary.attentionFlags.length > 0 && (
        <div className="p-4 bg-amber-50/80 border border-amber-200 rounded-2xl flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
          <div className="text-xs text-amber-900 space-y-1">
            <span className="font-bold block text-sm">
              {t("chronic.alert_attention_title", "Attention recommandée")}
            </span>
            <p>
              {t(
                "chronic.alert_attention_message",
                "Certaines mesures récentes méritent l'attention de votre professionnel de santé."
              )}
            </p>
            <div className="flex flex-wrap gap-2 pt-1">
              {summary.attentionFlags.map((flag: any, i: number) => (
                <span key={i} className="inline-flex items-center px-2 py-0.5 rounded bg-white/70 text-amber-800 text-[11px] font-medium border border-amber-200">
                  {flag.measurementCode}: {flag.message}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Professional patient selector strip */}
      {role === "professionnel" && (
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <Users className="h-4 w-4 text-teal-600 shrink-0" />
            <span className="text-xs font-semibold text-gray-700">Dossier Patient :</span>
            {monitoredPatients.length > 0 ? (
              <select
                value={selectedPatientId ? String(selectedPatientId) : ""}
                onChange={(e) => {
                  const val = e.target.value;
                  setSelectedPatientId(val ? (val as Id<"users">) : undefined);
                }}
                className="text-xs font-bold bg-teal-50/60 border border-teal-300 text-teal-900 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {monitoredPatients.map((p: any) => {
                  const pid = String(p.patientId || p._id);
                  const pName = p.patientName || p.name || "Patient";
                  const count = p.observationCount ?? 0;
                  return (
                    <option key={pid} value={pid}>
                      {pName} ({count} mesure{count > 1 ? "s" : ""})
                    </option>
                  );
                })}
              </select>
            ) : (
              <span className="text-xs text-gray-400 italic">
                Aucun patient sous surveillance active
              </span>
            )}

            {selectedPatientObj && (
              <Badge variant="outline" className="bg-teal-50 text-teal-800 border-teal-200 text-[11px] font-medium">
                {selectedPatientObj.observationCount ?? 0} mesure(s) disponible(s)
              </Badge>
            )}
          </div>

          {selectedPatientId && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setActiveTab("overview")}
              className="text-xs text-teal-700 hover:bg-teal-50 self-start sm:self-auto font-medium"
            >
              {t("chronic.show_charts_metrics", "Afficher les courbes & métriques")}
            </Button>
          )}
        </div>
      )}

      {/* Tabs navigation */}
      <div className="flex border-b border-gray-200 gap-6">
        {role === "professionnel" && (
          <button
            onClick={() => setActiveTab("monitored_patients")}
            className={`pb-3 text-sm font-semibold transition-all relative ${
              activeTab === "monitored_patients"
                ? "text-teal-600 border-b-2 border-teal-600"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {t("chronic.tab_monitored_patients", "Patients sous surveillance")}
            {monitoredPatients.length > 0 && (
              <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-teal-100 text-teal-800">
                {monitoredPatients.length}
              </span>
            )}
          </button>
        )}

        <button
          onClick={() => setActiveTab("overview")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "overview"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("chronic.tab_overview", "Vue d'ensemble & Graphiques")}
        </button>

        <button
          onClick={() => setActiveTab("history")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "history"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("chronic.tab_history", "Historique des mesures")}
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
            {observations.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab("programs")}
          className={`pb-3 text-sm font-semibold transition-all relative ${
            activeTab === "programs"
              ? "text-teal-600 border-b-2 border-teal-600"
              : "text-gray-500 hover:text-gray-700"
          }`}
        >
          {t("chronic.tab_programs", "Programmes de suivi")}
          <span className="ml-2 px-1.5 py-0.5 rounded-full text-[10px] bg-gray-100 text-gray-600">
            {programs.length}
          </span>
        </button>
      </div>

      {/* Tab 1: Monitored Patients (For Professionals) */}
      {role === "professionnel" && activeTab === "monitored_patients" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {monitoredPatients.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200">
                <Users className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-medium text-gray-600">
                  {t("chronic.empty_monitored_patients", "Aucun patient sous surveillance active.")}
                </p>
                <p className="text-xs text-gray-400 mt-1">
                  {t("chronic.patients_appear_here", "Les patients avec qui vous avez eu une consultation, un rendez-vous ou un prélèvement HomeLab s'afficheront ici.")}
                </p>
              </div>
            ) : (
              monitoredPatients.map((p: any) => {
                const patientId = p.patientId || p._id;
                const patientName = p.patientName || p.name || "Patient";
                const relationship = p.relationship || "Patient suivi";
                const obsCount = p.observationCount ?? 0;
                const progCount = p.activeProgramsCount ?? 0;
                const isSelected = String(selectedPatientId) === String(patientId);

                return (
                  <div
                    key={String(patientId)}
                    className={`p-5 bg-white rounded-2xl border transition-all shadow-sm cursor-pointer ${
                      isSelected
                        ? "border-teal-500 ring-2 ring-teal-500/20 bg-teal-50/20"
                        : "border-gray-200 hover:border-gray-300 hover:shadow-xs"
                    }`}
                    onClick={() => {
                      setSelectedPatientId(patientId);
                      setActiveTab("overview");
                    }}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-teal-50 flex items-center justify-center text-teal-700 font-bold text-sm">
                          {(patientName?.[0] || "P").toUpperCase()}
                        </div>
                        <div>
                          <h4 className="text-sm font-bold text-gray-900">{patientName}</h4>
                          <span className="text-[11px] text-gray-400">{relationship}</span>
                        </div>
                      </div>
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    </div>

                    {p.hasRecentAttentionFlag && (
                      <div className="mt-3 p-2 bg-amber-50 rounded-lg flex items-center gap-1.5 text-xs text-amber-800">
                        <AlertCircle className="h-3.5 w-3.5 text-amber-600" />
                        <span>{t("chronic.attention_recommended_recent", "Attention recommandée sur récentes mesures")}</span>
                      </div>
                    )}

                    <div className="mt-4 pt-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-500">
                      <span className="font-semibold text-teal-700">{obsCount} mesure{obsCount > 1 ? "s" : ""}</span>
                      <span>{progCount} prog. actif{progCount > 1 ? "s" : ""}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Overview & Charts */}
      {activeTab === "overview" && (
        <div className="space-y-6">
          {/* Latest Vitals Overview Strip */}
          {summary?.latestVitals && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {/* Tension Artérielle */}
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-red-600 text-xs font-semibold">
                  <Heart className="h-4 w-4" />
                  <span>{t("chronic.tension_short", "Tension")}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {summary.latestVitals.bp ? summary.latestVitals.bp.text : "—"}
                </div>
                <span className="text-[10px] text-gray-400 block">
                  {summary.latestVitals.bp
                    ? t("chronic.recorded_on", {
                        date: new Date(summary.latestVitals.bp.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
                        defaultValue: `Relevé le ${new Date(summary.latestVitals.bp.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" })}`
                      })
                    : t("chronic.no_measure", "Aucune mesure")}
                </span>
              </div>

              {/* Fréquence Cardiaque */}
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-rose-600 text-xs font-semibold">
                  <Activity className="h-4 w-4" />
                  <span>{t("chronic.heart_rate_short", "Fréquence card.")}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {summary.latestVitals.pulse ? `${summary.latestVitals.pulse.value} bpm` : "—"}
                </div>
                <span className="text-[10px] text-gray-400 block">
                  {summary.latestVitals.pulse
                    ? t("chronic.recorded_on", {
                        date: new Date(summary.latestVitals.pulse.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
                        defaultValue: `Relevé le ${new Date(summary.latestVitals.pulse.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" })}`
                      })
                    : t("chronic.no_measure", "Aucune mesure")}
                </span>
              </div>

              {/* Glycémie */}
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-blue-600 text-xs font-semibold">
                  <Droplet className="h-4 w-4" />
                  <span>{t("chronic.blood_glucose_short", "Glycémie")}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {summary.latestVitals.glucose ? `${summary.latestVitals.glucose.value} ${summary.latestVitals.glucose.unit}` : "—"}
                </div>
                <span className="text-[10px] text-gray-400 block">
                  {summary.latestVitals.glucose
                    ? t("chronic.recorded_on", {
                        date: new Date(summary.latestVitals.glucose.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
                        defaultValue: `Relevé le ${new Date(summary.latestVitals.glucose.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" })}`
                      })
                    : t("chronic.no_measure", "Aucune mesure")}
                </span>
              </div>

              {/* Température */}
              <div className="p-4 bg-white rounded-xl border border-gray-200 shadow-xs space-y-1">
                <div className="flex items-center gap-1.5 text-orange-600 text-xs font-semibold">
                  <Thermometer className="h-4 w-4" />
                  <span>{t("chronic.temperature_short", "Température")}</span>
                </div>
                <div className="text-xl font-bold text-gray-900">
                  {summary.latestVitals.temperature ? `${summary.latestVitals.temperature.value} ${summary.latestVitals.temperature.unit}` : "—"}
                </div>
                <span className="text-[10px] text-gray-400 block">
                  {summary.latestVitals.temperature
                    ? t("chronic.recorded_on", {
                        date: new Date(summary.latestVitals.temperature.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" }),
                        defaultValue: `Relevé le ${new Date(summary.latestVitals.temperature.observedAt).toLocaleDateString(localeCode, { day: "numeric", month: "short" })}`
                      })
                    : t("chronic.no_measure", "Aucune mesure")}
                </span>
              </div>
            </div>
          )}

          <HealthChartsView
            observations={observations}
            selectedMetric={selectedMetric}
            onSelectMetric={setSelectedMetric}
            timeRange={timeRange}
            onTimeRangeChange={setTimeRange}
          />
        </div>
      )}

      {/* Tab 3: Detailed History Table */}
      {activeTab === "history" && (
        <div className="space-y-4">
          {/* History filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <Filter className="h-4 w-4 text-gray-500" />
              <select
                value={historyFilterMetric}
                onChange={(e) => setHistoryFilterMetric(e.target.value)}
                className="text-xs bg-gray-50 border border-gray-200 rounded-lg px-2.5 py-1.5 font-medium text-gray-700"
              >
                <option value="all">{t("chronic.all_measures", "Toutes les mesures")}</option>
                <option value="blood_pressure">{t("chronic.metric_blood_pressure", "Tension artérielle")}</option>
                <option value="blood_glucose">{t("chronic.metric_blood_glucose", "Glycémie")}</option>
                <option value="heart_rate">{t("chronic.metric_heart_rate", "Fréquence cardiaque")}</option>
                <option value="weight">{t("chronic.metric_weight", "Poids")}</option>
                <option value="spo2">{t("chronic.metric_spo2", "SpO2")}</option>
                <option value="temperature">{t("chronic.metric_temperature", "Température")}</option>
                <option value="symptoms">{t("chronic.metric_symptoms", "Symptômes & Notes")}</option>
              </select>
            </div>

            <div className="relative w-full sm:w-64">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-gray-400" />
              <Input
                type="text"
                placeholder={t("chronic.search_notes_placeholder", "Rechercher par note ou source...")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 text-xs bg-gray-50 h-8"
              />
            </div>
          </div>

          {/* Table */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Date & Heure</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Valeur</th>
                    <th className="py-3 px-4">Contexte</th>
                    <th className="py-3 px-4">Source</th>
                    <th className="py-3 px-4">Remarques</th>
                    <th className="py-3 px-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredHistory.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-gray-400">
                        {t("chronic.empty_observations", "Aucune mesure enregistrée sur cette période.")}
                      </td>
                    </tr>
                  ) : (
                    filteredHistory.map((obs: any) => {
                      const date = new Date(obs.observedAt);
                      const isBp = isMatchingMetric(obs.measurementCode, "blood_pressure");
                      const displayVal = isBp
                        ? `${obs.numericValue ?? ""}/${obs.secondaryNumericValue ?? 80} ${obs.unit || "mmHg"}`
                        : obs.textValue
                        ? obs.textValue
                        : `${obs.numericValue ?? ""} ${obs.unit || ""}`.trim();

                      return (
                        <tr key={obs._id} className="hover:bg-gray-50/70 transition-colors">
                          <td className="py-3 px-4 font-medium text-gray-900 whitespace-nowrap">
                            {date.toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "short",
                              year: "numeric",
                            })}{" "}
                            <span className="text-gray-400 font-normal">
                              {date.toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </td>
                          <td className="py-3 px-4 font-semibold text-gray-700">
                            {getMetricLabel(obs.measurementCode)}
                          </td>
                          <td className="py-3 px-4">
                            <span className="font-bold text-gray-900 text-sm">{displayVal}</span>
                            {obs.status === "corrected" && (
                              <Badge className="ml-2 bg-amber-50 text-amber-700 border-amber-200 text-[10px]">
                                {t("chronic.badge_corrected", "Corrigé")}
                              </Badge>
                            )}
                          </td>
                          <td className="py-3 px-4 text-gray-600">
                            {obs.context || "—"}
                          </td>
                          <td className="py-3 px-4">{getSourceBadge(obs.source)}</td>
                          <td className="py-3 px-4 text-gray-500 max-w-xs truncate">
                            {obs.clinicalNotes || "—"}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setObservationToCorrect(obs);
                                setIsCorrectionModalOpen(true);
                              }}
                              className="h-7 px-2 text-gray-500 hover:text-amber-700"
                            >
                              <Edit3 className="h-3.5 w-3.5" />
                            </Button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Monitoring Programs */}
      {activeTab === "programs" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {programs.length === 0 ? (
              <div className="col-span-full py-12 text-center text-gray-400 bg-white rounded-2xl border border-gray-200 space-y-2">
                <Calendar className="h-8 w-8 mx-auto mb-2 text-gray-300" />
                <p className="text-sm font-semibold text-gray-700">
                  {t("chronic.empty_programs", "Aucun programme de suivi actif pour le moment.")}
                </p>
                <p className="text-xs text-gray-400 max-w-md mx-auto">
                  {t("chronic.program_creation_optional", "La création d'un programme de suivi est optionnelle. Les mesures et constantes historiques restent toujours consultables dans l'onglet Historique et la Vue d'ensemble.")}
                </p>
                <Button
                  onClick={() => setIsProgramModalOpen(true)}
                  className="mt-3 bg-teal-600 hover:bg-teal-700 text-white text-xs"
                >
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  <span>{t("chronic.create_program_btn", "Créer un programme de suivi")}</span>
                </Button>
              </div>
            ) : (
              programs.map((prog: any) => {
                const measurementCodes: string[] = Array.isArray(prog.requiredMeasurementCodes)
                  ? prog.requiredMeasurementCodes
                  : Array.isArray(prog.measurementCodes)
                  ? prog.measurementCodes
                  : [];
                const freqText = prog.frequency || prog.expectedFrequency || "Quotidien";
                const descText = prog.description || prog.notes || "Aucune consigne particulière.";

                return (
                  <div key={String(prog._id)} className="p-5 bg-white rounded-2xl border border-gray-200 shadow-sm space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h4 className="font-bold text-gray-900 text-base">{prog.title || "Programme de suivi"}</h4>
                        <p className="text-xs text-gray-500 mt-0.5">{descText}</p>
                      </div>
                      <Badge
                        className={
                          prog.status === "active"
                            ? "bg-teal-50 text-teal-700 border-teal-200"
                            : prog.status === "paused"
                            ? "bg-amber-50 text-amber-700 border-amber-200"
                            : "bg-gray-100 text-gray-700 border-gray-200"
                        }
                      >
                        {prog.status === "active" ? t("chronic.prog_active", "Actif") : prog.status === "paused" ? t("chronic.prog_paused", "En pause") : t("chronic.prog_completed", "Terminé")}
                      </Badge>
                    </div>

                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {measurementCodes.length === 0 ? (
                        <span className="text-[11px] text-gray-400 italic">{t("chronic.general_vitals", "Constantes générales")}</span>
                      ) : (
                        measurementCodes.map((code: string, idx: number) => (
                          <span
                            key={`${prog._id}-${code}-${idx}`}
                            className="px-2 py-0.5 rounded bg-gray-100 text-gray-700 text-[11px] font-medium"
                          >
                            {getMetricLabel(code)}
                          </span>
                        ))
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs text-gray-500 pt-2 border-t border-gray-100">
                      <span>Fréquence : {freqText}</span>
                      <div className="flex items-center gap-2">
                        {prog.status === "active" ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(prog._id, "paused")}
                            className="h-7 text-xs text-amber-600 hover:bg-amber-50"
                          >
                            {t("chronic.pause", "Mettre en pause")}
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleStatusChange(prog._id, "active")}
                            className="h-7 text-xs text-teal-600 hover:bg-teal-50"
                          >
                            {t("chronic.reactivate", "Réactiver")}
                          </Button>
                        )}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleStatusChange(prog._id, "completed")}
                          className="h-7 text-xs text-gray-600 hover:bg-gray-100"
                        >
                          {t("chronic.complete", "Terminer")}
                        </Button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Modals */}
      <RecordMeasurementModal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        patientId={selectedPatientId}
        userRole={role}
        defaultMeasurementCode={selectedMetric}
      />

      <RecordCorrectionModal
        isOpen={isCorrectionModalOpen}
        onClose={() => {
          setIsCorrectionModalOpen(false);
          setObservationToCorrect(null);
        }}
        observation={observationToCorrect}
      />

      {selectedPatientId && (
        <RelayShareModal
          isOpen={isRelayModalOpen}
          onClose={() => setIsRelayModalOpen(false)}
          patientId={selectedPatientId}
          observations={observations}
        />
      )}

      <CreateProgramModal
        isOpen={isProgramModalOpen}
        onClose={() => setIsProgramModalOpen(false)}
        patientId={selectedPatientId}
      />
    </div>
  );
};

export const ChronicManagement: React.FC<ChronicManagementProps> = (props) => {
  return (
    <ChronicErrorBoundary>
      <ChronicManagementInner {...props} />
    </ChronicErrorBoundary>
  );
};
