import React, { useState, useEffect } from "react";
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
} from "../ui/dialog";
import { Button } from "../ui/button";
import { Input } from "../ui/input";
import { Label } from "../ui/label";
import { Textarea } from "../ui/textarea";
import { Badge } from "../ui/badge";
import {
  FlaskConical,
  Clock,
  Calendar,
  MapPin,
  Phone,
  Upload,
  AlertTriangle,
  Info,
  Check,
  X,
  FileText,
  DollarSign,
  Loader2,
  ShieldCheck,
} from "lucide-react";

interface CreateHomeLabRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (requestId: string) => void;
  initialBeneficiaryId?: string;
  initialAppointmentId?: string;
}

export const CreateHomeLabRequestModal: React.FC<CreateHomeLabRequestModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  initialBeneficiaryId,
  initialAppointmentId,
}) => {
  const { t } = useTranslation();

  // Load catalog and labs (auto-initializing if needed)
  const catalog = useQuery(api.homeLab.getLabTestCatalog, {}) || [];
  const labs = useQuery(api.homeLab.getLaboratoryPartners) || [];
  const initCatalogMutation = useMutation(api.homeLab.initDefaultCatalog);

  const createRequestMutation = useMutation(api.homeLab.createHomeLabRequest);
  const generateUploadUrl = useMutation(api.homeLab.generateHomeLabUploadUrl);

  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedTestCodes, setSelectedTestCodes] = useState<string[]>([]);
  const [scheduledDate, setScheduledDate] = useState<string>(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    return tomorrow.toISOString().slice(0, 10);
  });
  const [scheduledTimeSlot, setScheduledTimeSlot] = useState<string>("07:30 - 09:30");
  const [address, setAddress] = useState<string>("");
  const [city, setCity] = useState<string>("Nouakchott");
  const [phone, setPhone] = useState<string>("");
  const [patientNotes, setPatientNotes] = useState<string>("");
  const [selectedLabId, setSelectedLabId] = useState<string>("");

  // Prescription upload
  const [prescriptionStorageId, setPrescriptionStorageId] = useState<string | undefined>(undefined);
  const [prescriptionFileName, setPrescriptionFileName] = useState<string>("");
  const [isUploadingPrescription, setIsUploadingPrescription] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Auto-seed default tests if catalog is empty
  useEffect(() => {
    if (isOpen && catalog.length === 0) {
      initCatalogMutation();
    }
  }, [isOpen, catalog.length, initCatalogMutation]);

  // Default lab selection
  useEffect(() => {
    if (labs.length > 0 && !selectedLabId) {
      setSelectedLabId(labs[0]._id);
    }
  }, [labs, selectedLabId]);

  const toggleTest = (code: string) => {
    setSelectedTestCodes((prev) =>
      prev.includes(code) ? prev.filter((c) => c !== code) : [...prev, code]
    );
  };

  const selectedTests = catalog.filter((t) => selectedTestCodes.includes(t.code));
  const requiresFasting = selectedTests.some((t) => t.fastingRequired);
  const requiresPrescription = selectedTests.some((t) => t.prescriptionRequired);

  const analysesTotal = selectedTests.reduce((sum, t) => sum + (t.indicativePrice || 0), 0);
  const chosenLab = labs.find((l) => l._id === selectedLabId) || labs[0];
  const collectionFee = chosenLab?.collectionFee || 400;
  const grandTotal = analysesTotal + (selectedTests.length > 0 ? collectionFee : 0);

  const handlePrescriptionUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("La taille du fichier ne doit pas dépasser 10 Mo.");
      return;
    }

    try {
      setIsUploadingPrescription(true);
      const uploadUrl = await generateUploadUrl();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/octet-stream" },
        body: file,
      });

      if (!res.ok) {
        throw new Error("Échec du téléversement");
      }

      const { storageId } = await res.json();
      setPrescriptionStorageId(storageId);
      setPrescriptionFileName(file.name);
      toast.success("Ordonnance téléversée avec succès.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur de téléversement de l'ordonnance");
    } finally {
      setIsUploadingPrescription(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (selectedTestCodes.length === 0) {
      toast.error("Veuillez sélectionner au moins une analyse médicale.");
      return;
    }

    if (requiresPrescription && !prescriptionStorageId) {
      toast.error("L'ordonnance médicale est obligatoire pour les analyses sélectionnées.");
      return;
    }

    if (!address.trim()) {
      toast.error("Veuillez renseigner l'adresse complète pour le passage du préleveur.");
      return;
    }

    if (!phone.trim()) {
      toast.error("Veuillez renseigner un numéro de téléphone de contact joignable.");
      return;
    }

    try {
      setIsSubmitting(true);
      const res = await createRequestMutation({
        beneficiaryId: initialBeneficiaryId ? (initialBeneficiaryId as Id<"users">) : undefined,
        testCodes: selectedTestCodes,
        laboratoryId: selectedLabId ? (selectedLabId as Id<"laboratoryPartners">) : undefined,
        appointmentId: initialAppointmentId ? (initialAppointmentId as Id<"appointments">) : undefined,
        scheduledDate,
        scheduledTimeSlot,
        address: address.trim(),
        city: city.trim(),
        phone: phone.trim(),
        patientNotes: patientNotes.trim() || undefined,
        prescriptionStorageId,
      });

      toast.success(`Demande enregistrée avec succès ! Code de suivi : ${res.sampleCode}`);
      onClose();
      if (onSuccess && res.requestId) {
        onSuccess(res.requestId);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la réservation du prélèvement");
    } finally {
      setIsSubmitting(false);
    }
  };

  const categories = [
    { id: "all", label: "Toutes les analyses" },
    { id: "hematologie", label: "Hématologie (NFS)" },
    { id: "biochimie", label: "Biochimie & Métabolisme" },
    { id: "lipidique", label: "Bilan Lipidique" },
    { id: "metabolique", label: "Diabète (HbA1c)" },
    { id: "autre", label: "Autres analyses" },
  ];

  const filteredTests = catalog.filter((item) => {
    if (selectedCategory === "all") return true;
    return item.category === selectedCategory;
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-[94vw] max-w-5xl max-h-[90vh] flex flex-col p-0 overflow-hidden sm:rounded-2xl border border-slate-200 shadow-2xl bg-white">
        {/* Modal Header */}
        <DialogHeader className="p-5 sm:p-6 pb-4 border-b border-slate-100 shrink-0 bg-slate-50/60">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
                <FlaskConical className="w-5 h-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 text-[11px] font-semibold">
                    MauriCare HomeLab
                  </Badge>
                  <DialogTitle className="text-lg sm:text-xl font-bold text-slate-900">
                    {t("homelab.btn_request_analysis")}
                  </DialogTitle>
                </div>
                <DialogDescription className="text-xs text-slate-500 mt-0.5">
                  {t("homelab.no_ai_disclaimer")} • Prélèvement par soignant qualifié et analyses en laboratoire agréé
                </DialogDescription>
              </div>
            </div>
            {selectedTestCodes.length > 0 && (
              <Badge className="bg-emerald-600 text-white font-semibold text-xs px-2.5 py-1">
                {selectedTestCodes.length} analyse(s) sélectionnée(s)
              </Badge>
            )}
          </div>
        </DialogHeader>

        {/* Form Body - Scrollable */}
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 min-h-0 overflow-hidden">
          <div className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-6">
            {/* Step 1: Select Analyses */}
            <div className="space-y-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">1</span>
                  Choisissez les analyses médicales prescrites ou souhaitées *
                </Label>
                <span className="text-xs text-slate-500">
                  Cochez une ou plusieurs analyses du catalogue
                </span>
              </div>

              {/* Category Filter Pills */}
              <div className="flex gap-2 overflow-x-auto pb-1 text-xs no-scrollbar">
                {categories.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSelectedCategory(c.id)}
                    className={`px-3 py-1.5 rounded-full whitespace-nowrap transition-colors font-medium ${
                      selectedCategory === c.id
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                    }`}
                  >
                    {c.label}
                  </button>
                ))}
              </div>

              {/* Test Cards Grid - Desktop-wide 2 to 3 columns without truncation */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 max-h-72 overflow-y-auto p-2.5 rounded-xl border border-slate-200 bg-slate-50/50">
                {filteredTests.map((test) => {
                  const isSelected = selectedTestCodes.includes(test.code);
                  return (
                    <div
                      key={test.code}
                      onClick={() => toggleTest(test.code)}
                      className={`p-3 rounded-lg border text-xs cursor-pointer transition-all flex items-start justify-between gap-3 ${
                        isSelected
                          ? "bg-emerald-50/80 border-emerald-500 ring-1 ring-emerald-500 shadow-sm"
                          : "bg-white border-slate-200 hover:border-slate-300 hover:shadow-xs"
                      }`}
                    >
                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="text-xs font-bold text-slate-900 leading-snug break-words whitespace-normal">
                          {test.name}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {test.fastingRequired && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-amber-50 text-amber-800 border-amber-200 font-medium">
                              Jeûne requis
                            </Badge>
                          )}
                          {test.prescriptionRequired && (
                            <Badge variant="outline" className="text-[10px] py-0 bg-blue-50 text-blue-700 border-blue-200 font-medium">
                              Ordonnance
                            </Badge>
                          )}
                          <span className="text-[10px] text-slate-400 capitalize">
                            {test.sampleType.replace("_", " ")}
                          </span>
                        </div>
                      </div>
                      <div className="text-right shrink-0 flex flex-col items-end justify-between self-stretch pl-2">
                        <span className="font-bold text-xs text-slate-900">
                          {test.indicativePrice} MRU
                        </span>
                        <div
                          className={`w-4 h-4 rounded border flex items-center justify-center mt-2 ${
                            isSelected
                              ? "bg-emerald-600 border-emerald-600 text-white"
                              : "border-slate-300 bg-white"
                          }`}
                        >
                          {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Fasting Notice */}
              {requiresFasting && (
                <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2.5">
                  <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div>
                    <span className="font-bold block">{t("homelab.fasting_rule_mandatory", "Consigne de jeûne obligatoire pour votre commande :")}</span>
                    <p className="mt-0.5 text-amber-800 leading-relaxed">
                      {t("homelab.fasting_rule_desc", "Une ou plusieurs analyses sélectionnées nécessitent d'être strictement à jeun (8 à 12h avant le prélèvement). L'eau plate reste autorisée.")}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Step 2: Prescription Upload if required */}
            {requiresPrescription && (
              <div className="p-4 bg-blue-50/70 border border-blue-200 rounded-xl space-y-2.5">
                <div className="flex items-center justify-between">
                  <Label className="text-xs font-bold text-blue-900 flex items-center gap-1.5">
                    <FileText className="w-4 h-4 text-blue-600" />
                    {t("homelab.prescription_mandatory_title", "Ordonnance médicale obligatoire pour les analyses sélectionnées *")}
                  </Label>
                  {prescriptionFileName && (
                    <Badge className="bg-emerald-600 text-white text-[10px]">
                      {t("homelab.document_attached", "✓ Document joint")}
                    </Badge>
                  )}
                </div>
                <p className="text-[11px] text-blue-800 leading-relaxed">
                  {t("homelab.prescription_instructions", "Veuillez joindre une photo ou un document PDF lisible de l'ordonnance prescrite par votre médecin traitant.")}
                </p>
                <div className="flex items-center gap-3 pt-1">
                  <label className="cursor-pointer inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-white border border-blue-300 rounded-lg text-xs font-medium text-blue-700 hover:bg-blue-50 transition-colors shadow-xs">
                    <Upload className="w-3.5 h-3.5" />
                    <span>{prescriptionFileName ? t("homelab.change_prescription", "Changer l'ordonnance") : t("homelab.upload_prescription", "Téléverser l'ordonnance")}</span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={handlePrescriptionUpload}
                      disabled={isUploadingPrescription}
                      className="hidden"
                    />
                  </label>
                  {isUploadingPrescription && (
                    <div className="flex items-center gap-1.5 text-xs text-blue-700">
                      <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600" />
                      <span>{t("homelab.secure_uploading", "Téléversement sécurisé...")}</span>
                    </div>
                  )}
                  {prescriptionFileName && (
                    <span className="text-xs text-slate-700 truncate max-w-sm font-medium">
                      {prescriptionFileName}
                    </span>
                  )}
                </div>
              </div>
            )}

            {/* Step 3: Logistics & Address */}
            <div className="space-y-4 pt-1 border-t border-slate-100">
              <Label className="text-sm font-bold text-slate-900 flex items-center gap-2">
                <span className="w-5 h-5 rounded-full bg-emerald-600 text-white text-xs flex items-center justify-center font-bold">2</span>
                Adresse de passage et créneau d'intervention du préleveur *
              </Label>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs text-slate-700 font-medium">{t("homelab.scheduled_date")} *</Label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    min={new Date().toISOString().slice(0, 10)}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    className="mt-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-700 font-medium">{t("homelab.time_slot")} *</Label>
                  <select
                    value={scheduledTimeSlot}
                    onChange={(e) => setScheduledTimeSlot(e.target.value)}
                    className="mt-1 w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-xs shadow-xs focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  >
                    <option value="07:00 - 08:30">{t("homelab.slot_morning_fasting", "07:00 - 08:30 (Recommandé pour bilan à jeun)")}</option>
                    <option value="08:30 - 10:00">{t("homelab.slot_morning", "08:30 - 10:00 (Matinée)")}</option>
                    <option value="10:00 - 12:00">{t("homelab.slot_midday", "10:00 - 12:00")}</option>
                    <option value="15:00 - 17:00">{t("homelab.slot_afternoon", "15:00 - 17:00 (Après-midi)")}</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-slate-700 font-medium">{t("homelab.home_full_address", "Adresse complète du domicile *")}</Label>
                  <Input
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Quartier (ex: Tevragh Zeina), Rue, N° villa ou repère précis..."
                    className="mt-1 text-xs"
                    required
                  />
                </div>
                <div>
                  <Label className="text-xs text-slate-700 font-medium">{t("homelab.contact_phone", "Téléphone de contact *")}</Label>
                  <Input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: 45 00 00 00"
                    className="mt-1 text-xs"
                    required
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs text-slate-700 font-medium">{t("homelab.access_instructions", "Instructions d'accès pour le soignant (Optionnel)")}</Label>
                <Textarea
                  value={patientNotes}
                  onChange={(e) => setPatientNotes(e.target.value)}
                  placeholder="Ex: Portail blanc en face de l'épicerie, sonner 2 fois..."
                  rows={2}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Step 4: Laboratory Partner Info */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] text-slate-500 uppercase font-bold tracking-wider block">
                    {t("homelab.partner_lab", "Laboratoire Partenaire Conventionné")}
                  </span>
                  <span className="text-xs font-bold text-slate-900">
                    {chosenLab?.name || "Laboratoire Central d'Analyses Médicales de Nouakchott"}
                  </span>
                </div>
                <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-200 text-[11px] self-start sm:self-auto font-medium">
                  {t("homelab.cash_payment_notice", "Règlement direct en espèces lors du passage")}
                </Badge>
              </div>
            </div>
          </div>

          {/* Sticky Modal Footer with Clear Financial Breakdown */}
          <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-4 shrink-0">
            <div className="flex items-center gap-4 text-xs text-slate-600 w-full sm:w-auto justify-between sm:justify-start">
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">Analyses ({selectedTests.length})</span>
                <span className="font-semibold text-slate-800">{analysesTotal} MRU</span>
              </div>
              <span className="text-slate-300">/</span>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t("homelab.caregiver_transit", "Déplacement soignant")}</span>
                <span className="font-semibold text-slate-800">{selectedTests.length > 0 ? collectionFee : 0} MRU</span>
              </div>
              <span className="text-slate-300">/</span>
              <div>
                <span className="text-slate-400 block text-[10px] uppercase font-semibold">{t("homelab.total_to_pay", "Total à régler")}</span>
                <span className="text-sm font-extrabold text-emerald-700">{grandTotal} MRU</span>
              </div>
            </div>

            <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
              <Button type="button" variant="outline" onClick={onClose} disabled={isSubmitting} className="text-xs">
                Annuler
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || selectedTestCodes.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-sm"
              >
                {isSubmitting && <Loader2 className="w-3.5 h-3.5 mr-2 animate-spin" />}
                Confirmer la commande ({grandTotal} MRU)
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};
