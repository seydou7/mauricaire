import { useState } from "react";
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
import { Textarea } from "@/components/ui/textarea";
import { Star, CheckCircle2, MessageSquareHeart, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";

interface ReviewModalProps {
  children: React.ReactNode;
  providerName: string;
  appointmentId?: Id<"appointments">;
  onSuccess?: () => void;
}

export function ReviewModal({
  children,
  providerName,
  appointmentId,
  onSuccess,
}: ReviewModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSent, setIsSent] = useState(false);

  const createReview = useMutation(api.reviews.create);

  const existingReview = useQuery(
    api.reviews.getByAppointment,
    appointmentId ? { appointmentId } : "skip"
  );

  const handleSend = async () => {
    if (!appointmentId) {
      setErrorMessage("Identifiant de consultation manquant.");
      return;
    }
    if (rating < 1 || rating > 5) {
      setErrorMessage("Veuillez attribuer une note entre 1 et 5 étoiles.");
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await createReview({
        appointmentId,
        rating,
        comment: comment.trim() || undefined,
      });

      setIsSent(true);
      if (onSuccess) onSuccess();

      setTimeout(() => {
        setOpen(false);
        setTimeout(() => {
          setIsSent(false);
          setRating(0);
          setComment("");
        }, 300);
      }, 2000);
    } catch (err: any) {
      setErrorMessage(err?.message || "Erreur lors de la publication de l'avis");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setIsSent(false);
          setErrorMessage(null);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="sm:max-w-[450px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
        <AnimatePresence mode="wait">
          {!isSent ? (
            <motion.div
              key="compose"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="p-6"
            >
              <DialogHeader className="mb-6">
                <DialogTitle className="text-xl font-bold flex items-center gap-2">
                  <MessageSquareHeart className="h-5 w-5 text-primary" />
                  {t("reviews.leave_review", "Laisser un avis")}
                </DialogTitle>
                <DialogDescription>
                  {t("reviews.review_desc", "Évaluez votre rendez-vous avec {{name}}. Votre avis aide les autres patients !", { name: providerName })}
                </DialogDescription>
              </DialogHeader>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-xs flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                  <span>{errorMessage}</span>
                </div>
              )}

              {existingReview ? (
                <div className="py-6 text-center space-y-3">
                  <div className="w-12 h-12 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-full flex items-center justify-center mx-auto">
                    <CheckCircle2 className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-medium">{t("reviews.already_reviewed", "Vous avez déjà laissé un avis pour cette consultation.")}</p>
                  <p className="text-xs text-muted-foreground">Note attribuée : {existingReview.rating} / 5</p>
                  <Button variant="outline" size="sm" onClick={() => setOpen(false)} className="mt-2">
                    Fermer
                  </Button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="flex flex-col items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground">{t("reviews.rating_label", "Note globale")}</label>
                    <div className="flex gap-1">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-8 w-8 cursor-pointer transition-all ${
                            (hoverRating || rating) >= star
                              ? "fill-yellow-400 text-yellow-400 scale-110"
                              : "text-muted-foreground/30 hover:text-yellow-400/50"
                          }`}
                          onMouseEnter={() => setHoverRating(star)}
                          onMouseLeave={() => setHoverRating(0)}
                          onClick={() => setRating(star)}
                        />
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium">{t("reviews.comment_label", "Votre commentaire")}</label>
                    <Textarea
                      placeholder={t("reviews.comment_placeholder", "Comment s'est passé votre soin ? (Ex: Ponctuel, attentif, professionnel...)")}
                      className="min-h-[100px] resize-none text-sm"
                      value={comment}
                      onChange={(e) => setComment(e.target.value)}
                    />
                  </div>

                  <DialogFooter className="mt-6 flex sm:justify-between flex-row-reverse sm:flex-row gap-2">
                    <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                      Annuler
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={rating === 0 || isSubmitting || !appointmentId}
                      className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          {t("reviews.publishing", "Publication...")}
                        </>
                      ) : (
                        <>
                          <Star className="h-4 w-4 fill-current" />
                          {t("reviews.publish", "Publier l'avis")}
                        </>
                      )}
                    </Button>
                  </DialogFooter>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center flex flex-col items-center justify-center min-h-[300px]"
            >
              <div className="w-16 h-16 bg-emerald-100 dark:bg-emerald-950/40 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600 dark:text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold mb-2">{t("reviews.success_title", "Avis enregistré !")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("reviews.success_desc", "Merci pour votre retour. Il sera visible sur le profil du praticien.")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
