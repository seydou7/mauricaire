import React, { useState } from "react";
import { useMutation, useQuery } from "convex/react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "../ui/select";
import { Share2, AlertCircle, Loader2, CheckSquare, Square } from "lucide-react";

interface RelayShareModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId: Id<"users">;
  observations: Array<{
    _id: string;
    measurementCode: string;
    numericValue?: number;
    secondaryNumericValue?: number;
    unit?: string;
    observedAt: number;
    source: string;
  }>;
}

export const RelayShareModal: React.FC<RelayShareModalProps> = ({
  isOpen,
  onClose,
  patientId,
  observations,
}) => {
  const { t } = useTranslation();
  const createRelayRequest = useMutation(api.relay.createRelayRequest);

  const [requestedSpecialty, setRequestedSpecialty] = useState<string>("general_practitioner");
  const [urgencyLevel, setUrgencyLevel] = useState<"standard" | "priority">("standard");
  const [reason, setReason] = useState("");
  const [clinicalObservations, setClinicalObservations] = useState("");
  const [selectedObsIds, setSelectedObsIds] = useState<Set<string>>(new Set());
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Initialize selected observations to the last few
  React.useEffect(() => {
    if (observations && observations.length > 0) {
      const initialSet = new Set(observations.slice(0, 5).map((o) => o._id));
      setSelectedObsIds(initialSet);
    }
  }, [observations]);

  const toggleObsSelection = (id: string) => {
    const updated = new Set(selectedObsIds);
    if (updated.has(id)) {
      updated.delete(id);
    } else {
      updated.add(id);
    }
    setSelectedObsIds(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reason.trim()) {
      toast.error("Veuillez renseigner le motif de la demande d'avis Relay.");
      return;
    }
    if (clinicalObservations.trim().length < 10) {
      toast.error("Veuillez préciser le contexte clinique (au moins 10 caractères).");
      return;
    }

    setIsSubmitting(true);
    try {
      // Find latest vital measurements among selected
      const selectedObsList = observations.filter((o) => selectedObsIds.has(o._id));
      const latestBp = selectedObsList.find((o) => o.measurementCode === "blood_pressure");
      const latestPulse = selectedObsList.find((o) => o.measurementCode === "heart_rate");
      const latestSpo2 = selectedObsList.find((o) => o.measurementCode === "spo2");
      const latestTemp = selectedObsList.find((o) => o.measurementCode === "temperature");

      const selectedVitals = {
        bloodPressure: latestBp
          ? `${latestBp.numericValue}/${latestBp.secondaryNumericValue || 80}`
          : undefined,
        pulse: latestPulse?.numericValue,
        spO2: latestSpo2?.numericValue,
        temperature: latestTemp?.numericValue,
        recordedAt: Date.now(),
      };

      const summaryNote =
        clinicalObservations +
        `\n\n[Données de suivi MauriCare Chronic transmises: ${selectedObsList.length} mesures sélectionnées]`;

      await createRelayRequest({
        patientId,
        requestedSpecialty: requestedSpecialty as any,
        reason: reason.trim(),
        urgencyLevel,
        clinicalContext: {
          observations: summaryNote,
        },
        selectedVitals,
      });

      toast.success("Demande d'avis Relay créée avec succès et transmise au réseau de confrères.");
      onClose();
    } catch (err: any) {
      console.error("Erreur création demande Relay:", err);
      toast.error(err?.message || "Impossible de créer la demande d'avis Relay.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Share2 className="h-5 w-5 text-teal-600" />
            {t("chronic.relay_dialog_title", "Transmettre des mesures pour avis Relay")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            {t(
              "chronic.relay_dialog_desc",
              "Sélectionnez les mesures récentes à joindre au dossier de collaboration confraternelle."
            )}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Spécialité sollicitée</Label>
            <Select value={requestedSpecialty} onValueChange={setRequestedSpecialty}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="general_practitioner">Médecine générale</SelectItem>
                <SelectItem value="cardiologist">Cardiologie</SelectItem>
                <SelectItem value="diabetologist">Diabétologie / Endocrinologie</SelectItem>
                <SelectItem value="pneumologist">Pneumologie</SelectItem>
                <SelectItem value="nephrologist">Néphrologie</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Degré d'urgence</Label>
            <Select value={urgencyLevel} onValueChange={(v: "standard" | "priority") => setUrgencyLevel(v)}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="standard">Standard (Sous 24h-48h)</SelectItem>
                <SelectItem value="priority">Prioritaire (Sous 12h-24h)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Motif de la sollicitation *</Label>
            <Input
              type="text"
              placeholder="Ex: Demande d'avis sur déséquilibre tensionnel récent"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              required
              className="bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Observations cliniques & question *</Label>
            <Textarea
              rows={3}
              placeholder="Précisez la situation du patient, les symptômes constatés et la question posée au confrère..."
              value={clinicalObservations}
              onChange={(e) => setClinicalObservations(e.target.value)}
              required
              className="bg-white text-xs"
            />
          </div>

          {/* Observations selection list */}
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-gray-700">
              Mesures à joindre ({selectedObsIds.size} sélectionnée{selectedObsIds.size > 1 ? "s" : ""})
            </Label>
            <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-xl divide-y divide-gray-100 bg-white">
              {observations.map((obs) => {
                const isSelected = selectedObsIds.has(obs._id);
                const displayVal =
                  obs.measurementCode === "blood_pressure"
                    ? `${obs.numericValue}/${obs.secondaryNumericValue} ${obs.unit}`
                    : `${obs.numericValue} ${obs.unit || ""}`;

                return (
                  <div
                    key={obs._id}
                    onClick={() => toggleObsSelection(obs._id)}
                    className="p-2.5 flex items-center justify-between hover:bg-gray-50 cursor-pointer text-xs"
                  >
                    <div className="flex items-center gap-2">
                      {isSelected ? (
                        <CheckSquare className="h-4 w-4 text-teal-600 shrink-0" />
                      ) : (
                        <Square className="h-4 w-4 text-gray-400 shrink-0" />
                      )}
                      <div>
                        <span className="font-semibold text-gray-800">{obs.measurementCode}: </span>
                        <span className="font-bold text-teal-700">{displayVal}</span>
                      </div>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {new Date(obs.observedAt).toLocaleDateString("fr-FR", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("chronic.btn_cancel", "Annuler")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-teal-600 hover:bg-teal-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Transmission...
                </>
              ) : (
                t("chronic.relay_dialog_submit", "Créer la demande d'avis Relay")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
