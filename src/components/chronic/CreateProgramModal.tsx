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
import { PlusCircle, Loader2 } from "lucide-react";

interface CreateProgramModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: Id<"users">;
}

export const CreateProgramModal: React.FC<CreateProgramModalProps> = ({
  isOpen,
  onClose,
  patientId,
}) => {
  const { t } = useTranslation();
  const createProgram = useMutation(api.chronic.createMonitoringProgram);
  const catalog = useQuery(api.chronic.getConditionCatalog) || [];

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [conditionId, setConditionId] = useState<string>("none");
  const [frequency, setFrequency] = useState("daily_once");
  const [selectedCodes, setSelectedCodes] = useState<string[]>(["blood_pressure"]);
  const [durationDays, setDurationDays] = useState("30");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const toggleCode = (code: string) => {
    if (selectedCodes.includes(code)) {
      if (selectedCodes.length > 1) {
        setSelectedCodes(selectedCodes.filter((c) => c !== code));
      }
    } else {
      setSelectedCodes([...selectedCodes, code]);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      toast.error("Veuillez donner un titre au programme de suivi.");
      return;
    }

    setIsSubmitting(true);
    try {
      const days = parseInt(durationDays, 10);
      const expectedEnd = !isNaN(days) && days > 0 ? Date.now() + days * 24 * 60 * 60 * 1000 : undefined;

      await createProgram({
        patientId,
        title: title.trim(),
        description: description.trim() ? description.trim() : undefined,
        conditionId: conditionId !== "none" ? (conditionId as Id<"conditionCatalog">) : undefined,
        frequency,
        requiredMeasurementCodes: selectedCodes,
        expectedEndAt: expectedEnd,
      });

      toast.success("Programme de suivi créé avec succès.");
      onClose();
    } catch (err: any) {
      console.error("Erreur création programme:", err);
      toast.error(err?.message || "Erreur lors de la création du programme.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-lg font-bold text-gray-900">
            <PlusCircle className="h-5 w-5 text-teal-600" />
            {t("chronic.btn_new_program", "Créer un programme")}
          </DialogTitle>
          <DialogDescription className="text-xs text-gray-500">
            Configurez un protocole de surveillance personnalisé pour le patient.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Titre du programme *</Label>
            <Input
              type="text"
              placeholder="Ex: Surveillance tensionnelle post-AVC (30j)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              required
              className="bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Pathologie ou condition associée</Label>
            <Select value={conditionId} onValueChange={setConditionId}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">Aucune / Suivi préventif général</SelectItem>
                {catalog.map((c) => (
                  <SelectItem key={c._id} value={c._id}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Fréquence de relevé</Label>
            <Select value={frequency} onValueChange={setFrequency}>
              <SelectTrigger className="bg-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="daily_once">1 fois par jour</SelectItem>
                <SelectItem value="daily_twice">2 fois par jour (Matin & Soir)</SelectItem>
                <SelectItem value="weekly_once">1 fois par semaine</SelectItem>
                <SelectItem value="weekly_twice">2 fois par semaine</SelectItem>
                <SelectItem value="monthly_once">1 fois par mois</SelectItem>
                <SelectItem value="as_needed">Au besoin / Selon ressenti</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Mesures requises</Label>
            <div className="flex flex-wrap gap-2 pt-1">
              {[
                { code: "blood_pressure", label: "Tension" },
                { code: "blood_glucose", label: "Glycémie" },
                { code: "heart_rate", label: "Pouls" },
                { code: "weight", label: "Poids" },
                { code: "spo2", label: "SpO2" },
                { code: "temperature", label: "Température" },
              ].map((m) => {
                const isSelected = selectedCodes.includes(m.code);
                return (
                  <button
                    type="button"
                    key={m.code}
                    onClick={() => toggleCode(m.code)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                      isSelected
                        ? "bg-teal-600 text-white shadow-sm"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Durée prévue (en jours)</Label>
            <Input
              type="number"
              min="1"
              max="365"
              value={durationDays}
              onChange={(e) => setDurationDays(e.target.value)}
              className="bg-white"
            />
          </div>

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold text-gray-700">Consignes cliniques (optionnel)</Label>
            <Textarea
              rows={2}
              placeholder="Ex: Prise de tension le matin à jeun au repos 5 minutes..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-white text-xs"
            />
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
                  Création...
                </>
              ) : (
                t("chronic.btn_save", "Enregistrer")
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};
