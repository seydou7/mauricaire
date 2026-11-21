import React, { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  AlertTriangle,
  Clock,
  Send,
  CheckCircle2,
  XCircle,
  FileText,
  Activity,
  HeartPulse,
  Thermometer,
  ShieldCheck,
  User,
  ExternalLink,
  MessageSquare,
  Lock,
  Loader2,
  Calendar,
} from "lucide-react";

interface RelayDetailModalProps {
  relayId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onStatusChange?: () => void;
}

export const RelayDetailModal: React.FC<RelayDetailModalProps> = ({
  relayId,
  isOpen,
  onClose,
  onStatusChange,
}) => {
  const { t } = useTranslation();

  const relay = useQuery(
    api.relay.getRelayDetails,
    relayId ? { relayId: relayId as Id<"relayRequests"> } : "skip"
  );

  const messages = useQuery(
    api.relay.getRelayMessages,
    relayId && relay?.canAccessFullClinicalData
      ? { relayId: relayId as Id<"relayRequests"> }
      : "skip"
  );

  const acceptRelayRequest = useMutation(api.relay.acceptRelayRequest);
  const declineRelayRequest = useMutation(api.relay.declineRelayRequest);
  const sendRelayMessage = useMutation(api.relay.sendRelayMessage);
  const submitProfessionalResponse = useMutation(api.relay.submitProfessionalResponse);
  const completeRelayRequest = useMutation(api.relay.completeRelayRequest);
  const cancelRelayRequest = useMutation(api.relay.cancelRelayRequest);

  // Local state
  const [activeTab, setActiveTab] = useState<"clinical" | "discussion" | "opinion">("clinical");
  const [newMessage, setNewMessage] = useState("");
  const [isSendingMessage, setIsSendingMessage] = useState(false);

  // Professional Response Form
  const [showResponseForm, setShowResponseForm] = useState(false);
  const [responseSummary, setResponseSummary] = useState("");
  const [responseOpinion, setResponseOpinion] = useState("");
  const [responseNextStep, setResponseNextStep] = useState("");
  const [responseFollowUp, setResponseFollowUp] = useState(false);
  const [isSubmittingResponse, setIsSubmittingResponse] = useState(false);

  // Close with outcome form
  const [showCloseForm, setShowCloseForm] = useState(false);
  const [relayOutcome, setRelayOutcome] = useState("");
  const [isSubmittingClose, setIsSubmittingClose] = useState(false);

  // Actions loading
  const [isActionLoading, setIsActionLoading] = useState(false);

  if (!isOpen || !relayId) return null;

  const handleAccept = async () => {
    try {
      setIsActionLoading(true);
      await acceptRelayRequest({ relayId: relayId as Id<"relayRequests"> });
      toast.success("Demande Relay acceptée avec succès. Vous avez désormais accès au dossier complet.");
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'acceptation");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleDecline = async () => {
    if (!window.confirm("Êtes-vous sûr de vouloir décliner cette demande ?")) return;
    try {
      setIsActionLoading(true);
      await declineRelayRequest({ relayId: relayId as Id<"relayRequests"> });
      toast.info("Demande Relay déclinée.");
      onClose();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du refus");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm("Confirmez-vous l'annulation de cette demande Relay ?")) return;
    try {
      setIsActionLoading(true);
      await cancelRelayRequest({ relayId: relayId as Id<"relayRequests"> });
      toast.info("Demande Relay annulée.");
      onClose();
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'annulation");
    } finally {
      setIsActionLoading(false);
    }
  };

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;

    try {
      setIsSendingMessage(true);
      await sendRelayMessage({
        relayId: relayId as Id<"relayRequests">,
        content: newMessage.trim(),
      });
      setNewMessage("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi du message");
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleSubmitResponse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (responseSummary.trim().length < 5 || responseOpinion.trim().length < 10) {
      toast.error("Veuillez remplir l'ensemble des champs d'avis clinique.");
      return;
    }

    try {
      setIsSubmittingResponse(true);
      await submitProfessionalResponse({
        relayId: relayId as Id<"relayRequests">,
        summary: responseSummary.trim(),
        professionalOpinion: responseOpinion.trim(),
        recommendedNextStep: responseNextStep.trim(),
        followUpAdvised: responseFollowUp,
      });
      toast.success("Avis clinique structuré transmis avec succès !");
      setShowResponseForm(false);
      setActiveTab("opinion");
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la soumission de l'avis");
    } finally {
      setIsSubmittingResponse(false);
    }
  };

  const handleCompleteRelay = async (e: React.FormEvent) => {
    e.preventDefault();
    if (relayOutcome.trim().length < 10) {
      toast.error("Veuillez renseigner une synthèse de coordination d'au moins 10 caractères.");
      return;
    }

    try {
      setIsSubmittingClose(true);
      await completeRelayRequest({
        relayId: relayId as Id<"relayRequests">,
        relayOutcome: relayOutcome.trim(),
      });
      toast.success("Relay finalisé et synthèse consignée dans le suivi du patient.");
      setShowCloseForm(false);
      if (onStatusChange) onStatusChange();
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la clôture");
    } finally {
      setIsSubmittingClose(false);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200">{t("relay.status_requested", "En attente d'avis")}</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200">{t("relay.status_accepted", "Acceptée")}</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200">{t("relay.status_in_progress", "En cours d'échange")}</Badge>;
      case "answered":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">{t("relay.status_answered", "Avis rendu")}</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200">{t("relay.status_completed", "Clôturée")}</Badge>;
      case "declined":
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200">{t("relay.status_declined", "Déclinée")}</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200">{t("relay.status_cancelled", "Annulée")}</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-hidden flex flex-col p-0">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 bg-slate-50/50">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap mb-1">
                <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
                  MauriCare Relay
                </Badge>
                {relay && getStatusBadge(relay.status)}
                {relay?.urgencyLevel === "priority" ? (
                  <Badge className="bg-rose-600 text-white text-xs flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3" />
                    Prioritaire (&lt; 12h)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-slate-600 text-xs flex items-center gap-1">
                    <Clock className="w-3 h-3 text-slate-400" />
                    Standard
                  </Badge>
                )}
              </div>
              <DialogTitle className="text-lg font-bold text-slate-900">
                {relay?.reason || "Détail de la demande Relay"}
              </DialogTitle>
              <DialogDescription className="text-xs text-slate-500 mt-0.5">
                Patient : <strong className="text-slate-700">{relay?.patientName}</strong>
                {relay?.patientBirthDate && ` • Né(e) le ${relay.patientBirthDate}`}
                {relay?.createdAt && ` • Émise le ${new Date(relay.createdAt).toLocaleDateString()}`}
              </DialogDescription>
            </div>
          </div>

          {/* Participants summary bar */}
          <div className="mt-3 grid grid-cols-2 gap-2 text-xs p-2.5 bg-white border border-slate-200 rounded-lg">
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Demandeur</span>
              <span className="font-medium text-slate-800">{relay?.requesterName}</span>
              <span className="text-slate-500 block text-[11px] capitalize">{relay?.requesterSpecialty}</span>
            </div>
            <div>
              <span className="text-slate-400 block text-[10px] uppercase font-semibold">Praticien consultant</span>
              {relay?.responderName ? (
                <>
                  <span className="font-medium text-slate-800">{relay.responderName}</span>
                  <span className="text-slate-500 block text-[11px] capitalize">{relay.responderSpecialty || relay.requestedSpecialty}</span>
                </>
              ) : (
                <span className="text-amber-600 font-medium">Spécialité requise : {relay?.requestedSpecialty}</span>
              )}
            </div>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-slate-200 px-5 bg-white text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("clinical")}
            className={`py-3 px-3 border-b-2 transition-colors ${
              activeTab === "clinical"
                ? "border-teal-600 text-teal-700 font-semibold"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            Dossier & Observations
          </button>
          {relay?.canAccessFullClinicalData && (
            <button
              type="button"
              onClick={() => setActiveTab("discussion")}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "discussion"
                  ? "border-teal-600 text-teal-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              Échanges Confraternels
              {messages && messages.length > 0 && (
                <span className="bg-slate-100 text-slate-700 rounded-full px-1.5 py-0.5 text-[10px]">
                  {messages.length}
                </span>
              )}
            </button>
          )}
          {(relay?.professionalResponse || relay?.isAssigned) && (
            <button
              type="button"
              onClick={() => setActiveTab("opinion")}
              className={`py-3 px-3 border-b-2 transition-colors flex items-center gap-1.5 ${
                activeTab === "opinion"
                  ? "border-teal-600 text-teal-700 font-semibold"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              Avis Structuré
              {relay?.professionalResponse && (
                <span className="w-2 h-2 rounded-full bg-teal-500"></span>
              )}
            </button>
          )}
        </div>

        {/* Tab Contents */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {!relay ? (
            <div className="flex items-center justify-center p-8">
              <Loader2 className="w-6 h-6 animate-spin text-teal-600" />
            </div>
          ) : (
            <>
              {/* Triage / Minimization banner if peer reviewing open request */}
              {!relay.canAccessFullClinicalData && relay.status === "requested" && (
                <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800 flex items-start gap-2.5">
                  <Lock className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <p className="font-semibold">{t("relay.triage_mode", "Mode Triage & Minimisation des données")}</p>
                    <p className="text-amber-700 mt-0.5">
                      {t("relay.data_minimization_notice")} Pour consulter les observations complètes, les constantes vitales et les pièces jointes privées, acceptez cette demande.
                    </p>
                  </div>
                </div>
              )}

              {/* TAB: CLINICAL DOSSIER */}
              {activeTab === "clinical" && (
                <div className="space-y-4 text-sm">
                  {/* Observations */}
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                    <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider mb-2">
                      {t("relay.observations")}
                    </h4>
                    <p className="text-slate-800 whitespace-pre-wrap leading-relaxed text-sm">
                      {relay.clinicalContext?.observations}
                    </p>

                    {relay.clinicalContext?.carePerformed && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-xs font-semibold text-slate-600 block mb-1">
                          {t("relay.care_performed")} :
                        </span>
                        <p className="text-slate-700 text-xs">
                          {relay.clinicalContext.carePerformed}
                        </p>
                      </div>
                    )}

                    {relay.clinicalContext?.symptoms && relay.clinicalContext.symptoms.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <span className="text-xs font-semibold text-slate-600 block mb-1">
                          {t("relay.symptoms")} :
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {relay.clinicalContext.symptoms.map((s: string, idx: number) => (
                            <Badge key={idx} variant="secondary" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Vitals Snapshot (if authorized) */}
                  {relay.selectedVitals && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <Activity className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                          {t("relay.vital_signs")}
                        </h4>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                        {relay.selectedVitals.bloodPressure && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Tension</span>
                            <span className="text-sm font-bold text-slate-800">{relay.selectedVitals.bloodPressure}</span>
                          </div>
                        )}
                        {relay.selectedVitals.pulse !== undefined && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Pouls</span>
                            <span className="text-sm font-bold text-slate-800">{relay.selectedVitals.pulse} bpm</span>
                          </div>
                        )}
                        {relay.selectedVitals.temperature !== undefined && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">Température</span>
                            <span className="text-sm font-bold text-slate-800">{relay.selectedVitals.temperature} °C</span>
                          </div>
                        )}
                        {relay.selectedVitals.spO2 !== undefined && (
                          <div className="bg-white p-2.5 rounded border border-slate-200">
                            <span className="text-[10px] text-slate-400 block uppercase font-semibold">SpO2</span>
                            <span className="text-sm font-bold text-slate-800">{relay.selectedVitals.spO2} %</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Private Attachments */}
                  {relay.attachments && relay.attachments.length > 0 && (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-3">
                        <FileText className="w-4 h-4 text-teal-600" />
                        <h4 className="text-xs font-bold uppercase text-slate-500 tracking-wider">
                          {t("relay.attachments")} ({relay.attachments.length})
                        </h4>
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                        {relay.attachments.map((att: any, idx: number) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between p-2.5 bg-white border border-slate-200 rounded-md"
                          >
                            <div className="truncate mr-2">
                              <span className="font-medium text-slate-800 block truncate text-xs">
                                {att.name}
                              </span>
                              <span className="text-[10px] text-slate-400">
                                {att.category === "wound_photo" ? "Photo lésion" : "Document"} • {Math.round(att.size / 1024)} Ko
                              </span>
                            </div>
                            {att.url ? (
                              <a
                                href={att.url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-teal-600 hover:text-teal-700 p-1 shrink-0"
                              >
                                <ExternalLink className="w-4 h-4" />
                              </a>
                            ) : (
                              <span className="text-slate-300">
                                <Lock className="w-3.5 h-3.5" />
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Relay Final Outcome Summary if completed */}
                  {relay.relayOutcome && (
                    <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
                      <div className="flex items-center gap-2 mb-2">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                        <h4 className="text-xs font-bold uppercase text-emerald-800 tracking-wider">
                          {t("relay.care_outcome")}
                        </h4>
                      </div>
                      <p className="text-xs text-emerald-900 leading-relaxed whitespace-pre-wrap">
                        {relay.relayOutcome}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* TAB: DISCUSSION THREAD */}
              {activeTab === "discussion" && relay.canAccessFullClinicalData && (
                <div className="flex flex-col h-[380px]">
                  <div className="flex-1 overflow-y-auto space-y-3 pr-1">
                    {!messages || messages.length === 0 ? (
                      <div className="flex flex-col items-center justify-center h-full text-slate-400 text-xs">
                        <MessageSquare className="w-8 h-8 stroke-[1.2] mb-1 text-slate-300" />
                        <p>{t("relay.no_messages", "Aucun message échangé pour l'instant.")}</p>
                        <p className="text-[11px] text-slate-400">{t("relay.no_messages_sub", "Échangez directement avec votre confrère ci-dessous.")}</p>
                      </div>
                    ) : (
                      messages.map((m: any) => (
                        <div
                          key={m._id}
                          className={`flex flex-col ${m.isSelf ? "items-end" : "items-start"}`}
                        >
                          <div className="flex items-center gap-1.5 mb-1 px-1">
                            <span className="text-[11px] font-semibold text-slate-700">
                              {m.senderName} ({m.senderSpecialty || "Praticien"})
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {new Date(m.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>
                          <div
                            className={`max-w-[85%] p-3 rounded-xl text-xs leading-relaxed ${
                              m.isSelf
                                ? "bg-teal-600 text-white rounded-tr-none"
                                : "bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200"
                            }`}
                          >
                            <p className="whitespace-pre-wrap">{m.content}</p>
                          </div>
                        </div>
                      ))
                    )}
                  </div>

                  {/* Send input */}
                  {relay.status !== "completed" && relay.status !== "cancelled" && (
                    <form onSubmit={handleSendMessage} className="mt-3 flex gap-2">
                      <Input
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        placeholder={t("relay.messages_placeholder")}
                        className="text-xs"
                      />
                      <Button
                        type="submit"
                        disabled={isSendingMessage || !newMessage.trim()}
                        className="bg-teal-600 hover:bg-teal-700 text-white shrink-0"
                      >
                        {isSendingMessage ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                    </form>
                  )}
                </div>
              )}

              {/* TAB: STRUCTURED OPINION */}
              {activeTab === "opinion" && (
                <div className="space-y-4">
                  {relay.professionalResponse ? (
                    <div className="p-4 bg-teal-50/50 border border-teal-200 rounded-lg space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <ShieldCheck className="w-5 h-5 text-teal-600" />
                          <h4 className="text-sm font-bold text-teal-900">
                            {t("relay.professional_opinion")}
                          </h4>
                        </div>
                        <span className="text-xs text-teal-700">
                          Rendu le {new Date(relay.professionalResponse.respondedAt).toLocaleDateString()}
                        </span>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-teal-800 block">
                          {t("relay.opinion_summary")} :
                        </span>
                        <p className="text-xs text-slate-700 mt-0.5">
                          {relay.professionalResponse.summary}
                        </p>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-teal-800 block">
                          {t("relay.opinion_details")} :
                        </span>
                        <p className="text-xs text-slate-700 mt-0.5 whitespace-pre-wrap">
                          {relay.professionalResponse.professionalOpinion}
                        </p>
                      </div>

                      <div>
                        <span className="text-xs font-semibold text-teal-800 block">
                          {t("relay.recommended_next_step")} :
                        </span>
                        <p className="text-xs text-slate-700 mt-0.5 font-medium">
                          {relay.professionalResponse.recommendedNextStep}
                        </p>
                      </div>

                      {relay.professionalResponse.followUpAdvised && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-xs text-amber-800 flex items-center gap-2">
                          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                          <span>{t("relay.follow_up_advised")}</span>
                        </div>
                      )}
                    </div>
                  ) : relay.isAssigned ? (
                    <div className="p-6 text-center border-2 border-dashed border-slate-200 rounded-lg">
                      <ShieldCheck className="w-10 h-10 text-teal-500 mx-auto mb-2" />
                      <h4 className="text-sm font-semibold text-slate-800 mb-1">
                        Avis clinique en attente de soumission
                      </h4>
                      <p className="text-xs text-slate-500 max-w-md mx-auto mb-4">
                        En tant que praticien consultant, vous pouvez formuler votre avis confraternel structuré pour orienter la prise en charge.
                      </p>
                      <Button
                        onClick={() => setShowResponseForm(true)}
                        className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                      >
                        {t("relay.btn_submit_response")}
                      </Button>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500 text-center py-8">
                      Le confrère consultant n'a pas encore soumis son avis clinique.
                    </p>
                  )}

                  {/* Submission Form for Responder */}
                  {showResponseForm && (
                    <form onSubmit={handleSubmitResponse} className="p-4 bg-white border border-slate-300 rounded-lg space-y-3">
                      <h4 className="text-sm font-bold text-slate-900">
                        {t("relay.btn_submit_response")}
                      </h4>

                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          {t("relay.opinion_summary")} *
                        </Label>
                        <Input
                          value={responseSummary}
                          onChange={(e) => setResponseSummary(e.target.value)}
                          placeholder="Ex: Évolution favorable mais surveillance locale requise"
                          className="mt-1 text-xs"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          {t("relay.opinion_details")} *
                        </Label>
                        <Textarea
                          value={responseOpinion}
                          onChange={(e) => setResponseOpinion(e.target.value)}
                          placeholder="Détaillez vos constatations, diagnostics d'étape et recommandations..."
                          rows={3}
                          className="mt-1 text-xs"
                          required
                        />
                      </div>

                      <div>
                        <Label className="text-xs font-semibold text-slate-700">
                          {t("relay.recommended_next_step")} *
                        </Label>
                        <Input
                          value={responseNextStep}
                          onChange={(e) => setResponseNextStep(e.target.value)}
                          placeholder="Ex: Poursuivre hydrocellulaire tous les 2j, référer si fièvre"
                          className="mt-1 text-xs"
                          required
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="followUpCheck"
                          checked={responseFollowUp}
                          onChange={(e) => setResponseFollowUp(e.target.checked)}
                          className="rounded border-slate-300 text-teal-600 focus:ring-teal-500"
                        />
                        <label htmlFor="followUpCheck" className="text-xs text-slate-700 cursor-pointer">
                          {t("relay.follow_up_advised")}
                        </label>
                      </div>

                      <div className="flex justify-end gap-2 pt-2">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowResponseForm(false)}
                          className="text-xs"
                        >
                          Annuler
                        </Button>
                        <Button
                          type="submit"
                          disabled={isSubmittingResponse}
                          className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                        >
                          {isSubmittingResponse && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                          Confirmer l'avis
                        </Button>
                      </div>
                    </form>
                  )}
                </div>
              )}

              {/* Close with outcome sub-form */}
              {showCloseForm && (
                <form onSubmit={handleCompleteRelay} className="p-4 bg-emerald-50 border border-emerald-200 rounded-lg space-y-3">
                  <h4 className="text-sm font-bold text-emerald-900">
                    {t("relay.btn_complete")}
                  </h4>
                  <p className="text-xs text-emerald-800">
                    Cette synthèse sera intégrée au parcours de soins du patient et visible dans son suivi.
                  </p>
                  <Textarea
                    value={relayOutcome}
                    onChange={(e) => setRelayOutcome(e.target.value)}
                    placeholder={t("relay.care_outcome_placeholder")}
                    rows={3}
                    className="text-xs bg-white"
                    required
                  />
                  <div className="flex justify-end gap-2 pt-1">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowCloseForm(false)}
                      className="text-xs"
                    >
                      Annuler
                    </Button>
                    <Button
                      type="submit"
                      disabled={isSubmittingClose}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                    >
                      {isSubmittingClose && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                      Finaliser et consigner
                    </Button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>

        {/* Footer actions */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-3">
          <Button variant="outline" onClick={onClose} className="text-xs">
            Fermer
          </Button>

          <div className="flex items-center gap-2">
            {/* Cancel by requester */}
            {relay?.isRequester && relay.status === "requested" && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isActionLoading}
                className="text-rose-600 border-rose-200 hover:bg-rose-50 text-xs"
              >
                {t("relay.btn_cancel")}
              </Button>
            )}

            {/* Accept / Decline for eligible peer */}
            {!relay?.canAccessFullClinicalData && relay?.status === "requested" && (
              <>
                <Button
                  variant="outline"
                  onClick={handleDecline}
                  disabled={isActionLoading}
                  className="text-slate-600 text-xs"
                >
                  {t("relay.btn_decline")}
                </Button>
                <Button
                  onClick={handleAccept}
                  disabled={isActionLoading}
                  className="bg-teal-600 hover:bg-teal-700 text-white text-xs"
                >
                  {isActionLoading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
                  {t("relay.btn_accept")}
                </Button>
              </>
            )}

            {/* Close with outcome action */}
            {relay?.canAccessFullClinicalData &&
              (relay.status === "answered" || relay.status === "in_progress") &&
              !showCloseForm && (
                <Button
                  onClick={() => setShowCloseForm(true)}
                  className="bg-emerald-600 hover:bg-emerald-700 text-white text-xs"
                >
                  <CheckCircle2 className="w-3.5 h-3.5 mr-1.5" />
                  {t("relay.btn_complete")}
                </Button>
              )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
