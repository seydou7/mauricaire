import { useState } from "react";
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
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Phone,
  User,
  Heart,
  Plus,
  Trash2,
  Edit2,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Shield,
  Star,
} from "lucide-react";
import { toast } from "sonner";

const RELATIONSHIP_LABELS: Record<string, { fr: string; ar: string }> = {
  conjoint: { fr: "Conjoint(e) / Époux(se)", ar: "الزوج / الزوجة" },
  parent: { fr: "Père / Mère", ar: "الأب / الأم" },
  enfant: { fr: "Enfant", ar: "الابن / الابنة" },
  frere_soeur: { fr: "Frère / Sœur", ar: "الأخ / الأخت" },
  ami: { fr: "Ami(e) proche", ar: "صديق مقرب" },
  proche: { fr: "Proche aidant", ar: "قريب" },
  autre: { fr: "Autre relation", ar: "صلة أخرى" },
};

export function EmergencyContactTab() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const contacts = useQuery(api.emergencyContacts.getEmergencyContacts) || [];
  const saveContactMutation = useMutation(api.emergencyContacts.saveEmergencyContact);
  const deleteContactMutation = useMutation(api.emergencyContacts.deleteEmergencyContact);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<any>(null);

  // Form State
  const [fullName, setFullName] = useState("");
  const [relationship, setRelationship] = useState("proche");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [isPrimary, setIsPrimary] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Delete State
  const [deleteId, setDeleteId] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const openCreateDialog = () => {
    setEditingContact(null);
    setFullName("");
    setRelationship("proche");
    setPhone("");
    setEmail("");
    setNotes("");
    setIsPrimary(contacts.length === 0);
    setDialogOpen(true);
  };

  const openEditDialog = (c: any) => {
    setEditingContact(c);
    setFullName(c.fullName || "");
    setRelationship(c.relationship || "proche");
    setPhone(c.phone || "");
    setEmail(c.email || "");
    setNotes(c.notes || "");
    setIsPrimary(!!c.isPrimary);
    setDialogOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !phone.trim()) {
      toast.error("Le nom et le numéro de téléphone sont obligatoires.");
      return;
    }

    setIsSubmitting(true);
    try {
      await saveContactMutation({
        contactId: editingContact ? editingContact._id : undefined,
        fullName: fullName.trim(),
        relationship,
        phone: phone.trim(),
        email: email.trim() || undefined,
        notes: notes.trim() || undefined,
        isPrimary,
      });

      toast.success(
        editingContact
          ? "Contact d'urgence mis à jour avec succès."
          : "Nouveau contact d'urgence ajouté."
      );
      setDialogOpen(false);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement du contact.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (contactId: any) => {
    setIsDeleting(true);
    try {
      await deleteContactMutation({ contactId });
      toast.success("Contact d'urgence supprimé.");
      setDeleteId(null);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression.");
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="space-y-6" dir={isRtl ? "rtl" : "ltr"}>
      {/* Informative Header Card */}
      <div className="rounded-2xl bg-primary/5 border border-primary/15 p-5 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-start gap-3.5">
          <div className="h-11 w-11 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Heart className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {t("emergency.title", "Personne à prévenir en cas d'urgence")}
            </h3>
            <p className="text-xs text-muted-foreground mt-1 max-w-xl leading-relaxed">
              {t(
                "emergency.desc",
                "Indiquez les coordonnées d'un proche à contacter lors d'interventions de soins critiques. Ce contact n'a pas accès à votre dossier médical confidentiel."
              )}
            </p>
          </div>
        </div>

        <Button
          size="sm"
          onClick={openCreateDialog}
          className="rounded-xl text-xs gap-1.5 shrink-0 shadow-sm self-end sm:self-auto"
        >
          <Plus className="h-3.5 w-3.5" />
          {t("emergency.add_button", "Ajouter un contact")}
        </Button>
      </div>

      {/* Contacts List */}
      {contacts.length === 0 ? (
        <Card className="border-dashed border-border/70 p-8 text-center">
          <div className="h-12 w-12 rounded-2xl bg-muted/60 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
            <Phone className="h-6 w-6 text-primary/70" />
          </div>
          <h4 className="text-sm font-semibold text-foreground">
            {t("emergency.empty_title", "Aucun contact d'urgence renseigné")}
          </h4>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1 mb-4">
            {t(
              "emergency.empty_desc",
              "Pour votre sécurité lors des consultations à domicile, nous vous recommandons d'enregistrer au moins un numéro d'urgence."
            )}
          </p>
          <Button variant="outline" size="sm" onClick={openCreateDialog} className="rounded-xl text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            {t("emergency.add_button", "Ajouter un contact")}
          </Button>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {contacts.map((c: any) => {
            const relInfo = RELATIONSHIP_LABELS[c.relationship] || {
              fr: c.relationship,
              ar: c.relationship,
            };

            return (
              <Card
                key={c._id}
                className={`border-border/50 bg-card/80 backdrop-blur-sm shadow-sm relative overflow-hidden transition-all ${
                  c.isPrimary ? "ring-2 ring-primary/20 border-primary/30" : ""
                }`}
              >
                {c.isPrimary && (
                  <div className="bg-primary text-primary-foreground text-[10px] font-bold px-3 py-0.5 inline-flex items-center gap-1 rounded-br-lg absolute top-0 left-0">
                    <Star className="h-3 w-3 fill-current" />
                    {t("emergency.primary_badge", "Contact Principal")}
                  </div>
                )}

                <CardContent className={`p-5 space-y-3 ${c.isPrimary ? "pt-7" : ""}`}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                        {c.fullName}
                      </h4>
                      <Badge variant="secondary" className="text-[10px] mt-1 font-medium">
                        {isRtl ? relInfo.ar : relInfo.fr}
                      </Badge>
                    </div>

                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => openEditDialog(c)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-foreground"
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteId(c._id)}
                        className="h-8 w-8 p-0 rounded-lg text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-1.5 text-xs bg-muted/20 p-3 rounded-xl border border-border/30">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">{t("profile.direct_phone", "Téléphone direct")}</span>
                      <a href={`tel:${c.phone}`} className="font-semibold text-primary hover:underline">
                        {c.phone}
                      </a>
                    </div>
                    {c.email && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Email</span>
                        <span className="truncate max-w-[170px] text-foreground">{c.email}</span>
                      </div>
                    )}
                  </div>

                  {c.notes && (
                    <p className="text-[11px] text-muted-foreground italic border-t border-border/30 pt-2">
                      "{c.notes}"
                    </p>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add / Edit Contact Modal */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Heart className="h-4 w-4 text-primary" />
              {editingContact ? "Modifier le contact d'urgence" : "Ajouter une personne à prévenir"}
            </DialogTitle>
            <DialogDescription className="text-xs">
              Ces coordonnées seront communiquées aux soignants exclusivement en cas de nécessité médicale absolue.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSave} className="space-y-4 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t("profile.full_name_required", "Nom et prénom complet *")}</label>
              <input
                type="text"
                required
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ex: Aminetou Mint Vall"
                className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t("profile.relationship_required", "Lien de parenté ou relation *")}</label>
              <select
                value={relationship}
                onChange={(e) => setRelationship(e.target.value)}
                className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              >
                {Object.entries(RELATIONSHIP_LABELS).map(([k, v]) => (
                  <option key={k} value={k}>
                    {isRtl ? v.ar : v.fr}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t("profile.mobile_phone_required", "Numéro de téléphone portable *")}</label>
              <input
                type="tel"
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+222 45 00 00 00"
                className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t("profile.email_optional", "Adresse e-mail (facultative)")}</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="contact@exemple.mr"
                className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground">{t("profile.special_instructions", "Instructions ou remarques particulières")}</label>
              <textarea
                rows={2}
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Ex: Joignable de préférence le soir ou le week-end..."
                className="w-full p-2.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>

            <div className="flex items-center gap-2 pt-1">
              <input
                type="checkbox"
                id="isPrimaryCheckbox"
                checked={isPrimary}
                onChange={(e) => setIsPrimary(e.target.checked)}
                className="rounded border-border text-primary focus:ring-primary/20"
              />
              <label htmlFor="isPrimaryCheckbox" className="text-xs text-foreground cursor-pointer select-none">
                Définir comme contact d'urgence principal
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
              <Button type="submit" size="sm" disabled={isSubmitting} className="rounded-xl text-xs">
                {isSubmitting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
                Enregistrer
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Modal */}
      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent className="sm:max-w-sm bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="h-4 w-4" />
              Supprimer le contact d'urgence
            </DialogTitle>
            <DialogDescription className="text-xs">
              Êtes-vous sûr de vouloir supprimer cette personne de vos contacts d'urgence ?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 pt-2">
            <Button variant="ghost" size="sm" onClick={() => setDeleteId(null)} className="rounded-xl text-xs">
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              disabled={isDeleting}
              onClick={() => handleDelete(deleteId)}
              className="rounded-xl text-xs"
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirmer
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
