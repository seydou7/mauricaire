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
import { Badge } from "@/components/ui/badge";
import { MapPin, Calendar, Clock, CheckCircle2, ChevronRight, ChevronLeft, Search, Syringe, Heart, Stethoscope, Ambulance } from "lucide-react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";

const SPECIALTIES = [
  { id: "nurse", label: "Infirmier", icon: Syringe, desc: "Injections, pansements" },
  { id: "aide", label: "Aide-soignant", icon: Heart, desc: "Toilette, aide repas" },
  { id: "doctor", label: "Médecin", icon: Stethoscope, desc: "Consultation générale" },
  { id: "kine", label: "Kinésithérapeute", icon: Ambulance, desc: "Rééducation" },
];

export function BookingStepper({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(1);
  
  // Form State
  const [specialty, setSpecialty] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [address, setAddress] = useState("");
  const [isLocating, setIsLocating] = useState(false);

  const handleNext = () => setStep((s) => Math.min(3, s + 1));
  const handleBack = () => setStep((s) => Math.max(1, s - 1));

  const handleLocate = () => {
    setIsLocating(true);
    setTimeout(() => {
      setAddress("Tevragh Zeina, Nouakchott");
      setIsLocating(false);
    }, 1500);
  };

  const resetForm = () => {
    setStep(1);
    setSpecialty("");
    setDate("");
    setTime("");
    setAddress("");
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) resetForm(); }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
        <div className="p-6">
          <DialogHeader className="mb-6">
            <DialogTitle className="text-2xl font-bold flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              Réserver un soin
            </DialogTitle>
            <DialogDescription>
              Étape {step} sur 3
            </DialogDescription>
          </DialogHeader>

          {/* Progress Bar */}
          <div className="w-full bg-muted/50 h-2 rounded-full mb-8 overflow-hidden">
            <motion.div 
              className="h-full bg-primary"
              initial={{ width: "33%" }}
              animate={{ width: `${(step / 3) * 100}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>

          <AnimatePresence mode="wait">
            {step === 1 && (
              <motion.div 
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-4"
              >
                <h3 className="font-semibold text-lg">De quel type de soin avez-vous besoin ?</h3>
                <div className="grid grid-cols-2 gap-3">
                  {SPECIALTIES.map((spec) => {
                    const Icon = spec.icon;
                    const isSelected = specialty === spec.id;
                    return (
                      <div 
                        key={spec.id}
                        onClick={() => setSpecialty(spec.id)}
                        className={`p-4 rounded-xl border cursor-pointer transition-all ${isSelected ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'}`}
                      >
                        <Icon className={`h-6 w-6 mb-2 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                        <div className={`font-medium ${isSelected ? 'text-primary' : ''}`}>{spec.label}</div>
                        <div className="text-xs text-muted-foreground mt-1">{spec.desc}</div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {step === 2 && (
              <motion.div 
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-5"
              >
                <h3 className="font-semibold text-lg">Où et quand ?</h3>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium">Date du soin</label>
                  <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-11" />
                </div>
                
                <div className="space-y-3">
                  <label className="text-sm font-medium">Heure souhaitée</label>
                  <Input type="time" value={time} onChange={(e) => setTime(e.target.value)} className="h-11" />
                </div>

                <div className="space-y-3">
                  <label className="text-sm font-medium">Adresse</label>
                  <div className="flex gap-2">
                    <Input 
                      placeholder="Votre adresse complète" 
                      value={address} 
                      onChange={(e) => setAddress(e.target.value)}
                      className="h-11" 
                    />
                    <Button 
                      type="button" 
                      variant="outline" 
                      size="icon" 
                      className="h-11 w-11 shrink-0 bg-primary/5 text-primary border-primary/20 hover:bg-primary/10"
                      onClick={handleLocate}
                      disabled={isLocating}
                    >
                      <MapPin className={`h-4 w-4 ${isLocating ? 'animate-bounce' : ''}`} />
                    </Button>
                  </div>
                </div>
              </motion.div>
            )}

            {step === 3 && (
              <motion.div 
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="space-y-6 text-center py-4"
              >
                <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
                  <CheckCircle2 className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <h3 className="font-bold text-xl mb-2">Presque terminé !</h3>
                  <p className="text-muted-foreground text-sm">Veuillez vérifier les informations de votre demande.</p>
                </div>
                
                <div className="bg-muted/30 p-4 rounded-xl border border-border/50 text-left space-y-3">
                  <div className="flex items-center gap-3">
                    <Badge variant="secondary" className="bg-primary/10 text-primary hover:bg-primary/10">{SPECIALTIES.find(s => s.id === specialty)?.label}</Badge>
                  </div>
                  <div className="flex items-center gap-2 text-sm">
                    <Calendar className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{date || "Non spécifiée"}</span> à <span className="font-medium">{time || "Non spécifiée"}</span>
                  </div>
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 text-muted-foreground shrink-0 mt-0.5" />
                    <span>{address || "Aucune adresse"}</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </div>
        <DialogFooter className="p-6 pt-0 flex sm:justify-between flex-row-reverse sm:flex-row gap-2">
          {step > 1 && (
            <Button variant="outline" onClick={handleBack} className="w-full sm:w-auto h-11">
              <ChevronLeft className="h-4 w-4 mr-2" /> Retour
            </Button>
          )}
          {step < 3 ? (
            <Button 
              onClick={handleNext} 
              className="w-full sm:w-auto h-11 bg-primary hover:bg-primary/90 text-primary-foreground ml-auto"
              disabled={(step === 1 && !specialty) || (step === 2 && (!date || !time || !address))}
            >
              Suivant <ChevronRight className="h-4 w-4 ml-2" />
            </Button>
          ) : (
            <Button 
              onClick={() => { setOpen(false); resetForm(); }} 
              className="w-full sm:w-auto h-11 bg-primary hover:bg-primary/90 text-primary-foreground ml-auto"
            >
              Confirmer la réservation <CheckCircle2 className="h-4 w-4 ml-2" />
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
