import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Calendar,
  Clock,
  MapPin,
  User,
  Stethoscope,
  FileText,
  CheckCircle2,
  XCircle,
  Loader2,
  AlertCircle,
  Banknote,
  ClipboardCheck,
  Star,
  Activity,
  HeartPulse,
  Thermometer,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ReviewModal } from "@/components/ReviewModal";
import { useTranslation } from "react-i18next";
import { getLocalizedServiceLabel, getLocalizedSpecialtyLabel, getLocalizedAppointmentNote } from "@/lib/services";

const SPECIALTY_LABELS: Record<string, string> = {
  infirmier: "Infirmier(ère) d'État",
  kine: "Kinésithérapeute",
  sage_femme: "Sage-femme diplômée",
  medecin: "Médecin à domicile",
  aide_soignant: "Aide-soignant(e)",
};

interface AppointmentDetailsModalProps {
  children: React.ReactNode;
  appointment: any;
  role: "patient" | "professionnel";
}

export function AppointmentDetailsModal({
  children,
  appointment,
  role,
}: AppointmentDetailsModalProps) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const [open, setOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Completion form state
  const [isCompleting, setIsCompleting] = useState(false);
  const [clinicalReport, setClinicalReport] = useState("");
  const [bloodPressure, setBloodPressure] = useState("");
  const [pulse, setPulse] = useState("");
  const [temperature, setTemperature] = useState("");

  const acceptMutation = useMutation(api.appointments.accept);
  const cancelMutation = useMutation(api.appointments.cancel);
  const completeMutation = useMutation(api.appointments.complete);

  const name = role === "patient" ? (appointment.name || appointment.providerName) : (appointment.patient || appointment.patientName);
  const date = appointment.date || appointment.day || "Aujourd'hui";
  const time = appointment.time;
  const status = appointment.status;
  const _type = appointment.type || appointment.serviceType || "Consultation";
  const localizedType = getLocalizedServiceLabel(appointment.serviceSnapshot?.name || appointment.serviceType || appointment.type, i18n.language) || (isRtl ? "استشارة" : "Consultation");
  const _duration = appointment.duration || "1h";
  const address = appointment.address || "Tevragh Zeina, Nouakchott";
  const notes = appointment.notes || appointment.message;
  const clinicalReportValue = appointment.clinicalReport;
  const appointmentId = appointment._id || appointment.id;
  const phone = appointment.phone || appointment.patientPhone || appointment.providerPhone || "";
  const rawSpecialty = appointment.specialty || appointment.serviceType || appointment.type;
  const specialtyLabel: string = rawSpecialty
    ? getLocalizedSpecialtyLabel(rawSpecialty, i18n.language) || String(t(`specialties.${rawSpecialty}`, SPECIALTY_LABELS[rawSpecialty] || rawSpecialty))
    : "";
  const cancellationReason = appointment.cancellationReason || appointment.cancelReason || "";
  const fee: number | undefined = appointment.fee ?? appointment.price ?? appointment.consultationFee ?? appointment.provider?.consultationFee;

  // Determine if appointment is in the future based on deterministic UTC timestamp
  const [currentTimestamp] = useState(() => Date.now());
  let isFuture = false;
  let formattedScheduledDateTime = "";
  if (appointment.date && appointment.time) {
    try {
      const [y, m, d] = appointment.date.split("-");
      const [hh, mm] = appointment.time.split(":");
      const scheduledTs = Date.UTC(parseInt(y, 10), parseInt(m, 10) - 1, parseInt(d, 10), parseInt(hh, 10), parseInt(mm, 10));
      isFuture = scheduledTs > currentTimestamp;
      formattedScheduledDateTime = `${d}/${m}/${y} à ${appointment.time}`;
    } catch {
      isFuture = false;
    }
  }

  const canCancel = (status === "en_attente" || status === "confirme") && appointmentId;
  const canAccept = status === "en_attente" && role === "professionnel" && appointmentId;
  const isConfirmedPro = status === "confirme" && role === "professionnel" && appointmentId;
  const canComplete = isConfirmedPro && !isFuture;
  const canReview = status === "termine" && role === "patient" && appointmentId;

  const existingReview = useQuery(
    api.reviews.getByAppointment,
    canReview ? { appointmentId } : "skip"
  );

  const sanitizeModalError = (err: unknown, fallback: string): string => {
    console.error("Modal mutation error:", err);
    if (err instanceof Error) {
      const msg = err.message || "";
      if (msg.includes("futur") || msg.includes("date et heure prévues") || msg.includes("scheduledTimestamp")) {
        return t("consultation.error_future", "Impossible de clôturer une consultation dont la date et l'heure prévues ne sont pas encore passées.");
      }
      if (msg.includes("Non authentifié") || msg.includes("Authentification requise")) {
        return t("common.unauthenticated", "Veuillez vous reconnecter.");
      }
      if (
        msg.includes("ServerError") ||
        msg.includes("Uncaught Error") ||
        msg.includes("Request ID") ||
        msg.includes("src/") ||
        msg.includes(".ts:") ||
        msg.includes("CONVEX")
      ) {
        return fallback;
      }
      if (msg.length > 0 && msg.length < 120) {
        return msg;
      }
    }
    return fallback;
  };

  const handleAccept = async () => {
    if (!appointmentId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await acceptMutation({ appointmentId });
      setOpen(false);
    } catch (err: any) {
      setErrorMsg(sanitizeModalError(err, "Impossible d'accepter le rendez-vous"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!appointmentId) return;
    setIsLoading(true);
    setErrorMsg(null);
    try {
      const reason = role === "professionnel" && status === "en_attente"
        ? "Refusé par le professionnel"
        : undefined;
      await cancelMutation({ appointmentId, reason });
      setOpen(false);
    } catch (err: any) {
      setErrorMsg(sanitizeModalError(err, "Impossible d'annuler le rendez-vous"));
    } finally {
      setIsLoading(false);
    }
  };

  const handleComplete = async () => {
    if (!appointmentId) return;
    if (!clinicalReport.trim()) {
      setErrorMsg("Veuillez saisir un compte-rendu clinique.");
      return;
    }

    setIsLoading(true);
    setErrorMsg(null);
    try {
      const pulseNum = pulse.trim() ? parseInt(pulse, 10) : undefined;
      const tempNum = temperature.trim() ? parseFloat(temperature.replace(",", ".")) : undefined;
      await completeMutation({
        appointmentId,
        clinicalReport: clinicalReport.trim(),
        vitals: {
          bloodPressure: bloodPressure.trim() || undefined,
          pulse: pulseNum && !isNaN(pulseNum) ? pulseNum : undefined,
          temperature: tempNum && !isNaN(tempNum) ? tempNum : undefined,
        },
      });
      setIsCompleting(false);
      setOpen(false);
    } catch (err: any) {
      setErrorMsg(sanitizeModalError(err, "Impossible de terminer la consultation"));
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
      case "confirme":
        return (
          <Badge variant="secondary" className="bg-emerald-500 text-white border-transparent">
            {t("appointments.status_confirmed", "Confirmé")}
          </Badge>
        );
      case "en_attente":
        return (
          <Badge variant="secondary" className="bg-amber-500 text-white border-transparent">
            {t("appointments.status_pending", "En attente")}
          </Badge>
        );
      case "termine":
        return (
          <Badge variant="secondary" className="bg-blue-600 text-white border-transparent">
            {t("appointments.status_completed", "Terminé")}
          </Badge>
        );
      case "annule":
        return (
          <Badge variant="secondary" className="bg-red-500 text-white border-transparent">
            {t("appointments.status_cancelled", "Annulé")}
          </Badge>
        );
      default:
        return (
          <Badge variant="secondary" className="bg-primary/20 text-primary border-primary/30">
            {status}
          </Badge>
        );
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setErrorMsg(null);
          setIsCompleting(false);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent
        dir={isRtl ? "rtl" : "ltr"}
        className="sm:max-w-[480px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl max-h-[90vh] overflow-y-auto"
      >
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white relative">
          <div className="absolute top-4 right-4">{getStatusBadge()}</div>

          <DialogHeader className="pt-2">
            <DialogTitle className="text-xl font-bold text-white flex flex-col gap-1">
              <span>{role === "patient" ? (isRtl ? "موعد رعاية" : "Rendez-vous de soin") : (isRtl ? "استشارة منزلية" : "Consultation à domicile")}</span>
              <span className="text-emerald-100 font-normal text-sm">{localizedType}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5">
          {errorMsg && (
            <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Key Details */}
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Calendar className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{isRtl ? "التاريخ" : "Date"}</p>
                <p className="text-xs font-semibold truncate">{date}</p>
              </div>
            </div>

            <div className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/40 border border-border/40">
              <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] text-muted-foreground uppercase font-medium">{isRtl ? "الوقت" : "Heure"}</p>
                <p className="text-xs font-semibold truncate">{time || "—"}</p>
              </div>
            </div>
          </div>

          {/* Participants */}
          <div className="space-y-3">
            <div className="flex items-start gap-3 p-3.5 rounded-xl bg-muted/30 border border-border/40">
              <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-xs shrink-0 mt-0.5">
                {role === "patient" ? <Stethoscope className="h-4 w-4" /> : <User className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-xs text-muted-foreground">
                  {role === "patient" ? (isRtl ? "المعالج" : "Professionnel de santé") : (isRtl ? "المريض" : "Patient suivi")}
                </p>
                <p className="text-sm font-semibold text-foreground">{name}</p>
                {specialtyLabel && role === "patient" && (
                  <p className="text-xs text-primary font-medium">{specialtyLabel}</p>
                )}
                {phone && (
                  <p className="text-xs text-muted-foreground mt-0.5">{phone}</p>
                )}
              </div>
            </div>

            {/* Address */}
            {address && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                  <MapPin className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{isRtl ? "عنوان التدخل المنزلي" : "Adresse d'intervention à domicile"}</p>
                  <p className="text-xs font-medium text-foreground">{address}</p>
                </div>
              </div>
            )}

            {/* Notes / Reason */}
            {notes && (
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border/30">
                <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center text-muted-foreground shrink-0 mt-0.5">
                  <FileText className="h-3.5 w-3.5" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-[11px] text-muted-foreground">{isRtl ? "سبب الحجز / ملاحظات" : "Motif / Notes de réservation"}</p>
                  <p className="text-xs font-medium text-muted-foreground italic" dir="auto">"{getLocalizedAppointmentNote(notes, i18n.language)}"</p>
                </div>
              </div>
            )}

            {/* Cancellation reason if cancelled */}
            {cancellationReason && status === "annule" && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-red-700 dark:text-red-400 text-xs">
                <span className="font-semibold">{isRtl ? "سبب الإلغاء : " : "Motif de l'annulation : "}</span>
                {cancellationReason}
              </div>
            )}

            {/* Fee */}
            <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs">
              <div className="flex items-center gap-2">
                <Banknote className="h-4 w-4 text-primary" />
                <span className="font-medium text-muted-foreground">{isRtl ? "طريقة الدفع" : "Mode de paiement"}</span>
              </div>
              <div className="text-right">
                <span className="font-bold text-foreground">
                  {fee !== undefined ? `${fee.toLocaleString()} MRU` : t("appointments.fee_not_specified", "Tarif non renseigné")}
                </span>
                <span className="text-[10px] text-muted-foreground block">{isRtl ? "نقدًا للمعالج" : "Espèces au soignant"}</span>
              </div>
            </div>

            {clinicalReportValue && (
              <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5">
                <div className="flex items-center gap-2 text-primary font-medium text-xs">
                  <ClipboardCheck className="h-4 w-4" />
                  {isRtl ? "التقرير السريري المعتمد" : "Compte-rendu clinique validé"}
                </div>
                <p className="text-xs text-foreground/90 whitespace-pre-wrap">{clinicalReportValue}</p>
              </div>
            )}
          </div>

          {/* Consultation Completion Form for Professional */}
          {isCompleting && (
            <div className="p-4 rounded-xl bg-muted/40 border border-border/60 space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <ClipboardCheck className="h-4 w-4 text-primary" />
                {t("consultation.complete_title", "Clôturer la consultation")}
              </div>
              <p className="text-xs text-muted-foreground">
                {t("consultation.complete_desc", "Rédigez le compte-rendu clinique pour le dossier médical du patient.")}
              </p>

              <div className="space-y-1.5">
                <label className="text-xs font-medium text-muted-foreground">
                  {t("consultation.clinical_report_label", "Compte-rendu clinique *")}
                </label>
                <Textarea
                  value={clinicalReport}
                  onChange={(e) => setClinicalReport(e.target.value)}
                  placeholder={t("consultation.clinical_report_placeholder", "Ex: Soins infirmiers effectués à domicile...")}
                  rows={3}
                  className="text-xs rounded-lg"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <HeartPulse className="h-3 w-3 text-rose-500" />
                    {t("consultation.bp_label", "Tension (ex: 12/8)")}
                  </label>
                  <Input
                    value={bloodPressure}
                    onChange={(e) => setBloodPressure(e.target.value)}
                    placeholder="12/8"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Activity className="h-3 w-3 text-amber-500" />
                    {t("consultation.pulse_label", "Pouls (bpm)")}
                  </label>
                  <Input
                    type="number"
                    value={pulse}
                    onChange={(e) => setPulse(e.target.value)}
                    placeholder="72"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[11px] font-medium text-muted-foreground flex items-center gap-1">
                    <Thermometer className="h-3 w-3 text-sky-500" />
                    {t("consultation.temp_label", "Temp (°C)")}
                  </label>
                  <Input
                    type="text"
                    value={temperature}
                    onChange={(e) => setTemperature(e.target.value)}
                    placeholder="37.0"
                    className="h-8 text-xs rounded-lg"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-1">
                <Button
                  size="sm"
                  onClick={handleComplete}
                  disabled={isLoading || !clinicalReport.trim()}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white text-xs gap-1.5"
                >
                  {isLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                  {t("consultation.validate_and_finish", "Valider et terminer")}
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setIsCompleting(false)}
                  disabled={isLoading}
                  className="text-xs"
                >
                  {t("consultation.cancel", "Annuler")}
                </Button>
              </div>
            </div>
          )}

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-1">
            {canAccept && (
              <Button
                onClick={handleAccept}
                disabled={isLoading}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {t("appointments.confirm_appointment", "Confirmer le rendez-vous")}
              </Button>
            )}

            {isConfirmedPro && isFuture && (
              <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-800 dark:text-amber-300 flex items-center gap-2.5">
                <Clock className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" />
                <span>
                  {t("consultation.closure_future_notice", "La consultation pourra être clôturée après le {{dateTime}}.", {
                    dateTime: formattedScheduledDateTime || `${date} à ${time}`,
                  })}
                </span>
              </div>
            )}

            {canComplete && !isCompleting && (
              <Button
                onClick={() => setIsCompleting(true)}
                className="w-full bg-emerald-600 hover:bg-emerald-700 text-white gap-2"
              >
                <ClipboardCheck className="h-4 w-4" />
                {t("consultation.complete_action", "Clôturer la consultation (compte-rendu)")}
              </Button>
            )}

            {canReview && (
              existingReview ? (
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-amber-700 font-medium">
                    <Star className="h-3.5 w-3.5 fill-amber-500 text-amber-500" />
                    {t("reviews.your_review", "Votre avis :")} {existingReview.rating}/5
                  </span>
                  <span className="text-muted-foreground italic truncate max-w-[200px]">
                    "{existingReview.comment || t("reviews.no_comment", "Aucun commentaire")}"
                  </span>
                </div>
              ) : (
                <ReviewModal
                  providerName={name}
                  appointmentId={appointmentId}
                  onSuccess={() => setOpen(false)}
                >
                  <Button className="w-full bg-amber-500 hover:bg-amber-600 text-white gap-2">
                    <Star className="h-4 w-4" />
                    {t("reviews.leave_review", "Laisser un avis sur ce soin")}
                  </Button>
                </ReviewModal>
              )
            )}

            {canCancel && !isCompleting && (
              <Button
                variant="outline"
                onClick={handleCancel}
                disabled={isLoading}
                className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
              >
                {isLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {role === "patient" ? t("appointments.cancel_appointment", "Annuler le rendez-vous") : status === "en_attente" ? t("appointments.refuse_appointment", "Refuser le rendez-vous") : t("appointments.cancel_appointment", "Annuler le rendez-vous")}
              </Button>
            )}

            {!canCancel && !canAccept && !canComplete && !canReview && (
              <Button
                variant="outline"
                onClick={() => setOpen(false)}
                className="w-full"
              >
                {t("common.close", "Fermer")}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
