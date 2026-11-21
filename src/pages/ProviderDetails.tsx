import { useParams, useNavigate } from "react-router";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { BookingStepper } from "@/components/BookingStepper";
import { NewMessageModal } from "@/components/NewMessageModal";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  ArrowLeft,
  Star,
  MapPin,
  Calendar,
  Clock,
  CheckCircle2,
  MessageCircle,
  Loader2,
  AlertCircle,
  Phone,
  Award,
  Languages,
  Sparkles,
  Heart,
} from "lucide-react";
import { useMutation } from "convex/react";
import { toast } from "sonner";
import { getLocalizedServiceLabel, getLocalizedSpecialtyLabel } from "@/lib/services";

const SPECIALTY_LABELS: Record<string, string> = {
  infirmier: "Infirmier(ère) d'État",
  aide_soignant: "Aide-soignant(e)",
  medecin: "Médecin généraliste",
  kinestherapeute: "Kinésithérapeute",
};

export default function ProviderDetails() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  // Validate Convex Id format before querying
  const isValidId = Boolean(id && typeof id === "string" && id.length >= 20 && /^[a-zA-Z0-9_-]+$/.test(id));

  const provider = useQuery(
    api.providers.getById,
    isValidId ? { id: id as Id<"providers"> } : "skip"
  );

  const reviewsList = useQuery(
    api.reviews.getByProvider,
    isValidId ? { providerId: id as Id<"providers"> } : "skip"
  );

  const isFav = useQuery(
    api.favorites.isFavorite,
    isValidId ? { providerId: id as Id<"providers"> } : "skip"
  );
  const toggleFavoriteMutation = useMutation(api.favorites.toggleFavorite);

  const handleToggleFavorite = async () => {
    if (!isValidId) return;
    try {
      const res = await toggleFavoriteMutation({ providerId: id as Id<"providers"> });
      toast.success(res.isFavorite ? t("caregivers.add_favorite", "Ajouté à vos favoris.") : t("caregivers.remove_favorite", "Retiré de vos favoris."));
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour des favoris.");
    }
  };

  // Invalid ID format
  if (!isValidId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border-border/40 text-center p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-destructive/10 flex items-center justify-center mb-4 text-destructive">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("providers.invalid_id_title", "Identifiant de soignant invalide")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("providers.invalid_id_desc", "Le lien fourni ne correspond pas à un professionnel de santé valide sur MauriCare.")}
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("providers.back_to_caregivers", "Retour aux soignants")}
          </Button>
        </Card>
      </div>
    );
  }

  // Loading state
  if (provider === undefined) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center" dir={isRtl ? "rtl" : "ltr"}>
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
          <p className="text-sm text-muted-foreground">{t("providers.loading_profile", "Chargement du profil soignant...")}</p>
        </div>
      </div>
    );
  }

  // Provider not found or unverified/hidden
  if (provider === null) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border-border/40 text-center p-8">
          <div className="mx-auto w-12 h-12 rounded-full bg-amber-500/10 flex items-center justify-center mb-4 text-amber-600">
            <AlertCircle className="w-6 h-6" />
          </div>
          <h2 className="text-xl font-bold mb-2">{t("providers.not_found_profile_title", "Professionnel introuvable")}</h2>
          <p className="text-sm text-muted-foreground mb-6">
            {t("providers.not_found_profile_desc", "Ce profil de soignant n'existe pas ou n'est plus disponible actuellement.")}
          </p>
          <Button onClick={() => navigate("/dashboard")} className="w-full">
            <ArrowLeft className={`w-4 h-4 ${isRtl ? "ml-2" : "mr-2"}`} />
            {t("providers.back_to_caregivers", "Retour aux soignants")}
          </Button>
        </Card>
      </div>
    );
  }

  const name = provider.user?.name || t("roles.professionnel", "Professionnel de santé");
  const specialtyLabel = getLocalizedSpecialtyLabel(provider.specialty, i18n.language) || t("specialties." + provider.specialty, SPECIALTY_LABELS[provider.specialty] || provider.specialty);
  const price = provider.consultationFee !== undefined ? `${provider.consultationFee} MRU` : t("appointments.fee_not_specified", "Tarif non renseigné");
  const rating = provider.rating ?? 5.0;
  const reviewCount = provider.reviewCount ?? 0;
  const city = provider.city || provider.user?.city || "Nouakchott";
  const bio = provider.bio || "Professionnel de santé certifié disponible pour des consultations et soins à domicile à Nouakchott.";

  const phone = provider.user?.phone || null;
  const initials = name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="min-h-screen bg-background pb-24" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header / Bannière */}
      <div className="relative h-48 bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center p-6">
        <Button
          variant="ghost"
          size="icon"
          className={`absolute top-4 ${isRtl ? "right-4" : "left-4"} text-white hover:bg-white/20 hover:text-white rounded-full z-10`}
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column (Info Principale) */}
          <div className="flex-1 space-y-6">
            {/* Profil Card */}
            <Card className="border-border/40 shadow-xl shadow-primary/5 bg-card/95 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="h-28 w-28 rounded-full border-4 border-background shadow-lg overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center text-2xl font-bold text-primary">
                    {provider.user?.image ? (
                      <img src={provider.user.image} alt={name} className="h-full w-full object-cover" />
                    ) : (
                      initials
                    )}
                  </div>
                  <div className={`text-center sm:text-${isRtl ? "right" : "left"} flex-1 mt-2 sm:mt-0`}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h1 className="text-2xl font-bold">{name}</h1>
                      <div className="flex items-center gap-2 justify-center sm:justify-start">
                        <button
                          onClick={handleToggleFavorite}
                          className="p-1.5 rounded-full hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
                          title={isFav ? t("caregivers.remove_favorite", "Retirer des favoris") : t("caregivers.add_favorite", "Ajouter aux favoris")}
                        >
                          <Heart className={`h-5 w-5 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                        </button>
                        <Badge variant="secondary" className="w-fit mx-auto sm:mx-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                          {price}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-primary font-medium mb-3">{specialtyLabel}</p>

                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-foreground">{rating.toFixed(1)}</span>
                        <span>({reviewCount} {t("dashboard.reviews", "avis")})</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{city}, Mauritanie</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold mb-2">{t("providers.about", "À propos")}</h3>
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {bio}
                    </p>
                  </div>

                  {/* Credentials & Details */}
                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                      <Award className="w-4 h-4 text-primary shrink-0" />
                      <span>{t("providers.license_prefix", "Licence: ")}<strong className="text-foreground">{provider.licenseNumber}</strong></span>
                    </div>
                    {provider.yearsOfExperience !== undefined && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                        <span>{t("providers.experience_prefix", "Expérience: ")}<strong className="text-foreground">{provider.yearsOfExperience} {t("dashboard.years_old", "ans")}</strong></span>
                      </div>
                    )}
                    {provider.languages && provider.languages.length > 0 && (
                      <div className="flex items-center gap-2.5 text-xs text-muted-foreground bg-muted/30 p-2.5 rounded-lg sm:col-span-2">
                        <Languages className="w-4 h-4 text-primary shrink-0" />
                        <span>{t("providers.languages_prefix", "Langues parlées: ")}<strong className="text-foreground">{provider.languages.join(", ")}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Prestations de Soins Proposées */}
            <Card className="border-border/40 shadow-md">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  {t("profile.tabs.services", "Prestations & Soins")}
                </h3>
                {provider.services && provider.services.length > 0 ? (
                  <div className="space-y-2.5">
                    {provider.services.map((svc: any) => (
                      <div
                        key={svc._id}
                        className="p-3 rounded-xl bg-muted/20 border border-border/40 flex items-center justify-between gap-3 text-xs"
                      >
                        <div>
                          <p className="font-semibold text-foreground text-sm">{svc.titleAr && isRtl ? svc.titleAr : getLocalizedServiceLabel(svc.title, i18n.language)}</p>
                          {(svc.description || svc.descriptionAr) && (
                            <p className="text-muted-foreground mt-0.5">{svc.descriptionAr && isRtl ? svc.descriptionAr : svc.description}</p>
                          )}
                        </div>
                        <div className={`text-${isRtl ? "left" : "right"} shrink-0`}>
                          <span className="font-bold text-primary text-sm">{svc.price} MRU</span>
                          <p className="text-[10px] text-muted-foreground">{svc.duration} min</p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/50 p-4">
                    {t("providers.no_services_configured", "Aucune prestation configurée pour le moment.")}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Avis Card (données réelles certifiées) */}
            <Card className="border-border/40 shadow-md">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold">{t("providers.verified_reviews_title", "Avis patients vérifiés")}</h3>
                  <Badge variant="secondary" className="text-xs gap-1 bg-amber-500/10 text-amber-600 border-amber-500/20">
                    <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-500" />
                    <span>{rating.toFixed(1)} ({reviewCount})</span>
                  </Badge>
                </div>

                {reviewsList === undefined ? (
                  <div className="py-6 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    {t("providers.loading_reviews", "Chargement des avis...")}
                  </div>
                ) : reviewsList.length === 0 ? (
                  <div className="py-6 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/50 p-4">
                    {t("providers.no_reviews", "Aucun avis pour le moment. Les avis sont certifiés après chaque consultation réalisée.")}
                  </div>
                ) : (
                  <div className="space-y-3">
                    {reviewsList.map((rev) => (
                      <div key={rev._id} className="bg-muted/30 p-4 rounded-xl space-y-1.5">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="text-sm font-semibold">{rev.authorName}</p>
                            <div className="flex items-center gap-0.5 mt-0.5">
                              {[...Array(5)].map((_, i) => (
                                <Star
                                  key={i}
                                  className={`h-3 w-3 ${
                                    i < rev.rating
                                      ? "fill-amber-400 text-amber-400"
                                      : "text-muted-foreground/30"
                                  }`}
                                />
                              ))}
                            </div>
                          </div>
                          <span className="text-[10px] text-muted-foreground">{rev.date}</span>
                        </div>
                        {rev.comment && (
                          <p className="text-xs text-muted-foreground leading-relaxed pt-0.5">
                            "{rev.comment}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Actions & Contact) */}
          <div className="w-full md:w-80 space-y-6">
            <Card className="border-border/40 shadow-xl shadow-primary/5 bg-card sticky top-6">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">{t("planning.book_appointment", "Prendre rendez-vous")}</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 dark:bg-emerald-950/30 dark:border-emerald-800/40 dark:text-emerald-400">
                      <CheckCircle2 className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">{t("providers.verified_caregiver", "Soignant certifié MauriCare")}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">{t("providers.availability", "Disponibilité")}</p>
                        <p className="text-sm font-medium">
                          {provider.availabilityPreview?.hasSlots
                            ? provider.availabilityPreview.nextSlotText
                            : provider.availabilityPreview?.hasSchedule === false
                            ? t("providers.schedule_not_configured", "Disponibilités non configurées")
                            : provider.available
                            ? t("providers.no_slots_7d", "Aucun créneau libre (7j)")
                            : t("common.unavailable", "Indisponible")}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {provider.availabilityPreview?.hasSchedule === false ? (
                    <Button
                      disabled
                      className="w-full gap-2 py-6 rounded-xl bg-muted text-muted-foreground border border-dashed border-border/60 cursor-not-allowed text-xs font-semibold"
                    >
                      <Clock className="h-4 w-4" />
                      {t("providers.no_schedule_btn", "Ce professionnel n'a pas encore configuré ses disponibilités.")}
                    </Button>
                  ) : !provider.services || provider.services.length === 0 ? (
                    <Button
                      disabled
                      className="w-full gap-2 py-6 rounded-xl bg-muted text-muted-foreground border border-dashed border-border/60 cursor-not-allowed text-xs font-semibold"
                    >
                      <AlertCircle className="h-4 w-4" />
                      {t("providers.no_services_btn", "Ce professionnel n'a pas encore configuré ses prestations.")}
                    </Button>
                  ) : (
                    <BookingStepper
                      providerId={provider._id}
                      initialSpecialty={provider.specialty}
                      providerName={name}
                      consultationFee={provider.consultationFee}
                    >
                      <Button
                        className="w-full gap-2 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all cursor-pointer text-base font-semibold"
                      >
                        <Calendar className="h-5 w-5" />
                        {t("providers.book_care", "Réserver un soin")}
                      </Button>
                    </BookingStepper>
                  )}

                  <NewMessageModal
                    role="patient"
                    targetRecipient={{
                      id: provider.userId,
                      name,
                      specialty: specialtyLabel,
                    }}
                    onConversationCreated={() => {
                      navigate("/dashboard");
                    }}
                  >
                    <Button
                      variant="outline"
                      className="w-full gap-2 py-5 rounded-xl border-primary/20 text-primary hover:bg-primary/5 cursor-pointer font-medium"
                    >
                      <MessageCircle className="h-4 w-4" />
                      {t("caregivers.send_message", "Envoyer un message")}
                    </Button>
                  </NewMessageModal>

                  {phone && (
                    <a
                      href={`tel:${phone}`}
                      className="w-full inline-flex items-center justify-center gap-2 py-2 px-3 border border-border/40 text-muted-foreground hover:text-foreground hover:bg-muted/30 rounded-lg text-xs font-medium transition-colors"
                    >
                      <Phone className="h-3.5 w-3.5" />
                      {t("providers.call_prefix", "Appeler")} ({phone})
                    </a>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
