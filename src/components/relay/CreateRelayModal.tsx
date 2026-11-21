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
  Upload,
  X,
  FileText,
  Activity,
  HeartPulse,
  Thermometer,
  ShieldAlert,
  Loader2,
  User,
} from "lucide-react";

interface CreateRelayModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (relayId: string) => void;
  initialPatientId?: string;
  initialAppointmentId?: string;
}

const SPECIALTY_OPTIONS = [
  { value: "medecin", label: "Médecin Généraliste / Spécialiste" },
  { value: "infirmier", label: "Infirmier / Infirmière" },
  { value: "kinesitherapeute", label: "Kinésithérapeute" },
  { value: "sage_femme", label: "Sage-femme" },
  { value: "aide_soignant", label: "Aide-soignant" },
];

export const CreateRelayModal: React.FC<CreateRelayModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialPatientId,
  initialAppointmentId,
}) => {
  const { t } = useTranslation();
  const eligiblePatients = useQuery(api.relay.getEligiblePatientsForRelay) || [];

  const createRelayRequest = useMutation(api.relay.createRelayRequest);
  const generateUploadUrl = useMutation(api.relay.generateRelayUploadUrl);

  const [selectedPatientId, setSelectedPatientId] = useState<string>(
    initialPatientId || ""
  );
  const [requestedSpecialty, setRequestedSpecialty] = useState<string>("medecin");
  const [urgencyLevel, setUrgencyLevel] = useState<"standard" | "priority">("standard");
  const [reason, setReason] = useState("");
  const [observations, setObservations] = useState("");
  const [carePerformed, setCarePerformed] = useState("");
  const [symptomsInput, setSymptomsInput] = useState("");

  // Vitals
  const [bloodPressure, setBloodPressure] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");
  const [spO2, setSpO2] = useState("");

  // Attachments
  const [attachments, setAttachments] = useState<
    Array<{
      storageId: string;
      name: string;
      mimeType: string;
      size: number;
      category?: string;
    }>
  >([]);
  const [isUploading, setIsUploading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync if initialPatientId changes
  React.useEffect(() => {
    if (initialPatientId) {
      setSelectedPatientId(initialPatientId);
    }
  }, [initialPatientId]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    if (file.size > 10 * 1024 * 1024) {
      toast.error("La taille maximale du fichier est de 10 Mo.");
      return;
    }

    try {
      setIsUploading(true);
      const uploadUrl = await generateUploadUrl();
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!result.ok) {
        throw new Error("Échec du téléversement vers le serveur de stockage");
      }

      const { storageId } = await result.json();

      let category = "care_document";
      if (file.type.startsWith("image/")) {
        category = "wound_photo";
      }

      setAttachments((prev) => [
        ...prev,
        {
          storageId,
          name: file.name,
          mimeType: file.type,
          size: file.size,
          category,
        },
      ]);
      toast.success("Pièce jointe ajoutée avec succès");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du téléversement");
    } finally {
      setIsUploading(false);
      e.target.value = "";
    }
  };

  const removeAttachment = (index: number) => {
    setAttachments((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedPatientId) {
      toast.error("Veuillez sélectionner un patient suivi.");
      return;
    }

    if (reason.trim().length < 5) {
      toast.error("Le motif de la demande doit comporter au moins 5 caractères.");
      return;
    }

    if (observations.trim().length < 10) {
      toast.error("Veuillez détailler les observations cliniques (min 10 caractères).");
      return;
    }

    try {
      setIsSubmitting(true);

      const parsedSymptoms = symptomsInput
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s.length > 0);

      const vitalsObj: any = {};
      if (bloodPressure.trim()) vitalsObj.bloodPressure = bloodPressure.trim();
      if (pulse.trim()) vitalsObj.pulse = Number(pulse);
      if (temperature.trim()) vitalsObj.temperature = Number(temperature);
      if (spO2.trim()) vitalsObj.spO2 = Number(spO2);
      if (Object.keys(vitalsObj).length > 0) {
        vitalsObj.recordedAt = Date.now();
      }

      const res = await createRelayRequest({
        patientId: selectedPatientId as Id<"users">,
        requestedSpecialty: requestedSpecialty as any,
        appointmentId: initialAppointmentId ? (initialAppointmentId as Id<"appointments">) : undefined,
        reason: reason.trim(),
        urgencyLevel,
        clinicalContext: {
          observations: observations.trim(),
          carePerformed: carePerformed.trim() || undefined,
          symptoms: parsedSymptoms.length > 0 ? parsedSymptoms : undefined,
        },
        selectedVitals: Object.keys(vitalsObj).length > 0 ? vitalsObj : undefined,
        attachments: attachments.length > 0 ? attachments : undefined,
      });

      toast.success("Demande Relay transmise avec succès au réseau médical !");
      onClose();
      if (onSuccess && res.relayId) {
        onSuccess(res.relayId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la création de la demande Relay");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200">
              MauriCare Relay
            </Badge>
            <DialogTitle className="text-xl font-bold text-slate-900">
              {t("relay.btn_new_request")}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-slate-500">
            {t("relay.no_ai_disclaimer")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Patient Selector */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">
              {t("relay.patient")} *
            </Label>
            <select
              value={selectedPatientId}
              onChange={(e) => setSelectedPatientId(e.target.value)}
              className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              required
            >
              <option value="">{t("relay.select_patient")}</option>
              {eligiblePatients.map((p) => (
                <option key={p._id} value={p._id}>
                  {p.name} {p.phone ? `(${p.phone})` : ""} - Dernier soin: {p.latestAppointmentDate}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-slate-500">
              {t("relay.patient_requirement_hint")}
            </p>
          </div>

          {/* Specialty & Urgency */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-slate-700">
                {t("relay.requested_specialty")} *
              </Label>
              <select
                value={requestedSpecialty}
                onChange={(e) => setRequestedSpecialty(e.target.value)}
                className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-teal-500 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                {SPECIALTY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <Label className="text-sm font-semibold text-slate-700">
                {t("relay.urgency")} *
              </Label>
              <div className="mt-1 flex gap-2">
                <button
                  type="button"
                  onClick={() => setUrgencyLevel("standard")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md border transition-colors ${
                    urgencyLevel === "standard"
                      ? "bg-slate-900 text-white border-slate-900"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-50"
                  }`}
                >
                  <Clock className="w-3.5 h-3.5" />
                  {t("relay.urgency_standard")}
                </button>
                <button
                  type="button"
                  onClick={() => setUrgencyLevel("priority")}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 text-xs font-medium rounded-md border transition-colors ${
                    urgencyLevel === "priority"
                      ? "bg-rose-600 text-white border-rose-600"
                      : "bg-white text-rose-700 border-rose-200 hover:bg-rose-50"
                  }`}
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-300" />
                  {t("relay.urgency_priority")}
                </button>
              </div>
            </div>
          </div>

          {/* Reason */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">
              {t("relay.reason_label")} *
            </Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("relay.reason_placeholder")}
              className="mt-1"
              required
            />
          </div>

          {/* Observations */}
          <div>
            <Label className="text-sm font-semibold text-slate-700">
              {t("relay.observations")} *
            </Label>
            <Textarea
              value={observations}
              onChange={(e) => setObservations(e.target.value)}
              placeholder={t("relay.observations_placeholder")}
              rows={3}
              className="mt-1"
              required
            />
          </div>

          {/* Care performed & Symptoms */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label className="text-sm font-semibold text-slate-700">
                {t("relay.care_performed")}
              </Label>
              <Input
                value={carePerformed}
                onChange={(e) => setCarePerformed(e.target.value)}
                placeholder={t("relay.care_performed_placeholder")}
                className="mt-1"
              />
            </div>
            <div>
              <Label className="text-sm font-semibold text-slate-700">
                {t("relay.symptoms")}
              </Label>
              <Input
                value={symptomsInput}
                onChange={(e) => setSymptomsInput(e.target.value)}
                placeholder="Ex: Douleur 7/10, rougeur péri-lésionnelle"
                className="mt-1"
              />
            </div>
          </div>

          {/* Vitals Snapshot */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Activity className="w-4 h-4 text-teal-600" />
              <span>{t("relay.vital_signs")}</span>
              <span className="text-slate-400 font-normal">(Optionnel)</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <div>
                <Label className="text-[11px] text-slate-600">
                  {t("relay.blood_pressure")}
                </Label>
                <Input
                  value={bloodPressure}
                  onChange={(e) => setBloodPressure(e.target.value)}
                  placeholder="130/85"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">
                  {t("relay.pulse")}
                </Label>
                <Input
                  type="number"
                  value={pulse}
                  onChange={(e) => setPulse(e.target.value)}
                  placeholder="78"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">
                  {t("relay.temperature")}
                </Label>
                <Input
                  type="number"
                  step="0.1"
                  value={temperature}
                  onChange={(e) => setTemperature(e.target.value)}
                  placeholder="37.4"
                  className="h-8 text-xs bg-white"
                />
              </div>
              <div>
                <Label className="text-[11px] text-slate-600">
                  {t("relay.spo2")}
                </Label>
                <Input
                  type="number"
                  value={spO2}
                  onChange={(e) => setSpO2(e.target.value)}
                  placeholder="98"
                  className="h-8 text-xs bg-white"
                />
              </div>
            </div>
          </div>

          {/* Attachments */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <Label className="text-sm font-semibold text-slate-700">
                {t("relay.attachments")}
              </Label>
              <label className="cursor-pointer inline-flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700">
                <Upload className="w-3.5 h-3.5" />
                <span>Ajouter un fichier</span>
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={isUploading}
                  className="hidden"
                  accept="image/*,application/pdf"
                />
              </label>
            </div>

            {isUploading && (
              <div className="flex items-center gap-2 p-2 bg-slate-50 border border-dashed rounded text-xs text-slate-500">
                <Loader2 className="w-3.5 h-3.5 animate-spin text-teal-600" />
                <span>Téléversement du fichier en cours...</span>
              </div>
            )}

            {attachments.length > 0 && (
              <div className="space-y-1.5 mt-2">
                {attachments.map((att, idx) => (
                  <div
                    key={att.storageId}
                    className="flex items-center justify-between p-2 bg-slate-50 border border-slate-200 rounded text-xs"
                  >
                    <div className="flex items-center gap-2 truncate">
                      <FileText className="w-4 h-4 text-teal-600 shrink-0" />
                      <span className="font-medium text-slate-800 truncate">
                        {att.name}
                      </span>
                      <span className="text-slate-400 shrink-0">
                        ({Math.round(att.size / 1024)} Ko)
                      </span>
                      <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                        {att.category === "wound_photo" ? "Photo lésion" : "Document"}
                      </Badge>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeAttachment(idx)}
                      className="text-slate-400 hover:text-rose-600 p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter className="pt-2 gap-2">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              disabled={isSubmitting}
            >
              Annuler
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || isUploading}
              className="bg-teal-600 hover:bg-teal-700 text-white"
            >
              {isSubmitting && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {t("relay.btn_new_request")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
