import React, { useState } from "react";
import { useMutation } from "convex/react";
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
import { Edit3, AlertCircle, Loader2 } from "lucide-react";

interface RecordCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  observation: {
    _id: Id<"healthObservations">;
    measurementCode: string;
    numericValue?: number;
    secondaryNumericValue?: number;
    textValue?: string;
    unit?: string;
    observedAt: number;
  } | null;
}

export const RecordCorrectionModal: React.FC<RecordCorrectionModalProps> = ({
  isOpen,
  onClose,
  observation,
}) => {
  const { t } = useTranslation();
  const correctObservation = useMutation(api.chronic.correctObservation);

  const [newValue, setNewValue] = useState<string>("");
  const [newSecondaryValue, setNewSecondaryValue] = useState<string>("");
  const [newTextValue, setNewTextValue] = useState<string>("");
  const [correctionReason, setCorrectionReason] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  React.useEffect(() => {
    if (observation) {
      setNewValue(observation.numericValue !== undefined ? String(observation.numericValue) : "");
      setNewSecondaryValue(
        observation.secondaryNumericValue !== undefined ? String(observation.secondaryNumericValue) : ""
      );
      setNewTextValue(observation.textValue || "");
      setCorrectionReason("");
    }
  }, [observation]);

  if (!observation) return null;

  const isBp = observation.measurementCode === "blood_pressure";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!correctionReason.trim()) {
      toast.error("Veuillez indiquer le motif obligatoire de la correction.");
      return;
    }

    setIsSubmitting(true);
    try {
      await correctObservation({
        observationId: observation._id,
        correctedNumericValue: newValue !== "" ? parseFloat(newValue) : undefined,
        correctedSecondaryValue: isBp && newSecondaryValue !== "" ? parseFloat(newSecondaryValue) : undefined,
        correctionReason: correctionReason.trim(),
      });

      toast.success("Mesure corrigée avec succès. L'historique d'audit a été enregistré.");
      onClose();
    } catch (err: any) {
      console.error("Erreur correction mesure:", err);
      toast.error(err?.message || "Erreur lors de la correction de la mesure.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <Edit3 className="h-5 w-5 text-amber-600" />
            {t("chronic.btn_correct_measurement", "Corriger la valeur")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Modifiez la valeur mesurée avec motif obligatoire pour l'historique d'audit.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="p-3 bg-amber-50/60 border border-amber-200 rounded-lg text-xs text-amber-900 leading-relaxed">
            Toute correction est consignée dans le registre d'audit pour garantir l'intégrité du dossier de suivi médical.
          </div>

          {isBp ? (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Systolique corrigée ({observation.unit || "mmHg"})
                </Label>
                <Input
                  type="number"
                  step="1"
                  value={newValue}
                  onChange={(e) => setNewValue(e.target.value)}
                  required
                  className="bg-white font-medium"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold text-gray-700">
                  Diastolique corrigée ({observation.unit || "mmHg"})
                </Label>
                <Input
                  type="number"
                  step="1"
                  value={newSecondaryValue}
                  onChange={(e) => setNewSecondaryValue(e.target.value)}
                  required
                  className="bg-white font-medium"
                />
              </div>
            </div>
          ) : observation.textValue ? (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">Texte corrigé</Label>
              <Input
                type="text"
                value={newTextValue}
                onChange={(e) => setNewTextValue(e.target.value)}
                required
                className="bg-white"
              />
            </div>
          ) : (
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">
                Nouvelle valeur ({observation.unit || ""})
              </Label>
              <Input
                type="number"
                step="any"
                value={newValue}
                onChange={(e) => setNewValue(e.target.value)}
                required
                className="bg-white font-medium text-lg"
              />
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">
              Motif obligatoire de la correction *
            </Label>
            <Input
              type="text"
              placeholder="Ex: Erreur de saisie au clavier lors de la prise matinale"
              value={correctionReason}
              onChange={(e) => setCorrectionReason(e.target.value)}
              required
              className="bg-white text-sm"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting}>
              {t("chronic.btn_cancel", "Annuler")}
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              className="bg-amber-600 hover:bg-amber-700 text-white font-medium"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Correction...
                </>
              ) : (
                t("chronic.btn_confirm_correction", "Confirmer la correction")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
