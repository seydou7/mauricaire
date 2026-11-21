import { useState, useMemo } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  Syringe,
  Heart,
  Stethoscope,
  Ambulance,
  AlertCircle,
  Loader2,
  UserCheck,
  Star,
  Banknote,
  Repeat,
  Sparkles,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { getLocalizedServiceLabel, getLocalizedSpecialtyLabel } from "@/lib/services";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { sanitizeBookingError } from "@/lib/authValidation";

const NOUAKCHOTT_ZONES = [
  "Tevragh Zeina",
  "Ksar",
  "Sebkha",
  "El Mina",
  "Teyarett",
  "Dar Naim",
  "Arafat",
  "Riyadh",
  "Toujounine",
] as const;

const SPECIALTY_DISPLAY_BOOKING: Record<string, string> = {
  medecin: "Médecin généraliste",
  infirmier: "Infirmier(ère) Diplômé(e)",
  kinestherapeute: "Kinésithérapeute",
  aide_soignant: "Aide-soignant(e)",
};

const SPECIALTIES = [
  { id: "infirmier", label: "Infirmier", icon: Syringe, desc: "Injections, pansements, perfusions" },
  { id: "aide_soignant", label: "Aide-soignant", icon: Heart, desc: "Toilette, aide aux repas, mobilité" },
  { id: "medecin", label: "Médecin", icon: Stethoscope, desc: "Consultation générale, diagnostic" },
  { id: "kinestherapeute", label: "Kinésithérapeute", icon: Ambulance, desc: "Rééducation motrice, mobilité" },
];

const WEEKDAY_NAMES = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Jeu" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sam" },
  { id: 7, label: "Dim" },
];

interface BookingStepperProps {
  children: React.ReactNode;
  providerId?: Id<"providers"> | string;
  initialSpecialty?: string;
  initialServiceId?: Id<"providerServices"> | string;
  initialAddress?: string;
  initialBeneficiaryId?: Id<"users"> | string;
  providerName?: string;
  consultationFee?: number;
}

export function BookingStepper({
  children,
  providerId: directProviderId,
  initialSpecialty,
  initialServiceId,
  initialAddress,
  initialBeneficiaryId,
  providerName: directProviderName,
  consultationFee: directFee,
}: BookingStepperProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language?.startsWith("ar");
  const [open, setOpen] = useState(false);
  const isDirect = Boolean(directProviderId);

  // Steps:
  // Direct: 1: Service Catalog -> 2: Date, Slot & Address (with Recurring option) -> 3: Confirmation
  // Generic: 1: Specialty -> 2: Choose Provider -> 3: Service Catalog -> 4: Date, Slot & Address -> 5: Confirmation
  const [step, setStep] = useState(1);
  const totalSteps = isDirect ? 3 : 5;

  // Form State
  const [specialty, setSpecialty] = useState(initialSpecialty || "");
  const [selectedProviderId, setSelectedProviderId] = useState<Id<"providers"> | undefined>(directProviderId as Id<"providers"> | undefined);
  const [selectedServiceId, setSelectedServiceId] = useState<Id<"providerServices"> | undefined>(initialServiceId as Id<"providerServices"> | undefined);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<Id<"users"> | undefined>(
    initialBeneficiaryId as Id<"users"> | undefined
  );
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [userSelectedZone, setUserSelectedZone] = useState<string | null>(null);
  const [address, setAddress] = useState(initialAddress || "");
  const [notes, setNotes] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  // Query accompanied patients for delegated booking (Module 5)
  const accompaniedPatients = useQuery(api.circle.getAccompaniedPatients);
  const bookableAccompanied = accompaniedPatients?.filter((item: any) =>
    item.permissions.includes("BOOK_APPOINTMENTS")
  );
  const selectedBeneficiary = bookableAccompanied?.find(
    (item: any) => item.patientId === selectedBeneficiaryId
  );

  // Recurring Care State
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurrenceRule, setRecurrenceRule] = useState<"daily" | "weekly" | "custom_weekdays">("daily");
  const [selectedWeekdays, setSelectedWeekdays] = useState<number[]>([1, 4]); // Lundi & Jeudi par défaut
  const [totalOccurrences, setTotalOccurrences] = useState<number>(5);

  // Status & Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  // Mutations
  const createAppointment = useMutation(api.appointments.create);
  const createRecurringSeries = useMutation(api.recurringCare.createRecurringSeries);

  const effectiveProviderId = (directProviderId || selectedProviderId) as Id<"providers"> | undefined;

  // Query nearby providers when in generic mode
  const nearbyProviders = useQuery(
    api.providers.getNearbyProviders,
    !isDirect && specialty
      ? {
          specialty: specialty as "infirmier" | "aide_soignant" | "medecin" | "kinestherapeute",
          city: "Nouakchott",
        }
      : "skip"
  );

  // Query provider's configured services catalog
  const providerServices = useQuery(
    api.providerServices.getProviderServices,
    effectiveProviderId ? { providerId: effectiveProviderId } : "skip"
  );

  // Query selected provider profile for intervention zones and default fees
  const providerDetails = useQuery(
    api.providers.getById,
    effectiveProviderId ? { id: effectiveProviderId } : "skip"
  );

  // Derive active zone from user selection or provider's covered zones
  const selectedZone = useMemo(() => {
    if (userSelectedZone) return userSelectedZone;
    if (providerDetails?.interventionZones && providerDetails.interventionZones.length > 0) {
      const hasTevragh = providerDetails.interventionZones.some(
        (z) => z.toLowerCase().replace(/[-_]/g, " ").trim() === "tevragh zeina"
      );
      if (hasTevragh) return "Tevragh Zeina";
      return providerDetails.interventionZones[0];
    }
    return "Tevragh Zeina";
  }, [userSelectedZone, providerDetails?.interventionZones]);

  const setSelectedZone = (zone: string) => {
    setUserSelectedZone(zone);
  };

  // Upfront zone compatibility check
  const normalizeZone = (z: string) => z.toLowerCase().replace(/[-_]/g, " ").trim();
  const isZoneCompatible = useMemo(() => {
    if (!providerDetails?.interventionZones || providerDetails.interventionZones.length === 0) {
      return true;
    }
    const allowedNorm = providerDetails.interventionZones.map(normalizeZone);
    const selectedNorm = normalizeZone(selectedZone);
    return allowedNorm.some(
      (az) => az === selectedNorm || az.includes(selectedNorm) || selectedNorm.includes(az)
    );
  }, [providerDetails?.interventionZones, selectedZone]);

  // Find selected service object (Strictly explicitly configured services - no invented defaults)
  const selectedServiceObj = providerServices?.find((s) => s._id === selectedServiceId);
  const effectiveDuration = selectedServiceObj?.duration || 30;
  const effectivePrice = selectedServiceObj?.price ?? null;
  const effectiveServiceName = selectedServiceObj?.title || "";

  // Query authoritative available slots from server (Module 4)
  const availableSlotsData = useQuery(
    api.availability.getAvailableSlots,
    effectiveProviderId && date
      ? {
          providerId: effectiveProviderId,
          date,
          serviceId: selectedServiceId,
          durationMinutes: effectiveDuration,
        }
      : "skip"
  );

  // Query recurring series validation if recurring option active
  const recurringValidation = useQuery(
    api.recurringCare.validateRecurringSeries,
    effectiveProviderId && isRecurring && date && time
      ? {
          providerId: effectiveProviderId,
          serviceId: selectedServiceId,
          rule: recurrenceRule,
          weekdays: recurrenceRule === "custom_weekdays" ? selectedWeekdays : undefined,
          startDate: date,
          time,
          totalOccurrences,
        }
      : "skip"
  );

  const selectedProviderName = providerDetails?.user?.name || "Soignant MauriCare";
  const displayProviderName = directProviderName || selectedProviderName;

  const handleNext = () => {
    setErrorMessage(null);
    setStep((s) => Math.min(totalSteps, s + 1));
  };

  const handleBack = () => {
    setErrorMessage(null);
    setStep((s) => Math.max(1, s - 1));
  };

  const handleLocate = () => {
    setIsLocating(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setAddress(`Tevragh Zeina (${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)})`);
          setIsLocating(false);
        },
        () => {
          setAddress("Tevragh Zeina, Nouakchott");
          setIsLocating(false);
        }
      );
    } else {
      setTimeout(() => {
        setAddress("Tevragh Zeina, Nouakchott");
        setIsLocating(false);
      }, 800);
    }
  };

  const resetForm = () => {
    setStep(1);
    setSpecialty(initialSpecialty || "");
    setSelectedProviderId(directProviderId as Id<"providers"> | undefined);
    setSelectedServiceId(initialServiceId as Id<"providerServices"> | undefined);
    setSelectedBeneficiaryId(initialBeneficiaryId as Id<"users"> | undefined);
    setDate("");
    setTime("");
    setUserSelectedZone(null);
    setAddress(initialAddress || "");
    setNotes("");
    setIsRecurring(false);
    setIsSubmitting(false);
    setErrorMessage(null);
    setIsSuccess(false);
  };

  const handleSubmit = async () => {
    if (!effectiveProviderId) {
      setErrorMessage("Veuillez sélectionner un professionnel.");
      return;
    }
    if (!selectedServiceId || !selectedServiceObj) {
      setErrorMessage("Veuillez sélectionner une prestation de soin active proposée par ce praticien.");
      return;
    }
    if (availableSlotsData?.hasSchedule === false) {
      setErrorMessage("Ce professionnel n'a pas encore configuré ses disponibilités.");
      return;
    }
    if (!date || !time) {
      setErrorMessage("Veuillez choisir une date et une heure valides.");
      return;
    }
    if (!address.trim()) {
      setErrorMessage("Veuillez indiquer une adresse de prise en charge.");
      return;
    }
    if (!isZoneCompatible) {
      setErrorMessage(
        `Ce praticien n'intervient que dans les zones suivantes : ${providerDetails?.interventionZones?.join(", ") || "Non spécifié"}.`
      );
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    const fullAddress = address.trim().toLowerCase().includes(selectedZone.toLowerCase())
      ? address.trim()
      : `${selectedZone}, ${address.trim()}`;

    try {
      if (isRecurring) {
        await createRecurringSeries({
          providerId: effectiveProviderId,
          serviceId: selectedServiceId,
          rule: recurrenceRule,
          weekdays: recurrenceRule === "custom_weekdays" ? selectedWeekdays : undefined,
          startDate: date,
          time,
          totalOccurrences,
          address: fullAddress,
          notes: notes.trim() || undefined,
          allowPartial: true,
          beneficiaryId: selectedBeneficiaryId,
        });
      } else {
        await createAppointment({
          providerId: effectiveProviderId,
          serviceType: effectiveServiceName,
          serviceId: selectedServiceId,
          date,
          time,
          zone: selectedZone,
          address: fullAddress,
          notes: notes.trim() || undefined,
          paymentMethod: "cash",
          duration: effectiveDuration,
          beneficiaryId: selectedBeneficiaryId,
        });
      }

      setIsSuccess(true);
      setTimeout(() => {
        setOpen(false);
        resetForm();
      }, 2500);
    } catch (err: any) {
      setErrorMessage(sanitizeBookingError(err, t));
    } finally {
      setIsSubmitting(false);
    }
  };

  // Helper pour savoir sur quelle vue logique on se trouve
  const isServicesStep = (isDirect && step === 1) || (!isDirect && step === 3);
  const isDateTimeStep = (isDirect && step === 2) || (!isDirect && step === 4);
  const isConfirmStep = (isDirect && step === 3) || (!isDirect && step === 5);

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) resetForm();
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent dir={isRtl ? "rtl" : "ltr"} className="sm:max-w-[560px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
        <div className="p-6">
          <DialogHeader className="mb-4">
            <DialogTitle className="text-xl font-bold flex items-center justify-between">
              <span className="flex items-center gap-2">
                <Calendar className="h-5 w-5 text-primary" />
                {isDirect ? `Réserver avec ${displayProviderName}` : "Prendre un rendez-vous"}
              </span>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20">
                Étape {step} sur {totalSteps}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {isDirect
                ? "Réservation directe de prestation de santé certifiée à domicile."
                : "Sélectionnez votre besoin médical, choisissez votre praticien et planifiez vos soins."}
            </DialogDescription>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="w-full bg-muted/40 h-1.5 rounded-full mb-6 overflow-hidden">
            <motion.div
              className="h-full bg-primary"
              initial={{ width: "25%" }}
              animate={{ width: `${(step / totalSteps) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          {errorMessage && (
            <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2 animate-in fade-in">
              <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* SELECTEUR DU BÉNÉFICIAIRE DU SOIN (MauriCare Circle - Module 5) */}
          {bookableAccompanied && bookableAccompanied.length > 0 && (
            <div className="mb-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-700 flex items-center gap-1.5">
                  <Heart className="w-3.5 h-3.5 text-teal-600" />
                  {t("circle.delegated_booking_title", "Pour qui réservez-vous ce soin ?")}
                </span>
                {selectedBeneficiary && (
                  <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px] font-semibold">
                    {t("booking.delegated_booking", "Réservation déléguée")}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedBeneficiaryId(undefined);
                    if (initialAddress) setAddress(initialAddress);
                  }}
                  className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all ${
                    !selectedBeneficiaryId
                      ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                      : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                  }`}
                >
                  {t("circle.for_myself", "Pour moi-même")}
                </button>
                {bookableAccompanied.map((item: any) => {
                  const isSelected = selectedBeneficiaryId === item.patientId;
                  return (
                    <button
                      key={item.patientId}
                      type="button"
                      onClick={() => {
                        setSelectedBeneficiaryId(item.patientId);
                        const p = item.patient;
                        const patientAddr = p.address || [p.neighborhood, p.city].filter(Boolean).join(", ");
                        if (patientAddr) setAddress(patientAddr);
                      }}
                      className={`text-xs px-3 py-1.5 rounded-lg border font-medium transition-all flex items-center gap-1.5 ${
                        isSelected
                          ? "bg-teal-700 text-white border-teal-700 shadow-sm"
                          : "bg-white text-slate-700 border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span>{item.patient.name}</span>
                      <span className={`text-[10px] ${isSelected ? "text-teal-200" : "text-slate-400"}`}>
                        ({String(t(`circle.relationships.${item.relationship}` as any, item.relationship))})
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <AnimatePresence mode="wait">
            {/* GENERIC MODE ONLY: STEP 1 - SPECIALTY */}
            {!isDirect && step === 1 && (
              <motion.div
                key="step1-specialty"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-base">De quel type de soin avez-vous besoin ?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIALTIES.map((spec) => {
                    const Icon = spec.icon;
                    const isSelected = specialty === spec.id;
                    return (
                      <div
                        key={spec.id}
                        onClick={() => setSpecialty(spec.id)}
                        className={`p-3.5 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                            : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                        }`}
                      >
                        <Icon className={`h-5 w-5 mb-2 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                        <div className={`font-semibold text-sm ${isSelected ? "text-primary" : ""}`}>
                          {spec.label}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5 leading-snug">{spec.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* GENERIC MODE ONLY: STEP 2 - CHOOSE PROVIDER */}
            {!isDirect && step === 2 && (
              <motion.div
                key="step2-provider"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-base">{t("booking.choose_provider", "Choisissez un professionnel certifié")}</h3>
                <p className="text-xs text-muted-foreground -mt-2">
                  Praticiens disponibles pour {SPECIALTIES.find((s) => s.id === specialty)?.label}
                </p>

                <div className="space-y-2.5 max-h-[260px] overflow-y-auto pr-1">
                  {nearbyProviders === undefined ? (
                    <div className="py-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {t("booking.searching_providers", "Recherche des praticiens disponibles...")}
                    </div>
                  ) : nearbyProviders.length === 0 ? (
                    <div className="py-8 text-center text-muted-foreground text-sm border border-dashed rounded-xl p-4">
                      {t("booking.no_provider_available", "Aucun soignant disponible immédiatement pour cette spécialité.")}
                    </div>
                  ) : (
                    nearbyProviders.map((prov) => {
                      const isSelected = selectedProviderId === prov._id;
                      const provName = prov.user?.name || "Soignant MauriCare";
                      return (
                        <div
                          key={prov._id}
                          onClick={() => setSelectedProviderId(prov._id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                              : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {provName.split(" ").map((n: string) => n[0]).join("")}
                            </div>
                            <div>
                              <div className="flex items-center gap-1.5">
                                <span className="font-semibold text-sm">{provName}</span>
                                <UserCheck className="h-3.5 w-3.5 text-emerald-600" />
                              </div>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                                <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                                  <Star className="h-3 w-3 fill-amber-400" />
                                  {prov.rating?.toFixed(1) || "5.0"}
                                </span>
                                <span>•</span>
                                <span>{prov.yearsOfExperience || 3} ans exp.</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <Badge variant="secondary" className="text-xs font-semibold text-foreground">
                              {prov.consultationFee ? `${prov.consultationFee} MRU` : "Tarif non renseigné"}
                            </Badge>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* SERVICES SELECTION STEP (Direct Step 1 or Generic Step 3) */}
            {isServicesStep && (
              <motion.div
                key="step-services"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <div>
                  <h3 className="font-semibold text-base">{t("booking.service_wanted", "Prestation de soin souhaitée")}</h3>
                  <p className="text-xs text-muted-foreground">
                    {t("booking.service_prices_set_by_provider", "Tarifs et durées fixés directement par le soignant")}
                  </p>
                </div>

                <div className="space-y-2 max-h-[260px] overflow-y-auto pr-1">
                  {providerServices === undefined ? (
                    <div className="py-8 flex items-center justify-center text-muted-foreground text-sm gap-2">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {t("booking.loading_services", "Chargement des prestations de soins...")}
                    </div>
                  ) : providerServices.length === 0 ? (
                    <div className="p-5 bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 rounded-xl text-center space-y-1.5">
                      <AlertCircle className="h-6 w-6 mx-auto text-amber-500" />
                      <p className="font-semibold text-sm">{t("booking.no_services_configured", "Aucune prestation de soin configurée")}</p>
                      <p className="text-xs text-muted-foreground max-w-xs mx-auto">
                        {t("booking.no_services_desc", "Ce professionnel n'a pas encore configuré ses prestations de soins. La réservation n'est pas possible pour le moment.")}
                      </p>
                    </div>
                  ) : (
                    providerServices.map((svc) => {
                      const isSelected = selectedServiceId === svc._id;
                      return (
                        <div
                          key={svc._id}
                          onClick={() => setSelectedServiceId(svc._id)}
                          className={`p-3 rounded-xl border cursor-pointer flex items-center justify-between transition-all ${
                            isSelected
                              ? "border-primary bg-primary/10 shadow-sm ring-1 ring-primary/30"
                              : "border-border/50 hover:border-primary/30 hover:bg-muted/30"
                          }`}
                        >
                          <div>
                            <div className="font-semibold text-sm text-foreground flex items-center gap-1.5">
                              <Sparkles className="h-4 w-4 text-primary" />
                              {svc.titleAr && i18n.language === "ar" ? svc.titleAr : getLocalizedServiceLabel(svc.title, i18n.language)}
                            </div>
                            {svc.description && (
                              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                {svc.descriptionAr && i18n.language === "ar" ? svc.descriptionAr : svc.description}
                              </p>
                            )}
                          </div>
                          <div className="text-right shrink-0 ml-3">
                            <span className="font-bold text-sm text-primary">
                              {svc.price !== undefined && svc.price !== null ? `${svc.price} MRU` : "Tarif non renseigné"}
                            </span>
                            <p className="text-[10px] text-muted-foreground">{svc.duration} min</p>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </motion.div>
            )}

            {/* DATE, TIME, RECURRENCE & ADDRESS STEP (Direct Step 2 or Generic Step 4) */}
            {isDateTimeStep && (
              <motion.div
                key="step-datetime"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {/* Toggle Soin ponctuel / Soin récurrent */}
                <div className="flex items-center justify-between bg-muted/30 p-2 rounded-xl border border-border/50">
                  <div className="flex items-center gap-2">
                    <Repeat className="h-4 w-4 text-primary" />
                    <div>
                      <p className="text-xs font-semibold">{t("booking.recurring_protocol", "Protocole de soins récurrents")}</p>
                      <p className="text-[10px] text-muted-foreground">{t("booking.recurring_protocol_sub", "Pansements réguliers, rééducation, perfusion...")}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isRecurring}
                      onChange={(e) => setIsRecurring(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-muted peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary"></div>
                  </label>
                </div>

                {/* Si récurrent, configuration du protocole */}
                {isRecurring && (
                  <div className="p-3 bg-primary/5 rounded-xl border border-primary/20 space-y-2.5">
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <button
                        type="button"
                        onClick={() => setRecurrenceRule("daily")}
                        className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                          recurrenceRule === "daily"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/40 hover:bg-muted/40"
                        }`}
                      >
                        {t("booking.daily_rule", "Quotidien (Tous les jours)")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceRule("weekly")}
                        className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                          recurrenceRule === "weekly"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/40 hover:bg-muted/40"
                        }`}
                      >
                        {t("booking.weekly_rule", "Hebdomadaire (1x/sem)")}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRecurrenceRule("custom_weekdays")}
                        className={`py-1.5 px-2 rounded-lg font-medium border text-center transition-all ${
                          recurrenceRule === "custom_weekdays"
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-background border-border/40 hover:bg-muted/40"
                        }`}
                      >
                        {t("booking.custom_weekdays_rule", "Jours choisis")}
                      </button>
                    </div>

                    {recurrenceRule === "custom_weekdays" && (
                      <div className="flex gap-1 justify-between pt-1">
                        {WEEKDAY_NAMES.map((d) => {
                          const active = selectedWeekdays.includes(d.id);
                          return (
                            <button
                              key={d.id}
                              type="button"
                              onClick={() => {
                                if (active) {
                                  if (selectedWeekdays.length > 1) {
                                    setSelectedWeekdays(selectedWeekdays.filter((id) => id !== d.id));
                                  }
                                } else {
                                  setSelectedWeekdays([...selectedWeekdays, d.id]);
                                }
                              }}
                              className={`w-9 h-8 rounded-lg text-xs font-bold transition-all ${
                                active ? "bg-primary text-primary-foreground" : "bg-background border border-border/40"
                              }`}
                            >
                              {d.label}
                            </button>
                          );
                        })}
                      </div>
                    )}

                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">{t("booking.total_sessions", "Nombre total de séances :")}</span>
                      <select
                        value={totalOccurrences}
                        onChange={(e) => setTotalOccurrences(Number(e.target.value))}
                        className="h-8 px-2 rounded-lg border border-border/50 bg-background text-xs font-bold"
                      >
                        <option value={3}>{t("booking.sessions_count", { count: 3, defaultValue: "3 séances" })}</option>
                        <option value={5}>{t("booking.sessions_count", { count: 5, defaultValue: "5 séances" })}</option>
                        <option value={7}>{t("booking.sessions_count", { count: 7, defaultValue: "7 séances" })}</option>
                        <option value={10}>{t("booking.sessions_count", { count: 10, defaultValue: "10 séances" })}</option>
                        <option value={14}>{t("booking.sessions_count", { count: 14, defaultValue: "14 séances" })}</option>
                      </select>
                    </div>
                  </div>
                )}

                {/* Date et créneaux */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3.5 w-3.5 text-primary" />
                      {isRecurring ? "Date de la première séance" : "Date de l'intervention"}
                    </label>
                    <Input
                      type="date"
                      value={date}
                      min={new Date().toISOString().split("T")[0]}
                      onChange={(e) => {
                        setDate(e.target.value);
                        setTime("");
                      }}
                      className="h-10 text-sm"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5 text-primary" /> {t("booking.time_selected", "Heure retenue :")} {time || t("booking.not_chosen", "Non choisie")}
                    </label>
                    <div className="h-10 px-3 rounded-md border border-input bg-muted/20 flex items-center text-sm font-medium">
                      {time ? (
                        <span className="text-primary font-bold">{time}</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">{t("booking.selected_slot", "Sélectionnez un créneau")}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Grille des créneaux calculés par le serveur */}
                {date && (
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between text-xs text-muted-foreground">
                      <span>{t("booking.available_slots_provider", "Créneaux disponibles auprès du praticien :")}</span>
                      {availableSlotsData?.available && (
                        <span className="text-emerald-600 font-medium">
                          {t("booking.slots_free_count", { count: availableSlotsData.slots.length, defaultValue: `${availableSlotsData.slots.length} créneau(x) libre(s)` })}
                        </span>
                      )}
                    </div>

                    {availableSlotsData === undefined ? (
                      <div className="py-6 flex items-center justify-center text-xs text-muted-foreground gap-2">
                        <Loader2 className="h-4 w-4 animate-spin text-primary" />
                        {t("booking.generating_slots", "Génération des disponibilités temps réel...")}
                      </div>
                    ) : !availableSlotsData.available || availableSlotsData.slots.length === 0 ? (
                      <div className="p-3 bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl text-xs flex items-center gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0" />
                        <span>
                          {availableSlotsData.reason || t("booking.no_slots_available", "Aucun créneau disponible pour cette date. Veuillez choisir un autre jour.")}
                        </span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-5 gap-1.5 max-h-[110px] overflow-y-auto p-1 bg-muted/20 rounded-xl border border-border/40">
                        {availableSlotsData.slots.map((slot) => {
                          const isSelected = time === slot;
                          return (
                            <button
                              key={slot}
                              type="button"
                              onClick={() => setTime(slot)}
                              className={`py-1.5 text-xs rounded-lg font-medium transition-all ${
                                isSelected
                                  ? "bg-primary text-primary-foreground shadow-sm font-bold"
                                  : "bg-card hover:bg-primary/10 hover:text-primary border border-border/40"
                              }`}
                            >
                              {slot}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* Validation de la série récurrente */}
                {isRecurring && time && recurringValidation && (
                  <div className="p-2.5 rounded-xl border text-xs space-y-1 bg-muted/30">
                    <div className="flex items-center justify-between font-semibold">
                      <span>{t("booking.series_verification", "Vérification de la série :")}</span>
                      <span className={recurringValidation.allAvailable ? "text-emerald-600" : "text-amber-600"}>
                        {t("booking.sessions_available_count", { available: recurringValidation.availableCount, total: recurringValidation.total, defaultValue: `${recurringValidation.availableCount} / ${recurringValidation.total} séances disponibles` })}
                      </span>
                    </div>
                    {!recurringValidation.allAvailable && (
                      <p className="text-[11px] text-amber-600">
                        {t("booking.agenda_conflict_warning", "Certaines dates présentent un conflit d'agenda. Seules les séances sans conflit seront réservées.")}
                      </p>
                    )}
                  </div>
                )}

                {/* Adresse et zone d'intervention */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-xs">
                    <label className="font-semibold text-foreground flex items-center gap-1.5">
                      <MapPin className="h-4 w-4 text-primary" /> {t("booking.home_care_location", "Lieu de prise en charge à domicile")}
                    </label>
                    {providerDetails?.interventionZones && providerDetails.interventionZones.length > 0 && (
                      <span className="text-[10px] text-muted-foreground">
                        {t("booking.zones_covered", "Zones couvertes :")} {providerDetails.interventionZones.join(", ")}
                      </span>
                    )}
                  </div>

                  {/* Zone compatibility indicator or warning banner */}
                  {!isZoneCompatible ? (
                    <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-xl text-destructive text-xs space-y-2 animate-in fade-in">
                      <div className="flex items-start gap-2">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-semibold">Zone non desservie par ce praticien</p>
                          <p className="text-[11px] mt-0.5 text-destructive/90">
                            {displayProviderName} n'intervient que dans : {providerDetails?.interventionZones?.join(", ")}.
                          </p>
                        </div>
                      </div>
                      {!isDirect && (
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          onClick={() => setStep(2)}
                          className="text-xs h-7 border-destructive/30 hover:bg-destructive/10 text-destructive w-full"
                        >
                          Choisir un autre soignant
                        </Button>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 text-xs text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/30 p-2 rounded-lg border border-emerald-200 dark:border-emerald-900/40">
                      <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                      <span>Zone d'intervention couverte par ce praticien ({selectedZone})</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                    <div>
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                        Zone (Mougataa) *
                      </label>
                      <select
                        value={selectedZone}
                        onChange={(e) => setSelectedZone(e.target.value)}
                        className="w-full h-10 px-2 rounded-xl border border-input bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      >
                        {NOUAKCHOTT_ZONES.map((z) => (
                          <option key={z} value={z}>
                            {z}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="sm:col-span-2">
                      <label className="text-[11px] font-medium text-muted-foreground mb-1 block">
                        {t("booking.exact_address_input", "Adresse exacte (rue, repère) *")}
                      </label>
                      <div className="flex gap-2">
                        <Input
                          placeholder="Rue, porte, repère (ex: près de la polyclinique)"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          className="h-10 text-sm"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon"
                          className="h-10 w-10 shrink-0 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                          onClick={handleLocate}
                          disabled={isLocating}
                          title="Utiliser ma position"
                        >
                          <MapPin className={`h-4 w-4 ${isLocating ? "animate-bounce" : ""}`} />
                        </Button>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-muted-foreground">
                    {t("booking.medical_instructions_optional", "Consignes ou antécédents médicaux pertinents (facultatif)")}
                  </label>
                  <Input
                    placeholder="Ex: Pansement post-opératoire, besoin de vérifier glycémie..."
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    className="h-10 text-sm"
                  />
                </div>
              </motion.div>
            )}

            {/* CONFIRMATION SUMMARY STEP (Direct Step 3 or Generic Step 5) */}
            {isConfirmStep && (
              <motion.div
                key="step-confirm"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                {isSuccess ? (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-14 h-14 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-sm">
                      <CheckCircle2 className="h-8 w-8" />
                    </div>
                    <h3 className="text-lg font-bold text-foreground">
                      {isRecurring ? "Série de soins programmée avec succès !" : "Demande envoyée avec succès !"}
                    </h3>
                    <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                      {t("booking.request_transmitted_to", "Votre demande a été transmise à")} <strong>{displayProviderName}</strong>. {t("booking.notification_on_acceptance", "Vous recevrez une notification dès son acceptation.")}
                    </p>
                  </div>
                ) : (
                  <>
                    <h3 className="font-semibold text-base">{t("booking.summary_title", "Récapitulatif de votre prise en charge")}</h3>
                    <div className="bg-muted/30 p-4 rounded-xl border border-border/50 text-left space-y-3 text-sm">
                      {selectedBeneficiary && (
                        <div className="flex items-center justify-between pb-2 border-b border-border/40 bg-teal-50/50 p-2 rounded-lg">
                          <span className="text-teal-800 text-xs font-semibold">{t("booking.beneficiary_label", "Bénéficiaire du soin")}</span>
                          <div className="flex items-center gap-1.5 font-semibold text-teal-900 text-xs">
                            <Heart className="h-3.5 w-3.5 text-teal-600" />
                            <span>{selectedBeneficiary.patient.name}</span>
                            <span className="text-teal-600 text-[11px]">
                              ({String(t(`circle.relationships.${selectedBeneficiary.relationship}` as any, selectedBeneficiary.relationship))})
                            </span>
                          </div>
                        </div>
                      )}

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.provider_label", "Soignant")}</span>
                        <div className="flex items-center gap-1.5 font-semibold text-foreground">
                          <UserCheck className="h-4 w-4 text-emerald-600" />
                          <span>{displayProviderName}</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.specialty_label", "Spécialité")}</span>
                        <span className="font-medium text-foreground text-xs">
                          {getLocalizedSpecialtyLabel(providerDetails?.specialty, i18n.language) || SPECIALTY_DISPLAY_BOOKING[providerDetails?.specialty || ""] || "Professionnel certifié"}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.service_label", "Prestation")}</span>
                        <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 font-semibold text-xs">
                          {getLocalizedServiceLabel(effectiveServiceName, i18n.language)}
                        </Badge>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.modality_label", "Modalité")}</span>
                        <span className="text-xs font-semibold">
                          {isRecurring ? t("booking.modality_recurring", { count: totalOccurrences, defaultValue: `Protocole récurrent (${totalOccurrences} séances)` }) : t("booking.modality_single", "Consultation ponctuelle")}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">
                          {isRecurring ? t("booking.first_session_date_time_label", "1ère séance & Heure") : t("booking.date_time_label", "Date & Heure")}
                        </span>
                        <span className="font-medium text-foreground">
                          {date} à {time} ({effectiveDuration} min)
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.intervention_zone_label", "Zone d'intervention")}</span>
                        <span className="font-semibold text-emerald-600 text-xs flex items-center gap-1">
                          <CheckCircle2 className="h-3.5 w-3.5" />
                          {selectedZone}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pb-2 border-b border-border/40">
                        <span className="text-muted-foreground text-xs">{t("booking.exact_address_label", "Adresse exacte")}</span>
                        <span className="font-medium text-foreground text-right truncate max-w-[220px] text-xs">
                          {address.trim()}
                        </span>
                      </div>

                      <div className="flex items-center justify-between pt-1">
                        <div>
                          <span className="text-muted-foreground text-xs">
                            {isRecurring ? t("booking.fee_unit_snapshot", "Tarif unitaire / séance (Snapshot)") : t("booking.fee_snapshot", "Honoraires de soin (Snapshot)")}
                          </span>
                          <p className="text-[10px] text-muted-foreground">{t("booking.cash_payment_home", "Paiement en espèces à domicile")}</p>
                        </div>
                        <div className="text-right">
                          <span className="text-lg font-bold text-primary">
                            {effectivePrice !== null ? `${effectivePrice} MRU` : "—"}
                          </span>
                          {isRecurring && effectivePrice !== null && (
                            <p className="text-[10px] text-muted-foreground">
                              Total estimé : {effectivePrice * totalOccurrences} MRU
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="p-3 bg-muted/40 rounded-xl text-xs text-muted-foreground flex items-center gap-2">
                      <Banknote className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        {t("booking.secure_cash_payment_notice", "Paiement sécurisé en espèces (Cash) remis au soignant à l'issue de chaque intervention.")}
                      </span>
                    </div>
                  </>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          <DialogFooter className="mt-6 flex items-center justify-between gap-3 sm:justify-between border-t border-border/40 pt-4">
            {step > 1 && !isSuccess ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleBack}
                disabled={isSubmitting}
                className="rounded-xl gap-1"
              >
                <ChevronLeft className="h-4 w-4 rtl:rotate-180" />
                <span>{t("common.back", "Retour")}</span>
              </Button>
            ) : (
              <div />
            )}

            {!isSuccess && (
              <>
                {!isConfirmStep ? (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleNext}
                    disabled={
                      (!isDirect && step === 1 && !specialty) ||
                      (!isDirect && step === 2 && !selectedProviderId) ||
                      (isServicesStep && (!selectedServiceId || !selectedServiceObj)) ||
                      (isDateTimeStep && (!date || !time || !address.trim() || !isZoneCompatible || availableSlotsData?.hasSchedule === false))
                    }
                    className="rounded-xl gap-1 shadow-md shadow-primary/20"
                  >
                    <span>{t("common.next", "Continuer")}</span>
                    <ChevronRight className="h-4 w-4 rtl:rotate-180" />
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleSubmit}
                    disabled={
                      isSubmitting ||
                      !date ||
                      !time ||
                      !address.trim() ||
                      !isZoneCompatible ||
                      !selectedServiceId ||
                      !selectedServiceObj ||
                      availableSlotsData?.hasSchedule === false
                    }
                    className="rounded-xl gap-1.5 shadow-md shadow-primary/20"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin" />
                        {t("booking.confirming_in_progress", "Confirmation en cours...")}
                      </>
                    ) : (
                      <>
                        <CheckCircle2 className="h-4 w-4" />
                        {t("booking.confirm_booking", "Confirmer la réservation")}
                      </>
                    )}
                  </Button>
                )}
              </>
            )}
          </DialogFooter>
        </div>
      </DialogContent>
    </Dialog>
  );
}
