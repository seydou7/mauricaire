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
import { Star, CheckCircle2, MessageSquareHeart } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ReviewModalProps {
  children: React.ReactNode;
  providerName: string;
}

export function ReviewModal({ children, providerName }: ReviewModalProps) {
  const [open, setOpen] = useState(false);
  const [rating, setRating] = useState(0);
  const [hoverRating, setHoverRating] = useState(0);
  const [comment, setComment] = useState("");
  const [isSent, setIsSent] = useState(false);

  const handleSend = () => {
    setIsSent(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => {
        setIsSent(false);
        setRating(0);
        setComment("");
      }, 300);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setIsSent(false); }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
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
                  Laisser un avis
                </DialogTitle>
                <DialogDescription>
                  Évaluez votre rendez-vous avec {providerName}. Votre avis aide les autres patients !
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-6">
                <div className="flex flex-col items-center gap-2">
                  <label className="text-sm font-medium text-muted-foreground">Note globale</label>
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
                  <label className="text-sm font-medium">Votre commentaire</label>
                  <Textarea 
                    placeholder="Comment s'est passé votre soin ? (Ex: Ponctuel, très professionnel...)" 
                    className="min-h-[100px] resize-none"
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleSend} disabled={rating === 0} className="gap-2 bg-primary">
                  Publier l'avis
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
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="h-8 w-8 text-emerald-600" />
              </div>
              <h2 className="text-xl font-bold mb-2">Avis publié !</h2>
              <p className="text-muted-foreground text-sm">
                Merci de votre retour sur {providerName}.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
