import React, { useState, useEffect } from "react";
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
  Activity,
  Heart,
  Droplet,
  Scale,
  Thermometer,
  Wind,
  AlertCircle,
  FileText,
  Loader2,
  Users,
} from "lucide-react";

interface RecordMeasurementModalProps {
  isOpen: boolean;
  onClose: () => void;
  patientId?: Id<"users">;
  programId?: Id<"monitoringPrograms">;
  defaultMeasurementCode?: string;
  userRole?: "patient" | "professionnel";
}

const DEFAULT_METRIC_UNITS: Record<string, string> = {
  blood_pressure: "mmHg",
  blood_glucose: "mg/dL",
  heart_rate: "bpm",
  weight: "kg",
  spo2: "%",
  temperature: "°C",
  pain_level: "score 0-10",
  symptoms: "texte",
};

interface ErrorBoundaryState {
  hasError: boolean;
  errorMessage?: string;
}

class RecordModalErrorBoundary extends React.Component<
  { children: React.ReactNode },
  ErrorBoundaryState
> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, errorMessage: error.message };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error("RecordMeasurementModal ErrorBoundary caught an error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl space-y-2 text-xs text-red-800">
          <p className="font-semibold">Une erreur inattendue est survenue dans le formulaire de mesure.</p>
          <p className="text-gray-600">{this.state.errorMessage}</p>
        </div>
      );
    }
    return this.props.children;
  }
}

export const RecordMeasurementModal: React.FC<RecordMeasurementModalProps> = ({
  isOpen,
  onClose,
  patientId,
  programId,
  defaultMeasurementCode = "blood_pressure",
  userRole = "patient",
}) => {
  const { t } = useTranslation();
  const recordObservation = useMutation(api.chronic.recordObservation);
  const definitions = useQuery(api.chronic.getMeasurementDefinitions) || [];

  // Query monitored patients if professional has not selected a patient yet
  const monitoredPatients = useQuery(
    api.chronic.getProfessionalMonitoredPatients,
    userRole === "professionnel" && !patientId ? {} : "skip"
  );

  const [measurementCode, setMeasurementCode] = useState<string>(defaultMeasurementCode);
  const [selectedPatientId, setSelectedPatientId] = useState<string>(patientId || "");
  const [systolic, setSystolic] = useState<string>("");
  const [diastolic, setDiastolic] = useState<string>("");
  const [pulse, setPulse] = useState<string>("");
  const [numericValue, setNumericValue] = useState<string>("");
  const [textValue, setTextValue] = useState<string>("");
  const [context, setContext] = useState<string>("resting");
  const [observedAtDate, setObservedAtDate] = useState<string>(() =>
    new Date().toISOString().slice(0, 16)
  );
  const [clinicalNotes, setClinicalNotes] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Sync state with props when modal opens or props change
  useEffect(() => {
    if (defaultMeasurementCode) {
      setMeasurementCode(defaultMeasurementCode);
    }
  }, [defaultMeasurementCode]);

  useEffect(() => {
    if (patientId) {
      setSelectedPatientId(patientId);
    } else if (monitoredPatients && monitoredPatients.length === 1 && !selectedPatientId) {
      const sole = monitoredPatients[0];
      if (sole) {
        const soleId = (sole as any).patientId || (sole as any)._id;
        if (soleId) setSelectedPatientId(String(soleId));
      }
    }
  }, [patientId, monitoredPatients, selectedPatientId]);

  useEffect(() => {
    if (isOpen) {
      setObservedAtDate(new Date().toISOString().slice(0, 16));
    }
  }, [isOpen]);

  const currentDef = definitions.find((d) => d.code === measurementCode);
  const currentUnit = currentDef?.unit || DEFAULT_METRIC_UNITS[measurementCode] || "unité";

  const resetForm = () => {
    setSystolic("");
    setDiastolic("");
    setPulse("");
    setNumericValue("");
    setTextValue("");
    setContext("resting");
    setObservedAtDate(new Date().toISOString().slice(0, 16));
    setClinicalNotes("");
  };

  const handleClose = () => {
    resetForm();
    onClose();
  };

  // Plausibility live warnings
  const getPlausibilityWarning = (): string | null => {
    if (measurementCode === "blood_pressure") {
      const sys = parseFloat(systolic);
      const dia = parseFloat(diastolic);
      if (sys && (sys < 60 || sys > 260)) return "Systolique inhabituelle (< 60 ou > 260 mmHg). Vérifiez votre saisie.";
      if (dia && (dia < 40 || dia > 150)) return "Diastolique inhabituelle (< 40 ou > 150 mmHg). Vérifiez votre saisie.";
      if (sys && dia && sys <= dia) return "La pression systolique doit être supérieure à la diastolique.";
    } else if (measurementCode === "blood_glucose") {
      const val = parseFloat(numericValue);
      if (val && (val < 30 || val > 600)) return "Valeur de glycémie hors plage habituelle (30 - 600 mg/dL).";
    } else if (measurementCode === "heart_rate") {
      const val = parseFloat(numericValue);
      if (val && (val < 30 || val > 220)) return "Fréquence cardiaque inhabituelle (< 30 ou > 220 bpm).";
    } else if (measurementCode === "spo2") {
      const val = parseFloat(numericValue);
      if (val && (val < 60 || val > 100)) return "La saturation doit être comprise entre 60% et 100%.";
    } else if (measurementCode === "temperature") {
      const val = parseFloat(numericValue);
      if (val && (val < 32 || val > 43)) return "Température corporelle hors limites plausibles (32°C - 43°C).";
    }
    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const targetPatientId = (patientId || selectedPatientId || undefined) as Id<"users"> | undefined;
      if (userRole === "professionnel" && !targetPatientId) {
        toast.error("Veuillez sélectionner le patient concerné.");
        setIsSubmitting(false);
        return;
      }

      const observedTimestamp = observedAtDate ? new Date(observedAtDate).getTime() : Date.now();
      const source = userRole === "professionnel" ? "professional_manual" : "patient_manual";

      if (measurementCode === "blood_pressure") {
        const sys = parseFloat(systolic);
        const dia = parseFloat(diastolic);
        if (isNaN(sys) || isNaN(dia)) {
          toast.error("Veuillez renseigner les valeurs systolique et diastolique.");
          setIsSubmitting(false);
          return;
        }

        const res = await recordObservation({
          patientId: targetPatientId,
          measurementCode: "blood_pressure",
          numericValue: sys,
          secondaryNumericValue: dia,
          unit: "mmHg",
          observedAt: observedTimestamp,
          context,
          clinicalNotes: clinicalNotes.trim() ? clinicalNotes.trim() : undefined,
          programId,
          source,
        });

        // Also record pulse if entered alongside blood pressure
        if (pulse.trim()) {
          const pulseVal = parseFloat(pulse);
          if (!isNaN(pulseVal)) {
            await recordObservation({
              patientId: targetPatientId,
              measurementCode: "heart_rate",
              numericValue: pulseVal,
              unit: "bpm",
              observedAt: observedTimestamp,
              context,
              clinicalNotes: "Enregistré conjointement à la tension artérielle",
              programId,
              source,
            });
          }
        }

        if (res.attentionFlag) {
          toast.warning("Mesure enregistrée. " + res.attentionFlag.message);
        } else {
          toast.success("Tension artérielle enregistrée avec succès.");
        }
      } else if (measurementCode === "symptoms") {
        if (!textValue.trim()) {
          toast.error("Veuillez décrire vos symptômes ou observations.");
          setIsSubmitting(false);
          return;
        }

        await recordObservation({
          patientId: targetPatientId,
          measurementCode: "symptoms",
          textValue: textValue.trim(),
          observedAt: observedTimestamp,
          context,
          clinicalNotes: clinicalNotes.trim() ? clinicalNotes.trim() : undefined,
          programId,
          source,
        });

        toast.success("Observations enregistrées avec succès.");
      } else {
        const val = parseFloat(numericValue);
        if (isNaN(val)) {
          toast.error("Veuillez entrer une valeur numérique valide.");
          setIsSubmitting(false);
          return;
        }

        const res = await recordObservation({
          patientId: targetPatientId,
          measurementCode,
          numericValue: val,
          unit: currentUnit,
          observedAt: observedTimestamp,
          context,
          clinicalNotes: clinicalNotes.trim() ? clinicalNotes.trim() : undefined,
          programId,
          source,
        });

        if (res.attentionFlag) {
          toast.warning("Mesure enregistrée. " + res.attentionFlag.message);
        } else {
          toast.success("Mesure enregistrée avec succès.");
        }
      }

      handleClose();
    } catch (err: any) {
      console.error("Erreur enregistrement mesure:", err);
      toast.error(err?.message || "Erreur lors de l'enregistrement de la mesure.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const warning = getPlausibilityWarning();

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) handleClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <RecordModalErrorBoundary>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold text-gray-900">
              <Activity className="h-5 w-5 text-teal-600" />
              {t("chronic.btn_add_measurement", "Ajouter une mesure")}
            </DialogTitle>
            <DialogDescription className="text-xs text-gray-500">
              Enregistrez les constantes vitales et observations cliniques du patient.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4 py-2">
            {/* Professional patient selector if patientId was not pre-selected */}
            {userRole === "professionnel" && !patientId && (
              <div className="space-y-1.5 p-3 bg-teal-50/50 border border-teal-100 rounded-xl">
                <Label className="text-xs font-semibold text-teal-900 flex items-center gap-1.5">
                  <Users className="h-3.5 w-3.5 text-teal-600" />
                  {t("chronic.concerned_patient", "Patient concerné *")}
                </Label>
                <select
                  value={selectedPatientId}
                  onChange={(e) => setSelectedPatientId(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-teal-200 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                  required
                >
                  <option value="">{t("chronic.select_patient_placeholder", "Sélectionnez un patient suivi...")}</option>
                  {(monitoredPatients || []).map((p: any) => {
                    const pid = p.patientId || p._id;
                    return (
                      <option key={String(pid)} value={String(pid)}>
                        {p.patientName || p.name || "Patient"} {p.relationship ? `(${p.relationship})` : ""}
                      </option>
                    );
                  })}
                </select>
              </div>
            )}

            {/* Measurement Type Selector */}
            <div className="space-y-1.5">
              <Label className="text-sm font-medium text-gray-700">{t("chronic.measurement_type", "Type de mesure")}</Label>
              <select
                value={measurementCode}
                onChange={(e) => {
                  setMeasurementCode(e.target.value);
                  setNumericValue("");
                  setSystolic("");
                  setDiastolic("");
                }}
                className="w-full h-10 px-3 bg-white border border-gray-300 rounded-xl text-sm font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500 transition-all"
              >
                <option value="blood_pressure">{t("chronic.types.blood_pressure", "Tension artérielle (Systolique / Diastolique) — mmHg")}</option>
                <option value="blood_glucose">{t("chronic.types.blood_glucose", "Glycémie capillaire — mg/dL")}</option>
                <option value="heart_rate">{t("chronic.types.heart_rate", "Fréquence cardiaque / Pouls — bpm")}</option>
                <option value="weight">{t("chronic.types.weight", "Poids corporel — kg")}</option>
                <option value="spo2">{t("chronic.types.spo2", "Saturation en oxygène (SpO2) — %")}</option>
                <option value="temperature">{t("chronic.types.temperature", "Température corporelle — °C")}</option>
                <option value="pain_level">{t("chronic.types.pain_level", "Échelle d'évaluation de la douleur (0-10)")}</option>
                <option value="symptoms">{t("chronic.types.symptoms", "Symptômes ou observations cliniques")}</option>
              </select>
            </div>

            {/* Value Inputs based on Measurement Type */}
            {measurementCode === "blood_pressure" ? (
              <div className="space-y-3 p-3.5 bg-red-50/50 rounded-xl border border-red-100">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-red-500" />
                      Systolique (SYS) <span className="text-gray-400 font-normal">mmHg</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="ex: 120"
                      value={systolic}
                      onChange={(e) => setSystolic(e.target.value)}
                      required
                      className="bg-white font-medium text-lg"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-gray-700 flex items-center gap-1">
                      <Heart className="h-3.5 w-3.5 text-rose-400" />
                      Diastolique (DIA) <span className="text-gray-400 font-normal">mmHg</span>
                    </Label>
                    <Input
                      type="number"
                      step="1"
                      placeholder="ex: 80"
                      value={diastolic}
                      onChange={(e) => setDiastolic(e.target.value)}
                      required
                      className="bg-white font-medium text-lg"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-gray-700 flex items-center gap-1">
                    <Activity className="h-3.5 w-3.5 text-amber-500" />
                    {t("chronic.associated_pulse_optional", "Pouls associé (optionnel)")} <span className="text-gray-400 font-normal">bpm</span>
                  </Label>
                  <Input
                    type="number"
                    step="1"
                    placeholder="ex: 72"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    className="bg-white"
                  />
                </div>
              </div>
            ) : measurementCode === "symptoms" ? (
              <div className="space-y-1.5">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  <FileText className="h-4 w-4 text-gray-500" />
                  {t("chronic.symptoms_description", "Description des symptômes")}
                </Label>
                <Textarea
                  rows={3}
                  placeholder="Décrivez vos symptômes, leur intensité ou leur horaire..."
                  value={textValue}
                  onChange={(e) => setTextValue(e.target.value)}
                  required
                  className="bg-white"
                />
              </div>
            ) : (
              <div className="space-y-1.5 p-3.5 bg-teal-50/30 rounded-xl border border-teal-100">
                <Label className="text-sm font-medium text-gray-700 flex items-center gap-1.5">
                  {measurementCode === "blood_glucose" && <Droplet className="h-4 w-4 text-blue-500" />}
                  {measurementCode === "heart_rate" && <Activity className="h-4 w-4 text-rose-500" />}
                  {measurementCode === "weight" && <Scale className="h-4 w-4 text-amber-500" />}
                  {measurementCode === "spo2" && <Wind className="h-4 w-4 text-cyan-500" />}
                  {measurementCode === "temperature" && <Thermometer className="h-4 w-4 text-orange-500" />}
                  {measurementCode === "pain_level" && <AlertCircle className="h-4 w-4 text-purple-500" />}
                  <span>Valeur mesurée ({currentUnit})</span>
                </Label>
                <Input
                  type="number"
                  step="any"
                  placeholder={`Valeur en ${currentUnit}`}
                  value={numericValue}
                  onChange={(e) => setNumericValue(e.target.value)}
                  required
                  className="bg-white font-medium text-lg"
                />
              </div>
            )}

            {/* Plausibility Warning Alert */}
            {warning && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg flex items-start gap-2 text-xs text-amber-800">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <span>{warning}</span>
              </div>
            )}

            {/* Context and Timestamp */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">Contexte de mesure</Label>
                <select
                  value={context}
                  onChange={(e) => setContext(e.target.value)}
                  className="w-full h-9 px-3 bg-white border border-gray-300 rounded-lg text-xs font-medium text-gray-800 focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-500"
                >
                  <option value="resting">{t("chronic.context_resting", "Au repos")}</option>
                  <option value="fasting">{t("chronic.context_fasting", "À jeun")}</option>
                  <option value="post_meal">{t("chronic.context_post_meal", "Après repas")}</option>
                  <option value="post_exercise">{t("chronic.context_post_exercise", "Après effort")}</option>
                  <option value="morning">{t("chronic.context_morning", "Au réveil")}</option>
                  <option value="bedtime">{t("chronic.context_bedtime", "Au coucher")}</option>
                  <option value="standard">{t("chronic.context_standard", "Standard / Non précisé")}</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-gray-700">{t("chronic.datetime_label", "Date et heure")}</Label>
                <Input
                  type="datetime-local"
                  value={observedAtDate}
                  onChange={(e) => setObservedAtDate(e.target.value)}
                  required
                  className="bg-white text-xs h-9"
                />
              </div>
            </div>

            {/* Clinical notes / Remarks */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-gray-700">{t("chronic.personal_notes_label", "Notes personnelles ou remarques")}</Label>
              <Input
                type="text"
                placeholder="Ex: Prise après traitement, légère fatigue..."
                value={clinicalNotes}
                onChange={(e) => setClinicalNotes(e.target.value)}
                className="bg-white text-sm"
              />
            </div>

            {/* Non-alarmist, non-diagnostic disclaimer */}
            <div className="p-2.5 bg-gray-50 border border-gray-200 rounded-lg text-[11px] text-gray-500 leading-relaxed">
              {t(
                "chronic.disclaimer_no_diagnosis",
                "Ces données sont collectées à des fins de suivi longitudinal. Elles ne constituent ni un diagnostic médical automatisé ni une prescription thérapeutique."
              )}
            </div>

            <DialogFooter className="pt-2">
              <Button type="button" variant="outline" onClick={handleClose} disabled={isSubmitting}>
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
                    Enregistrement...
                  </>
                ) : (
                  t("chronic.btn_save", "Enregistrer")
                )}
              </Button>
            </DialogFooter>
          </form>
        </RecordModalErrorBoundary>
      </DialogContent>
    </Dialog>
  );
};
