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
  Sparkles,
  Plus,
  Edit2,
  Trash2,
  CheckCircle2,
  Clock,
  Banknote,
  Loader2,
  AlertCircle,
  ShieldAlert,
} from "lucide-react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";

export function ProviderServicesTab() {
  const { t } = useTranslation();
  const data = useQuery(api.providerServices.getMyServices);
  const saveServiceMutation = useMutation(api.providerServices.saveService);
  const deleteServiceMutation = useMutation(api.providerServices.deleteService);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedService, setSelectedService] = useState<any>(null);

  // Form State
  const [canonicalServiceId, setCanonicalServiceId] = useState("");
  const [customLabel, setCustomLabel] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState<number>(500);
  const [duration, setDuration] = useState<number>(30);
  const [active, setActive] = useState<boolean>(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isApproved = data?.verified && data?.onboardingStatus === "approved";

  const openConfigDialog = (svc: any) => {
    setSelectedService(svc);
    setCanonicalServiceId(svc.canonicalId);
    setCustomLabel(svc.customLabel || svc.canonicalLabel);
    setDescription(svc.description || svc.canonicalDescription || "");
    setPrice(svc.price ?? svc.defaultMinPrice);
    setDuration(svc.duration ?? svc.defaultDuration);
    setActive(svc.isConfigured ? svc.active : true);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (price <= 0) {
      toast.error("Le tarif doit être supérieur à zéro.");
      return;
    }
    if (duration <= 0 || duration > 240) {
      toast.error("La durée doit être comprise entre 5 et 240 minutes.");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveServiceMutation({
        canonicalServiceId,
        customLabel: customLabel.trim() || undefined,
        description: description.trim() || undefined,
        price,
        duration,
        active,
      });

      toast.success("Prestation enregistrée avec succès.");
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement de la prestation.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (serviceId: any) => {
    if (!confirm("Voulez-vous retirer cette prestation de votre catalogue actif ?")) return;
    try {
      await deleteServiceMutation({ serviceId });
      toast.success("Prestation retirée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression.");
    }
  };

  if (data === undefined) {
    return (
      <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        Chargement de vos prestations médicales...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Catalogue de prestations & Honoraires
              </CardTitle>
              <CardDescription className="text-xs mt-1">
                Configurez les actes de soins que vous proposez aux patients à domicile avec vos tarifs en MRU et durées.
              </CardDescription>
            </div>
            {!isApproved && (
              <Badge variant="outline" className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-xs gap-1 py-1">
                <ShieldAlert className="h-3.5 w-3.5" />
                Activation réservée aux praticiens agréés
              </Badge>
            )}
          </div>
        </CardHeader>

        <CardContent>
          <div className="space-y-3">
            {data?.services.map((svc) => (
              <div
                key={svc.canonicalId}
                className={`p-4 rounded-xl border transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
                  svc.isConfigured && svc.active
                    ? "bg-primary/5 border-primary/20"
                    : "bg-muted/10 border-border/40 opacity-80"
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-sm text-foreground">
                      {svc.customLabel || svc.canonicalLabel}
                    </span>
                    {svc.isConfigured && svc.active ? (
                      <Badge className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20 text-[10px]">
                        Actif
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-muted-foreground text-[10px]">
                        Non publié
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground max-w-xl">
                    {svc.description || svc.canonicalDescription}
                  </p>
                  <div className="flex items-center gap-4 text-xs font-medium pt-1">
                    <span className="flex items-center gap-1 text-primary font-bold">
                      <Banknote className="h-3.5 w-3.5" />
                      {svc.price} MRU
                    </span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Clock className="h-3.5 w-3.5" />
                      {svc.duration} min
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    size="sm"
                    variant={svc.isConfigured ? "outline" : "default"}
                    onClick={() => openConfigDialog(svc)}
                    className="rounded-xl text-xs gap-1.5 h-8"
                  >
                    {svc.isConfigured ? (
                      <>
                        <Edit2 className="h-3.5 w-3.5" />
                        Modifier
                      </>
                    ) : (
                      <>
                        <Plus className="h-3.5 w-3.5" />
                        Configurer l'acte
                      </>
                    )}
                  </Button>
                  {svc.isConfigured && svc.serviceId && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(svc.serviceId)}
                      className="rounded-xl text-xs h-8 text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Dialog Ajout / Modification */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <form onSubmit={handleSave}>
            <DialogHeader>
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-primary" />
                Paramétrer la prestation
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                Définissez vos honoraires et la durée indicative d'intervention.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-3 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t("profile.act_title_required", "Intitulé de l'acte *")}</label>
                <Input
                  value={customLabel}
                  onChange={(e) => setCustomLabel(e.target.value)}
                  placeholder="Ex: Injection intramusculaire à domicile"
                  className="h-9 text-xs"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-semibold text-foreground">{t("profile.price_mru_required", "Tarif (MRU) *")}</label>
                  <Input
                    type="number"
                    min={50}
                    step={50}
                    value={price}
                    onChange={(e) => setPrice(Number(e.target.value))}
                    className="h-9 text-xs font-bold"
                    required
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-semibold text-foreground">{t("profile.duration_minutes_required", "Durée (minutes) *")}</label>
                  <Input
                    type="number"
                    min={5}
                    max={240}
                    step={5}
                    value={duration}
                    onChange={(e) => setDuration(Number(e.target.value))}
                    className="h-9 text-xs"
                    required
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-foreground">{t("profile.details_materials_included", "Précisions ou matériel inclus")}</label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Ex: Matériel stérile inclus, surveillance 15 min après injection..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-muted/40 p-2.5 rounded-xl border border-border/50">
                <input
                  type="checkbox"
                  checked={active}
                  onChange={(e) => setActive(e.target.checked)}
                  disabled={!isApproved}
                  className="accent-primary rounded"
                />
                <div>
                  <p className="font-semibold text-foreground">Publier dans mon catalogue actif</p>
                  <p className="text-[10px] text-muted-foreground">
                    Visible par les patients lors de la réservation en ligne
                  </p>
                </div>
              </label>
            </div>

            <DialogFooter className="gap-2 pt-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setDialogOpen(false)}
                className="rounded-xl text-xs"
              >
                Annuler
              </Button>
              <Button
                type="submit"
                size="sm"
                disabled={isSubmitting}
                className="rounded-xl text-xs"
              >
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enregistrer la prestation
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
