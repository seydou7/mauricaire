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
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Send, Edit3, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface NewMessageModalProps {
  children: React.ReactNode;
  role: "patient" | "professionnel";
}

export function NewMessageModal({ children, role }: NewMessageModalProps) {
  const [open, setOpen] = useState(false);
  const [recipient, setRecipient] = useState("");
  const [message, setMessage] = useState("");
  const [isSent, setIsSent] = useState(false);

  const providers = ["Dr. Camara", "Fatima O.", "Mariam D.", "Dr. Ahmed S.", "Aminata D.", "Dr. Souleymane B."];
  const patients = ["Aïcha M.", "Mohamed L.", "Fatimata D.", "Sidi O.", "Mariam T."];
  const contacts = role === "patient" ? providers : patients;

  const handleSend = () => {
    setIsSent(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => {
        setIsSent(false);
        setRecipient("");
        setMessage("");
      }, 300);
    }, 1500);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) setIsSent(false); }}>
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
                  {role === "patient" ? "Nouveau message au soignant" : "Contacter un patient"}
                </DialogTitle>
                <DialogDescription>
                  Rédigez votre message ci-dessous.
                </DialogDescription>
              </DialogHeader>

              <div className="space-y-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">
                    {role === "patient" ? "Nom du soignant" : "Nom du patient"}
                  </label>
                  <Select value={recipient} onValueChange={setRecipient}>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionnez un contact" />
                    </SelectTrigger>
                    <SelectContent>
                      {contacts.map((contact) => (
                        <SelectItem key={contact} value={contact}>
                          {contact}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">Message</label>
                  <Textarea 
                    placeholder="Écrivez votre message ici..." 
                    className="min-h-[120px] resize-none"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                  />
                </div>
              </div>

              <DialogFooter className="mt-6">
                <Button variant="outline" onClick={() => setOpen(false)}>Annuler</Button>
                <Button onClick={handleSend} disabled={!recipient || !message} className="gap-2 bg-primary">
                  <Send className="h-4 w-4" />
                  Envoyer
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
              <h2 className="text-xl font-bold mb-2">Message envoyé !</h2>
              <p className="text-muted-foreground text-sm">
                Votre destinataire sera notifié.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
