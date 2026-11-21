import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Shield,
  CheckCircle2,
  AlertCircle,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  Loader2,
  Upload,
  ArrowRight,
  ArrowLeft,
  Save,
  Check,
  AlertTriangle,
  FileCheck,
  Building,
  DollarSign,
  Languages,
  Calendar,
  Sparkles,
  Info,
  RefreshCw,
  Eye,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { sanitizeOnboardingError } from "@/lib/authValidation";

interface ProfessionalOnboardingProps {
  onSuccess?: () => void;
}

const MAURITANIAN_CITIES = [
  "Nouakchott",
  "Nouadhibou",
  "Rosso",
  "Kiffa",
  "Atar",
  "Kaédi",
  "Zouérate",
  "Néma",
];

const NOUAKCHOTT_MOUGATAA = [
  "Tevragh Zeina",
  "Ksar",
  "Sebkha",
  "El Mina",
  "Arafat",
  "Riyad",
  "Toujounine",
  "Dar Naim",
  "Teyarett",
];

const SPECIALTY_OPTIONS = [
  { value: "infirmier", labelFr: "Infirmier(ère) Diplômé(e)", labelAr: "ممرض / ممرضة معتمدة" },
  { value: "medecin_generaliste", labelFr: "Médecin Généraliste", labelAr: "طبيب عام" },
  { value: "kinesitherapeute", labelFr: "Kinésithérapeute", labelAr: "أخصائي علاج طبيعي" },
  { value: "sage_femme", labelFr: "Sage-Femme", labelAr: "قابلة قانونية" },
  { value: "aide_soignant", labelFr: "Aide-Soignant(e)", labelAr: "مساعد تمريض" },
  { value: "pediatre", labelFr: "Pédiatre", labelAr: "طبيب أطفال" },
  { value: "cardiologue", labelFr: "Cardiologue", labelAr: "طبيب قلب" },
];

export function ProfessionalOnboarding({ onSuccess }: ProfessionalOnboardingProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const dossier = useQuery(api.onboarding.getMyOnboardingDossier);
  const saveDraftMutation = useMutation(api.onboarding.saveOnboardingDraft);
  const generateUploadUrlMutation = useMutation(api.onboarding.generateDocumentUploadUrl);
  const saveDocumentMutation = useMutation(api.onboarding.saveProviderDocument);
  const submitDossierMutation = useMutation(api.onboarding.submitOnboardingDossier);

  const [currentStep, setCurrentStep] = useState<number>(1);
  const [isSavingDraft, setIsSavingDraft] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingDocType, setUploadingDocType] = useState<string | null>(null);
  const [step2Error, setStep2Error] = useState<string | null>(null);
  const [showMissingAlert, setShowMissingAlert] = useState(false);

  // Form State
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Nouakchott");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"homme" | "femme">("homme");

  // Step 2
  const [specialty, setSpecialty] = useState<any>("infirmier");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState(2);
  const [licenseNumber, setLicenseNumber] = useState("");
  const [bio, setBio] = useState("");

  // Step 4
  const [interventionZones, setInterventionZones] = useState<string[]>(["Tevragh Zeina", "Ksar"]);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [languages, setLanguages] = useState<string[]>(["Français", "Hassaniya"]);

  // Populating initial values from dossier when loaded
  useEffect(() => {
    if (dossier) {
      if (dossier.firstName) setFirstName(dossier.firstName);
      if (dossier.lastName) setLastName(dossier.lastName);
      if (dossier.phone) setPhone(dossier.phone);
      if (dossier.city) setCity(dossier.city);
      if (dossier.address) setAddress(dossier.address);
      if (dossier.birthDate) setBirthDate(dossier.birthDate);
      if (dossier.gender) setGender(dossier.gender);

      if (dossier.specialty) setSpecialty(dossier.specialty);
      if (dossier.professionalTitle) setProfessionalTitle(dossier.professionalTitle);
      if (dossier.yearsOfExperience !== undefined) setYearsOfExperience(dossier.yearsOfExperience);
      if (dossier.licenseNumber) setLicenseNumber(dossier.licenseNumber);
      if (dossier.bio) setBio(dossier.bio);

      if (dossier.interventionZones && dossier.interventionZones.length > 0) {
        setInterventionZones(dossier.interventionZones);
      }
      if (dossier.consultationFee !== undefined) setConsultationFee(dossier.consultationFee);
      if (dossier.languages && dossier.languages.length > 0) setLanguages(dossier.languages);
    }
  }, [dossier]);

  if (dossier === undefined) {
    return (
      <div className="py-20 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">Chargement de votre dossier d'onboarding...</p>
      </div>
    );
  }

  if (!dossier) {
    return (
      <div className="py-12 text-center text-muted-foreground text-sm">
        Aucun dossier d'accréditation trouvé pour ce compte.
      </div>
    );
  }

  const onboardingStatus = dossier?.onboardingStatus || "onboarding_incomplete";
  const identityDocs = (dossier?.documents || []).filter((d: any) => d.category === "identity");
  const proDocs = (dossier?.documents || []).filter((d: any) => d.category === "professional_proof");

  // Save draft action
  const handleSaveDraft = async (silent: boolean = false) => {
    setIsSavingDraft(true);
    try {
      await saveDraftMutation({
        firstName,
        lastName,
        phone,
        city,
        address,
        birthDate: birthDate || undefined,
        gender,
        specialty,
        professionalTitle,
        yearsOfExperience: Number(yearsOfExperience) || 0,
        licenseNumber,
        bio,
        interventionZones,
        consultationFee: Number(consultationFee) || 0,
        languages,
      });
      if (!silent) {
        toast.success(t("onboarding.draft_saved", "Brouillon sauvegardé avec succès."));
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la sauvegarde du brouillon.");
    } finally {
      setIsSavingDraft(false);
    }
  };

  // Document Upload
  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>,
    category: "identity" | "professional_proof",
    documentType: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 10 * 1024 * 1024) {
      toast.error("Le fichier est trop volumineux (maximum 10 Mo).");
      return;
    }

    setUploadingDocType(category);
    try {
      const uploadUrl = await generateUploadUrlMutation();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Échec du téléversement sur le stockage sécurisé.");
      const { storageId } = await res.json();

      await saveDocumentMutation({
        category,
        documentType,
        storageId,
        originalName: file.name,
        mimeType: file.type,
        size: file.size,
      });

      toast.success(
        category === "identity"
          ? "Pièce d'identité enregistrée avec succès."
          : "Justificatif professionnel enregistré avec succès."
      );
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement du document.");
    } finally {
      setUploadingDocType(null);
      e.target.value = "";
    }
  };

  // Canonical checklist calculation
  const getDossierChecklist = () => {
    const hasIdentity = identityDocs.length > 0;
    const hasProProof = proDocs.length > 0;

    const specialtyLabel =
      SPECIALTY_OPTIONS.find((s) => s.value === specialty)?.[isRtl ? "labelAr" : "labelFr"] ||
      specialty;

    return [
      {
        id: "personal",
        label: isRtl ? "المعلومات الشخصية والاتصال" : "Prénom, nom et coordonnées",
        step: 1,
        isComplete: Boolean(firstName.trim() && lastName.trim() && phone.trim()),
        completeText: `${firstName.trim()} ${lastName.trim()} • ${phone.trim()}`,
        incompleteDetail: isRtl
          ? "الاسم الأول، العائلي أو الهاتف غير مكتمل"
          : "Prénom, nom ou numéro de téléphone manquant",
      },
      {
        id: "specialty",
        label: isRtl ? "التخصص الطبي" : "Spécialité médicale",
        step: 2,
        isComplete: Boolean(specialty),
        completeText: specialtyLabel,
        incompleteDetail: isRtl ? "التخصص الطبي مطلوب" : "Spécialité médicale non sélectionnée",
      },
      {
        id: "license",
        label: isRtl ? "رقم الترخيص / الهيئة" : "Numéro de licence / ordre",
        step: 2,
        isComplete: Boolean(licenseNumber && licenseNumber.trim().length > 0),
        completeText: licenseNumber.trim(),
        incompleteDetail: isRtl ? "رقم الترخيص مطلوب" : "Numéro d'enregistrement ou de licence requis",
      },
      {
        id: "experience",
        label: isRtl ? "الخبرة المهنية" : "Expérience professionnelle",
        step: 2,
        isComplete:
          yearsOfExperience !== undefined &&
          yearsOfExperience !== null &&
          Number(yearsOfExperience) >= 0,
        completeText: `${yearsOfExperience} ${isRtl ? "سنوات خبرة" : "an(s) d'exercice"}`,
        incompleteDetail: isRtl ? "سنوات الخبرة مطلوبة" : "Nombre d'années d'expérience requis",
      },
      {
        id: "bio",
        label: isRtl ? "السيرة المهنية التعريفية" : "Biographie professionnelle",
        step: 2,
        isComplete: (bio || "").trim().length >= 30,
        completeText: `${(bio || "").trim().length} ${isRtl ? "حرفاً" : "caractères rédigés"}`,
        incompleteDetail: isRtl
          ? `30 حرفاً على الأقل (حالياً ${(bio || "").trim().length}/30)`
          : `Minimum 30 caractères requis (actuellement ${(bio || "").trim().length}/30)`,
      },
      {
        id: "identityDoc",
        label: isRtl ? "وثيقة الهوية الرسمية" : "Pièce d'identité officielle (CNI / Passeport)",
        step: 3,
        isComplete: hasIdentity,
        completeText:
          identityDocs[0]?.originalName || (isRtl ? "وثيقة الهوية متوفرة" : "Document téléversé"),
        incompleteDetail: isRtl
          ? "بطاقة الهوية أو جواز السفر إلزامي"
          : "Pièce justificative obligatoire manquante",
      },
      {
        id: "proProofDoc",
        label: isRtl ? "إثبات المؤهل المهني" : "Justificatif professionnel (Diplôme / Carte pro)",
        step: 3,
        isComplete: hasProProof,
        completeText:
          proDocs[0]?.originalName || (isRtl ? "إثبات المؤهل متوفر" : "Document téléversé"),
        incompleteDetail: isRtl
          ? "الشهادة أو البطاقة المهنية إلزامية"
          : "Attestation obligatoire manquante",
      },
      {
        id: "zones",
        label: isRtl ? "مناطق التدخل" : "Zones d'intervention",
        step: 4,
        isComplete: interventionZones.length > 0,
        completeText: `${interventionZones.length} ${isRtl ? "منطقة مختارة" : "zone(s) sélectionnée(s)"}`,
        incompleteDetail: isRtl
          ? "حدد منطقة تدخل واحدة على الأقل"
          : "Au moins 1 zone d'intervention requise",
      },
    ];
  };

  const getMissingDossierItems = () => {
    return getDossierChecklist().filter((item) => !item.isComplete);
  };

  // Submit Dossier
  const handleSubmitDossier = async () => {
    const missing = getMissingDossierItems();
    if (missing.length > 0) {
      setShowMissingAlert(true);
      toast.error(
        missing.length === 1
          ? `${missing[0].label} : ${missing[0].incompleteDetail}`
          : isRtl
          ? "الملف غير مكتمل. يرجى استكمال العناصر الموضحة."
          : "Votre dossier est incomplet. Veuillez compléter les éléments obligatoires indiqués."
      );
      return;
    }

    setIsSubmitting(true);
    try {
      // First save current inputs
      await handleSaveDraft(true);

      const res = await submitDossierMutation();
      toast.success(
        res.isResubmission
          ? isRtl
            ? "تمت إعادة إرسال الملف بنجاح."
            : "Votre dossier complété a été renvoyé avec succès."
          : isRtl
          ? "تم إرسال الملف للاعتماد بنجاح."
          : "Votre dossier a été soumis pour validation avec succès."
      );
      if (onSuccess) onSuccess();
    } catch (err: any) {
      const sanitized = sanitizeOnboardingError(err, t);
      toast.error(sanitized);
    } finally {
      setIsSubmitting(false);
    }
  };

  const toggleZone = (zone: string) => {
    if (interventionZones.includes(zone)) {
      if (interventionZones.length > 1) {
        setInterventionZones(interventionZones.filter((z) => z !== zone));
      } else {
        toast.error("Veuillez sélectionner au moins une zone d'intervention.");
      }
    } else {
      setInterventionZones([...interventionZones, zone]);
    }
  };

  const toggleLanguage = (lang: string) => {
    if (languages.includes(lang)) {
      if (languages.length > 1) {
        setLanguages(languages.filter((l) => l !== lang));
      }
    } else {
      setLanguages([...languages, lang]);
    }
  };

  // 1. Status View: APPROVED
  const isApproved =
    onboardingStatus === "approved" ||
    (!dossier?.onboardingStatus && Boolean(dossier?.verified) && dossier?.verificationStatus === "approved");

  if (isApproved) {
    return (
      <Card className="border-emerald-500/20 bg-emerald-500/[0.03] p-6 text-center shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 mb-2">
          {t("onboarding.status_approved", "Praticien Agréé & Vérifié")}
        </Badge>
        <h2 className="text-xl font-bold text-foreground">
          {t("onboarding.approved_title", "Félicitations, votre dossier a été validé !")}
        </h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto mt-2">
          {t(
            "onboarding.approved_desc",
            "Votre profil professionnel est désormais actif et visible par les patients mauritaniens dans le répertoire MauriCare."
          )}
        </p>
        <div className="mt-6 flex flex-wrap gap-3 justify-center">
          <Button variant="default" className="rounded-xl" onClick={onSuccess}>
            {t("onboarding.manage_availability", "Gérer mes consultations")}
          </Button>
        </div>
      </Card>
    );
  }

  // 2. Status View: SUBMITTED or UNDER_REVIEW (unless user clicked to re-edit complement)
  if (onboardingStatus === "submitted" || onboardingStatus === "under_review") {
    return (
      <Card className="border-primary/20 bg-primary/[0.02] p-6 sm:p-8 text-center shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4 animate-pulse">
          <Clock className="h-8 w-8" />
        </div>
        <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20 mb-2">
          {onboardingStatus === "under_review"
            ? t("onboarding.status_under_review", "Dossier en cours d'examen")
            : t("onboarding.status_submitted", "Dossier soumis — En attente")}
        </Badge>
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">
          {t("onboarding.in_review_title", "Votre dossier est entre les mains de notre équipe médicale")}
        </h2>
        <p className="text-xs sm:text-sm text-muted-foreground max-w-lg mx-auto mt-2 leading-relaxed">
          {t(
            "onboarding.in_review_desc",
            "Nos régulateurs vérifient l'authenticité de vos pièces justificatives et votre autorisation d'exercice. Vous recevrez une notification et un courriel dès que votre accréditation sera validée."
          )}
        </p>

        <div className="mt-6 max-w-md mx-auto bg-card rounded-2xl border border-border/50 p-4 text-left text-xs space-y-2">
          <div className="flex items-center justify-between pb-2 border-b border-border/30">
            <span className="text-muted-foreground">Numéro de licence déclaré</span>
            <span className="font-mono font-semibold">{dossier.licenseNumber}</span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-border/30">
            <span className="text-muted-foreground">Spécialité</span>
            <span className="font-medium capitalize">{dossier.specialty?.replace("_", " ")}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground">Pièces justificatives</span>
            <span className="font-medium text-emerald-600 flex items-center gap-1">
              <Check className="h-3 w-3" /> {(dossier.documents || []).length} document(s) sécurisé(s)
            </span>
          </div>
        </div>

        <p className="text-[11px] text-muted-foreground mt-4 italic">
          Temps moyen de vérification : sous 24 à 48 heures ouvrées.
        </p>
      </Card>
    );
  }

  // 3. Status View: REJECTED with reason
  if (onboardingStatus === "rejected") {
    return (
      <Card className="border-rose-500/20 bg-rose-500/[0.02] p-6 sm:p-8 text-center shadow-sm">
        <div className="h-14 w-14 rounded-2xl bg-rose-500/10 text-rose-600 flex items-center justify-center mx-auto mb-4">
          <AlertCircle className="h-8 w-8" />
        </div>
        <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-500/20 mb-2">
          {t("onboarding.status_rejected", "Dossier non validé")}
        </Badge>
        <h2 className="text-xl font-bold text-foreground">
          {t("onboarding.rejected_title", "Votre accréditation n'a pas pu être validée")}
        </h2>
        {dossier.rejectionReason && (
          <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs max-w-md mx-auto text-left">
            <span className="font-semibold block mb-1">Motif communiqué par l'administration :</span>
            <p className="leading-relaxed">{dossier.rejectionReason}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground max-w-md mx-auto mt-4">
          Si vous pensez qu'il s'agit d'une erreur ou si vous possédez de nouveaux documents, vous pouvez mettre à jour votre dossier ci-dessous et le renvoyer.
        </p>
        <div className="mt-6 flex justify-center">
          <Button
            variant="default"
            className="rounded-xl gap-2"
            onClick={() => setCurrentStep(1)}
          >
            <RefreshCw className="h-4 w-4" />
            Corriger mon dossier
          </Button>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      {/* Complement required banner if applicable */}
      {onboardingStatus === "complement_required" && (
        <div className="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/30 space-y-3">
          <div className="flex items-start gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-amber-900 dark:text-amber-300">
                {t("onboarding.complement_title", "Complément d'information requis par l'administration")}
              </h3>
              <p className="text-xs text-amber-800 dark:text-amber-400 leading-relaxed">
                Votre dossier a été examiné, mais certains éléments nécessitent une mise à jour avant validation.
              </p>
            </div>
          </div>

          {dossier.complementReasons && dossier.complementReasons.length > 0 && (
            <div className="bg-background/80 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1.5">
              <span className="font-semibold text-foreground block">Points à corriger :</span>
              <ul className="list-disc pl-4 space-y-1 text-muted-foreground">
                {dossier.complementReasons.map((r: string, idx: number) => (
                  <li key={idx} className="font-medium text-foreground">{r}</li>
                ))}
              </ul>
            </div>
          )}

          {dossier.adminComment && (
            <div className="bg-background/80 rounded-xl p-3 border border-amber-500/20 text-xs space-y-1">
              <span className="font-semibold text-foreground block">Instructions du régulateur :</span>
              <p className="text-muted-foreground italic">"{dossier.adminComment}"</p>
            </div>
          )}
        </div>
      )}

      {/* Stepper Header */}
      <Card className="border-border/50 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-semibold mb-1.5">
                <Shield className="h-3.5 w-3.5" />
                Dossier d'accréditation soignant
              </div>
              <CardTitle className="text-xl sm:text-2xl font-bold">
                {t("onboarding.wizard_title", "Validation de votre statut professionnel")}
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Complétez votre dossier en 5 étapes simples. Vous pouvez sauvegarder un brouillon à tout moment.
              </CardDescription>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={() => handleSaveDraft(false)}
              disabled={isSavingDraft}
              className="rounded-xl text-xs gap-1.5 self-start sm:self-auto border-border/50"
            >
              {isSavingDraft ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5" />}
              {t("onboarding.save_draft", "Sauvegarder le brouillon")}
            </Button>
          </div>

          {/* Stepper Indicators */}
          <div className="grid grid-cols-5 gap-2 pt-6">
            {[
              { num: 1, label: "Identité", icon: User },
              { num: 2, label: "Profession", icon: StethoscopeIcon },
              { num: 3, label: "Documents", icon: FileCheck },
              { num: 4, label: "Pratique", icon: MapPin },
              { num: 5, label: "Finalisation", icon: CheckCircle2 },
            ].map((step) => {
              const Icon = step.icon;
              const isDone = currentStep > step.num;
              const isCurrent = currentStep === step.num;

              return (
                <button
                  key={step.num}
                  type="button"
                  onClick={() => setCurrentStep(step.num)}
                  className={`flex flex-col items-center gap-1 text-center group cursor-pointer transition-all ${
                    isCurrent
                      ? "text-primary font-bold"
                      : isDone
                      ? "text-foreground"
                      : "text-muted-foreground opacity-60"
                  }`}
                >
                  <div
                    className={`h-9 w-9 rounded-xl flex items-center justify-center text-xs font-bold transition-all ${
                      isCurrent
                        ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 scale-105"
                        : isDone
                        ? "bg-emerald-500 text-white"
                        : "bg-muted text-muted-foreground group-hover:bg-muted/80"
                    }`}
                  >
                    {isDone ? <Check className="h-4 w-4" /> : step.num}
                  </div>
                  <span className="text-[11px] truncate max-w-[70px] hidden sm:inline">
                    {step.label}
                  </span>
                </button>
              );
            })}
          </div>
        </CardHeader>

        <CardContent className="pt-2">
          {/* STEP 1: Personal Info */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  Étape 1 : Informations personnelles
                </h3>
                <p className="text-xs text-muted-foreground">
                  Vos coordonnées d'identité civile telles qu'inscrites sur votre carte d'identité ou passeport.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Prénom *</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Ex: Mohamed"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Nom de famille *</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Ex: Ould Vall"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Numéro de téléphone portable *</label>
                  <input
                    type="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="Ex: +222 45 25 00 00"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Ville de résidence principale *</label>
                  <select
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {MAURITANIAN_CITIES.map((c) => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-semibold text-foreground">Adresse ou quartier de résidence</label>
                  <input
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="Ex: Tevragh Zeina, près de la Clinique Chiva"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Date de naissance</label>
                  <input
                    type="date"
                    value={birthDate}
                    onChange={(e) => setBirthDate(e.target.value)}
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Genre</label>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setGender("homme")}
                      className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-all ${
                        gender === "homme"
                          ? "bg-primary/10 border-primary text-primary font-bold"
                          : "border-border/50 hover:bg-muted"
                      }`}
                    >
                      Homme
                    </button>
                    <button
                      type="button"
                      onClick={() => setGender("femme")}
                      className={`flex-1 h-10 rounded-xl text-xs font-medium border transition-all ${
                        gender === "femme"
                          ? "bg-primary/10 border-primary text-primary font-bold"
                          : "border-border/50 hover:bg-muted"
                      }`}
                    >
                      Femme
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: Professional Info */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <StethoscopeIcon className="h-4 w-4 text-primary" />
                  Étape 2 : Profil professionnel & Spécialité
                </h3>
                <p className="text-xs text-muted-foreground">
                  Détaillez vos compétences médicales et votre numéro d'enregistrement officiel.
                </p>
              </div>

              {step2Error && (
                <div className="p-3.5 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{step2Error}</span>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Spécialité médicale canonique *</label>
                  <select
                    value={specialty}
                    onChange={(e) => {
                      setSpecialty(e.target.value);
                      if (step2Error) setStep2Error(null);
                    }}
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  >
                    {SPECIALTY_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>
                        {isRtl ? opt.labelAr : opt.labelFr}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Titre professionnel ou Fonction</label>
                  <input
                    type="text"
                    value={professionalTitle}
                    onChange={(e) => setProfessionalTitle(e.target.value)}
                    placeholder="Ex: Major de bloc / Infirmier d'État"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">
                    Numéro de licence / N° Ordre national *
                  </label>
                  <input
                    type="text"
                    value={licenseNumber}
                    onChange={(e) => {
                      setLicenseNumber(e.target.value);
                      if (step2Error && e.target.value.trim().length > 0) setStep2Error(null);
                    }}
                    placeholder="Ex: ONMM-2024-8842"
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="font-semibold text-foreground">Années d'expérience professionnelle *</label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={yearsOfExperience}
                    onChange={(e) => {
                      setYearsOfExperience(Number(e.target.value));
                      if (step2Error) setStep2Error(null);
                    }}
                    className="w-full h-10 px-3.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                </div>

                <div className="space-y-1.5 sm:col-span-2">
                  <label className="font-semibold text-foreground">
                    Biographie et présentation aux patients (minimum 30 caractères) *
                  </label>
                  <textarea
                    rows={4}
                    value={bio}
                    onChange={(e) => {
                      setBio(e.target.value);
                      if (step2Error && e.target.value.trim().length >= 30) setStep2Error(null);
                    }}
                    placeholder="Présentez votre parcours, vos diplômes et votre approche du soin à domicile ou en cabinet en Mauritanie..."
                    className="w-full p-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                  />
                  <div className="flex items-center justify-between text-[11px] pt-1">
                    <span className={bio.trim().length >= 30 ? "text-emerald-600 font-medium" : "text-amber-600 font-medium"}>
                      {bio.trim().length >= 30
                        ? "✓ Longueur requise atteinte (≥ 30 caractères)"
                        : `Encore ${Math.max(0, 30 - bio.trim().length)} caractère(s) requis`}
                    </span>
                    <span className="text-muted-foreground font-mono">
                      {bio.trim().length} / 30 caractères requis
                    </span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Documents Upload */}
          {currentStep === 3 && (
            <div className="space-y-5">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-primary" />
                  Étape 3 : Pièces justificatives & Confidentialité
                </h3>
                <p className="text-xs text-muted-foreground">
                  Vos documents sont stockés dans un espace de stockage chiffré et strictement accessible par vous et les régulateurs MauriCare.
                </p>
              </div>

              {/* Identity Document Section */}
              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      1. Pièce d'identité officielle (Obligatoire)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Carte Nationale d'Identité (CNI) mauritanienne ou passeport en cours de validité.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 self-start sm:self-auto">
                    PDF, JPEG ou PNG (max 10 Mo)
                  </Badge>
                </div>

                {identityDocs.length > 0 ? (
                  <div className="p-3 rounded-xl bg-card border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{identityDocs[0].originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Téléversé le {new Date(identityDocs[0].uploadedAt).toLocaleDateString()} • {(identityDocs[0].size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {identityDocs[0].url && (
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-primary gap-1">
                          <a href={identityDocs[0].url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5" /> Voir
                          </a>
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" asChild>
                          <span>Remplacer</span>
                        </Button>
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "identity", "cni")}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-border/80 rounded-xl p-5 text-center bg-card hover:bg-muted/10 transition-colors">
                    {uploadingDocType === "identity" ? (
                      <div className="py-2 flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Téléversement sécurisé en cours...</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          Cliquez pour téléverser votre CNI ou Passeport
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Glissez-déposez ou sélectionnez un fichier (PDF, JPG, PNG)
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "identity", "cni")}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>

              {/* Professional Proof Section */}
              <div className="p-4 rounded-2xl border border-border/60 bg-muted/20 space-y-3">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-bold flex items-center gap-2">
                      <FileText className="h-4 w-4 text-primary" />
                      2. Justificatif professionnel d'exercice (Obligatoire)
                    </h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Diplôme d'État de santé, carte professionnelle de l'Ordre ou autorisation d'exercer.
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20 self-start sm:self-auto">
                    PDF, JPEG ou PNG (max 10 Mo)
                  </Badge>
                </div>

                {proDocs.length > 0 ? (
                  <div className="p-3 rounded-xl bg-card border border-emerald-500/30 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-semibold truncate">{proDocs[0].originalName}</p>
                        <p className="text-[10px] text-muted-foreground">
                          Téléversé le {new Date(proDocs[0].uploadedAt).toLocaleDateString()} • {(proDocs[0].size / 1024 / 1024).toFixed(2)} Mo
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      {proDocs[0].url && (
                        <Button asChild size="sm" variant="ghost" className="h-8 text-xs text-primary gap-1">
                          <a href={proDocs[0].url} target="_blank" rel="noopener noreferrer">
                            <Eye className="h-3.5 w-3.5" /> Voir
                          </a>
                        </Button>
                      )}
                      <label className="cursor-pointer">
                        <Button size="sm" variant="outline" className="h-8 text-xs rounded-lg" asChild>
                          <span>Remplacer</span>
                        </Button>
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "professional_proof", "diplome")}
                        />
                      </label>
                    </div>
                  </div>
                ) : (
                  <div className="border border-dashed border-border/80 rounded-xl p-5 text-center bg-card hover:bg-muted/10 transition-colors">
                    {uploadingDocType === "professional_proof" ? (
                      <div className="py-2 flex flex-col items-center gap-2">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        <span className="text-xs text-muted-foreground">Téléversement sécurisé en cours...</span>
                      </div>
                    ) : (
                      <label className="cursor-pointer flex flex-col items-center gap-2">
                        <Upload className="h-6 w-6 text-muted-foreground" />
                        <span className="text-xs font-semibold text-foreground">
                          Cliquez pour téléverser votre diplôme ou carte professionnelle
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          Fichier officiel lisible requis pour validation administrative
                        </span>
                        <input
                          type="file"
                          accept=".pdf,image/jpeg,image/png,image/webp"
                          className="hidden"
                          onChange={(e) => handleFileUpload(e, "professional_proof", "diplome")}
                        />
                      </label>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: Practice & Pricing */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="border-b border-border/40 pb-3">
                <h3 className="text-base font-bold flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-primary" />
                  Étape 4 : Pratique, Tarifs & Zones d'intervention
                </h3>
                <p className="text-xs text-muted-foreground">
                  Indiquez les moughataas où vous vous déplacez et votre tarif indicatif de consultation.
                </p>
              </div>

              <div className="space-y-4 text-xs">
                <div className="space-y-2">
                  <label className="font-semibold text-foreground block">
                    Zones de déplacement & Moughataas couvertes *
                  </label>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                    {NOUAKCHOTT_MOUGATAA.map((zone) => {
                      const selected = interventionZones.includes(zone);
                      return (
                        <button
                          key={zone}
                          type="button"
                          onClick={() => toggleZone(zone)}
                          className={`h-9 px-3 rounded-xl border text-xs font-medium flex items-center justify-between transition-all ${
                            selected
                              ? "bg-primary/10 border-primary text-primary font-bold shadow-xs"
                              : "border-border/50 text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span>{zone}</span>
                          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Tarif indicatif de consultation (MRU)</label>
                    <div className="relative">
                      <input
                        type="number"
                        min="0"
                        step="50"
                        value={consultationFee}
                        onChange={(e) => setConsultationFee(Number(e.target.value))}
                        className="w-full h-10 px-3.5 pr-14 rounded-xl border border-border/50 bg-background text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
                      />
                      <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        MRU
                      </span>
                    </div>
                    <span className="text-[10px] text-muted-foreground">
                      Exemple : 500 MRU pour un soin infirmier standard
                    </span>
                  </div>

                  <div className="space-y-1.5">
                    <label className="font-semibold text-foreground">Langues parlées en consultation</label>
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {["Français", "Arabe standard", "Hassaniya", "Pulaar", "Soninké", "Wolof"].map((lang) => {
                        const selected = languages.includes(lang);
                        return (
                          <button
                            key={lang}
                            type="button"
                            onClick={() => toggleLanguage(lang)}
                            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                              selected
                                ? "bg-primary text-primary-foreground font-bold shadow-xs"
                                : "border-border/50 text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            {lang}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: Review & Submit */}
          {currentStep === 5 && (() => {
            const checklist = getDossierChecklist();
            const missingItems = getMissingDossierItems();
            const hasMissing = missingItems.length > 0;

            return (
              <div className="space-y-4">
                <div className="border-b border-border/40 pb-3">
                  <h3 className="text-base font-bold flex items-center gap-2">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                    Étape 5 : Récapitulatif avant soumission
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    Vérifiez attentivement les informations ci-dessous. Dès soumission, le dossier passera en revue administrative.
                  </p>
                </div>

                {/* Prominent Missing Items Alert */}
                {(hasMissing || showMissingAlert) && (
                  <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 space-y-3">
                    <div className="flex items-start gap-2.5">
                      <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-xs font-bold">
                          {isRtl
                            ? `عناصر إلزامية غير مكتملة (${missingItems.length})`
                            : `Éléments obligatoires manquants ou incomplets (${missingItems.length})`}
                        </h4>
                        <p className="text-[11px] text-amber-700 dark:text-amber-300 mt-0.5">
                          {isRtl
                            ? "يرجى استكمال الحقول المشار إليها أدناه قبل تقديم ملفك للاعتماد."
                            : "Votre dossier ne peut pas être soumis tant que ces éléments ne sont pas renseignés. Cliquez sur « Modifier » pour y accéder directement."}
                        </p>
                      </div>
                    </div>

                    <div className="space-y-1.5 pt-1 border-t border-amber-500/20">
                      {missingItems.map((item) => (
                        <div
                          key={item.id}
                          className="flex items-center justify-between text-xs py-1.5 px-2.5 rounded-lg bg-amber-500/5 hover:bg-amber-500/10 transition-colors"
                        >
                          <div className="flex items-center gap-2 min-w-0">
                            <X className="h-3.5 w-3.5 text-destructive shrink-0" />
                            <span className="font-semibold text-foreground truncate">{item.label} :</span>
                            <span className="text-[11px] text-muted-foreground truncate">{item.incompleteDetail}</span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentStep(item.step)}
                            className="h-6 px-2 text-[10px] text-primary hover:text-primary font-semibold gap-1 shrink-0"
                          >
                            Modifier
                            <ArrowRight className="h-3 w-3" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Validation Checklist - Accurate 8 Items */}
                <div className="p-4 rounded-2xl bg-muted/20 border border-border/40 space-y-3 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-foreground">
                      Contrôle de complétude du dossier ({checklist.filter((i) => i.isComplete).length} / {checklist.length}) :
                    </span>
                    {!hasMissing ? (
                      <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-[10px] gap-1">
                        <Check className="h-3 w-3" /> Dossier prêt
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-amber-600 bg-amber-500/10 border-amber-500/20 text-[10px] gap-1">
                        <AlertCircle className="h-3 w-3" /> {missingItems.length} élément(s) incomplet(s)
                      </Badge>
                    )}
                  </div>

                  <div className="divide-y divide-border/30">
                    {checklist.map((item) => (
                      <div key={item.id} className="py-2.5 flex items-center justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-foreground truncate">{item.label}</span>
                            <span className="text-[10px] text-muted-foreground">(Étape {item.step})</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground truncate mt-0.5">
                            {item.isComplete ? item.completeText : item.incompleteDetail}
                          </p>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {item.isComplete ? (
                            <Badge variant="outline" className="text-emerald-600 bg-emerald-500/10 border-emerald-500/20 text-[10px] gap-1">
                              <Check className="h-3 w-3" /> Complet
                            </Badge>
                          ) : (
                            <Badge variant="destructive" className="text-[10px] gap-1">
                              <X className="h-3 w-3" /> Incomplet
                            </Badge>
                          )}
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => setCurrentStep(item.step)}
                            className="h-7 px-2 text-[11px] text-muted-foreground hover:text-primary rounded-lg"
                          >
                            Modifier
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Legal confirmation */}
                <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
                  <span className="font-semibold text-foreground flex items-center gap-1.5">
                    <Shield className="h-3.5 w-3.5 text-primary" />
                    Engagement sur l'honneur
                  </span>
                  <p>
                    En soumettant ce dossier, vous certifiez sur l'honneur l'exactitude des informations fournies ainsi que l'authenticité de vos titres et autorisations d'exercice médical en République Islamique de Mauritanie.
                  </p>
                </div>
              </div>
            );
          })()}
        </CardContent>

        <CardFooter className="flex items-center justify-between pt-4 border-t border-border/40">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || isSubmitting}
            className="rounded-xl text-xs gap-1"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Précédent
          </Button>

          <div className="flex items-center gap-2">
            {currentStep < 5 ? (
              <Button
                variant="default"
                size="sm"
                onClick={async () => {
                  if (currentStep === 2) {
                    if (!specialty) {
                      setStep2Error("Veuillez sélectionner votre spécialité médicale canonique.");
                      return;
                    }
                    if (!licenseNumber || !licenseNumber.trim()) {
                      setStep2Error("Veuillez renseigner votre numéro de licence ou d'enregistrement officiel.");
                      return;
                    }
                    if (bio.trim().length < 30) {
                      setStep2Error(
                        `La biographie professionnelle doit comporter au moins 30 caractères (actuellement ${bio.trim().length}/30).`
                      );
                      return;
                    }
                    setStep2Error(null);
                  }
                  await handleSaveDraft(true);
                  setCurrentStep((prev) => Math.min(5, prev + 1));
                }}
                className="rounded-xl text-xs gap-1"
              >
                Suivant
                <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            ) : (
              <Button
                variant="default"
                size="sm"
                onClick={handleSubmitDossier}
                disabled={isSubmitting}
                className="rounded-xl text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
              >
                {isSubmitting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                {onboardingStatus === "complement_required"
                  ? "Renvoyer mon dossier complété"
                  : "Soumettre mon dossier"}
              </Button>
            )}
          </div>
        </CardFooter>
      </Card>
    </div>
  );
}

function StethoscopeIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
      <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
      <circle cx="20" cy="10" r="2" />
    </svg>
  );
}
