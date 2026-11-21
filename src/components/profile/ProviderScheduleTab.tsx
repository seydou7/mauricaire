import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  Palmtree,
  CalendarOff,
  Loader2,
  CalendarDays,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

const DAY_LABELS: Record<number, { fr: string; ar: string }> = {
  1: { fr: "Lundi", ar: "الاثنين" },
  2: { fr: "Mardi", ar: "الثلاثاء" },
  3: { fr: "Mercredi", ar: "الأربعاء" },
  4: { fr: "Jeudi", ar: "الخميس" },
  5: { fr: "Vendredi", ar: "الجمعة" },
  6: { fr: "Samedi", ar: "السبت" },
  7: { fr: "Dimanche", ar: "الأحد" },
};

export function ProviderScheduleTab() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const settings = useQuery(api.availability.getMyAvailabilitySettings);
  const saveScheduleMutation = useMutation(api.availability.saveWeeklySchedule);
  const saveExceptionMutation = useMutation(api.availability.saveDateException);
  const deleteExceptionMutation = useMutation(api.availability.deleteDateException);
  const saveLeaveMutation = useMutation(api.availability.saveLeave);
  const deleteLeaveMutation = useMutation(api.availability.deleteLeave);

  // Weekly Schedule State
  const [weeklySchedule, setWeeklySchedule] = useState<any[]>([]);
  const [leadTimeMinutes, setLeadTimeMinutes] = useState<number>(60);
  const [isSavingSchedule, setIsSavingSchedule] = useState(false);

  // Sync state when query resolves
  const [isInitialized, setIsInitialized] = useState(false);
  if (settings && !isInitialized) {
    setWeeklySchedule(settings.weeklySchedule);
    setLeadTimeMinutes(settings.leadTimeMinutes || 60);
    setIsInitialized(true);
  }

  // Modals State
  const [leaveModalOpen, setLeaveModalOpen] = useState(false);
  const [leaveStartDate, setLeaveStartDate] = useState("");
  const [leaveEndDate, setLeaveEndDate] = useState("");
  const [leaveReason, setLeaveReason] = useState("");
  const [isSubmittingLeave, setIsSubmittingLeave] = useState(false);

  const [exceptionModalOpen, setExceptionModalOpen] = useState(false);
  const [exceptionDate, setExceptionDate] = useState("");
  const [exceptionUnavailable, setExceptionUnavailable] = useState(true);
  const [exceptionReason, setExceptionReason] = useState("");
  const [isSubmittingException, setIsSubmittingException] = useState(false);

  const handleToggleDay = (dayIndex: number) => {
    const updated = [...weeklySchedule];
    updated[dayIndex].enabled = !updated[dayIndex].enabled;
    if (updated[dayIndex].enabled && updated[dayIndex].periods.length === 0) {
      updated[dayIndex].periods = [{ start: "08:30", end: "16:30" }];
    }
    setWeeklySchedule(updated);
  };

  const handlePeriodChange = (dayIndex: number, periodIndex: number, field: "start" | "end", val: string) => {
    const updated = [...weeklySchedule];
    updated[dayIndex].periods[periodIndex][field] = val;
    setWeeklySchedule(updated);
  };

  const handleAddPeriod = (dayIndex: number) => {
    const updated = [...weeklySchedule];
    updated[dayIndex].periods.push({ start: "14:30", end: "18:00" });
    setWeeklySchedule(updated);
  };

  const handleRemovePeriod = (dayIndex: number, periodIndex: number) => {
    const updated = [...weeklySchedule];
    updated[dayIndex].periods.splice(periodIndex, 1);
    if (updated[dayIndex].periods.length === 0) {
      updated[dayIndex].enabled = false;
    }
    setWeeklySchedule(updated);
  };

  const handleSaveWeeklySchedule = async () => {
    setIsSavingSchedule(true);
    try {
      await saveScheduleMutation({
        weeklySchedule,
        leadTimeMinutes,
      });
      toast.success("Horaires hebdomadaires enregistrés avec succès.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la sauvegarde des horaires.");
    } finally {
      setIsSavingSchedule(false);
    }
  };

  const handleSaveLeave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!leaveStartDate || !leaveEndDate) {
      toast.error("Veuillez renseigner les dates de début et de fin.");
      return;
    }
    if (leaveStartDate > leaveEndDate) {
      toast.error("La date de début doit être antérieure à la date de fin.");
      return;
    }

    setIsSubmittingLeave(true);
    try {
      const res = await saveLeaveMutation({
        startDate: leaveStartDate,
        endDate: leaveEndDate,
        reason: leaveReason.trim() || undefined,
      });

      if (res.hasConflicts) {
        toast.warning(
          `Congé enregistré. Attention : ${res.conflictCount} consultation(s) déjà planifiée(s) sur cette période nécessitent votre attention.`
        );
      } else {
        toast.success("Période de congé enregistrée avec succès.");
      }
      setLeaveModalOpen(false);
      setLeaveStartDate("");
      setLeaveEndDate("");
      setLeaveReason("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement du congé.");
    } finally {
      setIsSubmittingLeave(false);
    }
  };

  const handleDeleteLeave = async (leaveId: any) => {
    try {
      await deleteLeaveMutation({ leaveId });
      toast.success("Période de congé supprimée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression.");
    }
  };

  const handleSaveException = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!exceptionDate) {
      toast.error("Veuillez sélectionner une date.");
      return;
    }

    setIsSubmittingException(true);
    try {
      await saveExceptionMutation({
        date: exceptionDate,
        isUnavailable: exceptionUnavailable,
        reason: exceptionReason.trim() || undefined,
      });
      toast.success("Exception de planning enregistrée.");
      setExceptionModalOpen(false);
      setExceptionDate("");
      setExceptionReason("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement.");
    } finally {
      setIsSubmittingException(false);
    }
  };

  const handleDeleteException = async (exceptionId: any) => {
    try {
      await deleteExceptionMutation({ exceptionId });
      toast.success("Exception supprimée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression.");
    }
  };

  if (!settings) {
    return (
      <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Chargement de vos disponibilités...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Horaires hebdomadaires */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="h-5 w-5 text-primary" />
                Horaires d'intervention hebdomadaires
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Définissez vos plages de travail régulières pour chaque jour de la semaine. Les créneaux de réservation s'adaptent automatiquement à ces plages.
              </CardDescription>
            </div>
            <Button
              size="sm"
              onClick={handleSaveWeeklySchedule}
              disabled={isSavingSchedule}
              className="rounded-xl text-xs gap-1.5 h-8 shrink-0"
            >
              {isSavingSchedule ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              Enregistrer mes horaires
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-3">
          <div className="space-y-2">
            {weeklySchedule.map((day, dIdx) => (
              <div
                key={day.dayOfWeek}
                className={`p-3 rounded-xl border transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 ${
                  day.enabled ? "bg-card border-border/60" : "bg-muted/15 border-border/30 opacity-60"
                }`}
              >
                <div className="flex items-center gap-3 w-36">
                  <input
                    type="checkbox"
                    checked={day.enabled}
                    onChange={() => handleToggleDay(dIdx)}
                    className="accent-primary rounded"
                  />
                  <span className={`text-xs font-semibold ${day.enabled ? "text-foreground" : "text-muted-foreground"}`}>
                    {isRtl ? DAY_LABELS[day.dayOfWeek]?.ar : DAY_LABELS[day.dayOfWeek]?.fr}
                  </span>
                </div>

                <div className="flex-1 space-y-1.5">
                  {day.enabled ? (
                    <div className="flex flex-wrap items-center gap-2">
                      {day.periods.map((p: any, pIdx: number) => (
                        <div key={pIdx} className="flex items-center gap-1.5 bg-muted/40 px-2.5 py-1 rounded-lg border border-border/40 text-xs">
                          <input
                            type="time"
                            value={p.start}
                            onChange={(e) => handlePeriodChange(dIdx, pIdx, "start", e.target.value)}
                            className="bg-transparent font-mono text-xs font-bold focus:outline-none"
                          />
                          <span className="text-muted-foreground text-[10px]">→</span>
                          <input
                            type="time"
                            value={p.end}
                            onChange={(e) => handlePeriodChange(dIdx, pIdx, "end", e.target.value)}
                            className="bg-transparent font-mono text-xs font-bold focus:outline-none"
                          />
                          <button
                            type="button"
                            onClick={() => handleRemovePeriod(dIdx, pIdx)}
                            className="text-muted-foreground hover:text-destructive ml-1"
                          >
                            ×
                          </button>
                        </div>
                      ))}

                      {day.periods.length < 3 && (
                        <button
                          type="button"
                          onClick={() => handleAddPeriod(dIdx)}
                          className="text-xs text-primary hover:underline font-medium flex items-center gap-1 px-2 py-1"
                        >
                          <Plus className="h-3 w-3" />
                          Ajouter une plage
                        </button>
                      )}
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground italic">{t("profile.closed_unavailable", "Fermé / Indisponible")}</span>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="pt-2 flex items-center justify-between border-t border-border/40 text-xs">
            <span className="text-muted-foreground font-medium">{t("profile.min_notice_label", "Délai minimum de préavis avant réservation :")}</span>
            <select
              value={leadTimeMinutes}
              onChange={(e) => setLeadTimeMinutes(Number(e.target.value))}
              className="h-8 px-2 rounded-lg border border-border/50 bg-background text-xs font-bold"
            >
              <option value={30}>30 minutes</option>
              <option value={60}>{t("profile.notice_1_hour", "1 heure (recommandé)")}</option>
              <option value={120}>2 heures</option>
              <option value={240}>4 heures</option>
              <option value={1440}>{t("profile.notice_24_hours", "24 heures à l'avance")}</option>
            </select>
          </div>
        </CardContent>
      </Card>

      {/* Congés & Indisponibilités exceptionnelles */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Périodes de congés */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <Palmtree className="h-4 w-4 text-primary" />
                Périodes de congés
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setLeaveModalOpen(true)}
                className="rounded-xl text-xs h-7 gap-1"
              >
                <Plus className="h-3 w-3" />
                Déclarer un congé
              </Button>
            </div>
            <CardDescription className="text-xs">
              Bloque automatiquement les réservations sur toute la période sans annuler vos rendez-vous confirmés existants.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {settings.leaves.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed rounded-xl">
                Aucun congé programmé.
              </p>
            ) : (
              settings.leaves.map((l) => (
                <div key={l._id} className="p-2.5 rounded-xl border border-border/40 bg-muted/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground">
                      Du {l.startDate} au {l.endDate}
                    </span>
                    {l.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{l.reason}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteLeave(l._id)}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        {/* Exceptions de date */}
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-bold flex items-center gap-2">
                <CalendarOff className="h-4 w-4 text-primary" />
                Exceptions ponctuelles
              </CardTitle>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setExceptionModalOpen(true)}
                className="rounded-xl text-xs h-7 gap-1"
              >
                <Plus className="h-3 w-3" />
                Ajouter une date
              </Button>
            </div>
            <CardDescription className="text-xs">
              Indisponibilité ponctuelle pour une journée spécifique (rendez-vous personnel, imprévu).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-2">
            {settings.exceptions.length === 0 ? (
              <p className="text-xs text-muted-foreground italic py-3 text-center border border-dashed rounded-xl">
                Aucune exception de date enregistrée.
              </p>
            ) : (
              settings.exceptions.map((e) => (
                <div key={e._id} className="p-2.5 rounded-xl border border-border/40 bg-muted/20 flex items-center justify-between text-xs">
                  <div>
                    <span className="font-semibold text-foreground">{e.date}</span>
                    <Badge variant="secondary" className="ml-2 text-[10px] bg-destructive/10 text-destructive">
                      Indisponible
                    </Badge>
                    {e.reason && <p className="text-[11px] text-muted-foreground mt-0.5">{e.reason}</p>}
                  </div>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => handleDeleteException(e._id)}
                    className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      {/* Modal Congé */}
      <Dialog open={leaveModalOpen} onOpenChange={setLeaveModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <form onSubmit={handleSaveLeave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Palmtree className="h-5 w-5 text-primary" />
                Déclarer une période de congé
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Les patients ne pourront plus réserver de créneaux sur cette période.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">{t("profile.start_date_required", "Date de début *")}</label>
                  <Input
                    type="date"
                    value={leaveStartDate}
                    min={new Date().toISOString().split("T")[0]}
                    onChange={(e) => setLeaveStartDate(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">{t("profile.end_date_required", "Date de fin *")}</label>
                  <Input
                    type="date"
                    value={leaveEndDate}
                    min={leaveStartDate || new Date().toISOString().split("T")[0]}
                    onChange={(e) => setLeaveEndDate(e.target.value)}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t("profile.reason_optional", "Motif ou précision (facultatif)")}</label>
                <Input
                  value={leaveReason}
                  onChange={(e) => setLeaveReason(e.target.value)}
                  placeholder="Ex: Congés annuels, formation médicale..."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setLeaveModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingLeave}
                className="rounded-xl text-xs"
              >
                {isSubmittingLeave ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Valider la période
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal Exception */}
      <Dialog open={exceptionModalOpen} onOpenChange={setExceptionModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <form onSubmit={handleSaveException}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <CalendarOff className="h-5 w-5 text-primary" />
                Ajouter une exception de date
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Marquer une journée précise comme non travaillée.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">Date de l'exception *</label>
                <Input
                  type="date"
                  value={exceptionDate}
                  min={new Date().toISOString().split("T")[0]}
                  onChange={(e) => setExceptionDate(e.target.value)}
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">Motif (facultatif)</label>
                <Input
                  value={exceptionReason}
                  onChange={(e) => setExceptionReason(e.target.value)}
                  placeholder="Ex: Absence imprévue, garde hospitalière..."
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setExceptionModalOpen(false)}
                className="rounded-xl text-xs"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmittingException}
                className="rounded-xl text-xs"
              >
                {isSubmittingException ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enregistrer l'exception
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
