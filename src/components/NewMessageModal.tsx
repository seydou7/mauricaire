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
import { Send, Edit3, CheckCircle2, Loader2, AlertCircle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { useTranslation } from "react-i18next";

interface NewMessageModalProps {
  children: React.ReactNode;
  role: "patient" | "professionnel";
  targetRecipient?: {
    id: Id<"users">;
    name: string;
    specialty?: string;
  };
  onConversationCreated?: (recipientId: string) => void;
}

export function NewMessageModal({ children, role, targetRecipient, onConversationCreated }: NewMessageModalProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>(targetRecipient ? targetRecipient.id : "");
  const [message, setMessage] = useState("");
  const [isSent, setIsSent] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Authoritative allowed recipients based on real appointments / network
  const allowedRecipients = useQuery(api.messages.getAllowedRecipients);
  const sendMessageMutation = useMutation(api.messages.send);

  const effectiveRecipientId = targetRecipient ? targetRecipient.id : recipientId;

  const handleSend = async () => {
    if (!effectiveRecipientId || !message.trim()) return;
    setIsSubmitting(true);
    setErrorMessage(null);

    try {
      await sendMessageMutation({
        receiverId: effectiveRecipientId as Id<"users">,
        content: message.trim(),
      });

      setIsSent(true);
      if (onConversationCreated) {
        onConversationCreated(effectiveRecipientId);
      }

      setTimeout(() => {
        setOpen(false);
        setTimeout(() => {
          setIsSent(false);
          setIsSubmitting(false);
          setRecipientId(targetRecipient ? targetRecipient.id : "");
          setMessage("");
          setErrorMessage(null);
        }, 300);
      }, 1200);
    } catch (err: unknown) {
      setIsSubmitting(false);
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi du message";
      setErrorMessage(msg);
    }
  };

  const recipientList = allowedRecipients || [];

  return (
    <Dialog open={open} onOpenChange={(v) => {
      setOpen(v);
      if (!v) {
        setIsSent(false);
        setErrorMessage(null);
      } else if (targetRecipient) {
        setRecipientId(targetRecipient.id);
      }
    }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
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
                  <Edit3 className="h-5 w-5 text-primary" />
                  {targetRecipient
                    ? t("messages.new_message_to_target", "Message à {{name}}", { name: targetRecipient.name })
                    : role === "patient"
                      ? t("messages.new_message_to_provider", "Nouveau message au soignant")
                      : t("messages.contact_patient", "Contacter un patient")}
                </DialogTitle>
                <DialogDescription>
                  {targetRecipient
                    ? t("messages.direct_message_desc", "Échangez directement avec ce professionnel de santé vérifié.")
                    : t("messages.select_contact_desc", "Sélectionnez un contact autorisé issu de vos rendez-vous et rédigez votre message.")}
                </DialogDescription>
              </DialogHeader>

              {errorMessage && (
                <div className="mb-4 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{errorMessage}</span>
                </div>
              )}

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {role === "patient" ? t("messages.authorized_provider", "Soignant") : t("messages.authorized_patient", "Patient")}
                  </label>

                  {targetRecipient ? (
                    <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between">
                      <div>
                        <p className="text-xs text-muted-foreground">{t("messages.recipient_label", "Destinataire")}</p>
                        <p className="text-sm font-semibold text-foreground">{targetRecipient.name}</p>
                      </div>
                      {targetRecipient.specialty && (
                        <span className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary font-medium">
                          {targetRecipient.specialty}
                        </span>
                      )}
                    </div>
                  ) : allowedRecipients === undefined ? (
                    <div className="h-10 px-3 rounded-md bg-muted/40 flex items-center gap-2 text-xs text-muted-foreground">
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                      {t("messages.loading_contacts", "Chargement des contacts autorisés...")}
                    </div>
                  ) : recipientList.length === 0 ? (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-amber-700 dark:text-amber-300 text-xs">
                      {t("messages.no_contacts", "Aucun contact disponible pour le moment.")}
                    </div>
                  ) : (
                    <Select value={recipientId} onValueChange={setRecipientId}>
                      <SelectTrigger>
                        <SelectValue placeholder={t("messages.select_contact_placeholder", "Sélectionnez un contact...")} />
                      </SelectTrigger>
                      <SelectContent>
                        {recipientList.map((contact) => (
                          <SelectItem key={contact._id} value={contact._id}>
                            <div className="flex items-center justify-between gap-2">
                              <span>{contact.name}</span>
                              {contact.specialty && (
                                <span className="text-[11px] text-muted-foreground uppercase font-medium">
                                  ({contact.specialty})
                                </span>
                              )}
                            </div>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-medium">{t("messages.message_label", "Message")}</label>
                  <Textarea
                    placeholder={t("messages.placeholder_message", "Écrivez votre message ici...")}
                    className="min-h-[120px] resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    disabled={isSubmitting || recipientList.length === 0}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
                  {t("messages.cancel", "Annuler")}
                </Button>
                <Button
                  onClick={handleSend}
                  disabled={!recipientId || !message.trim() || isSubmitting || recipientList.length === 0}
                  className="gap-2 bg-primary"
                >
                  {isSubmitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {t("messages.send", "Envoyer")}
                </Button>
              </DialogFooter>
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
              <h2 className="text-xl font-bold mb-2">{t("messages.sent_title", "Message envoyé !")}</h2>
              <p className="text-muted-foreground text-sm">
                {t("messages.sent_desc", "Votre message a été transmis et votre destinataire a été notifié.")}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
