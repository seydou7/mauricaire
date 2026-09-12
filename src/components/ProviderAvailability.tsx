import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, CheckCircle2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProviderAvailabilityProps {
  children: React.ReactNode;
  providerName: string;
  specialty: string;
  availability?: string;
}

export function ProviderAvailability({ children, providerName, specialty, availability }: ProviderAvailabilityProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  // Fake time slots
  const timeSlots = ["09:00", "09:30", "10:00", "11:30", "14:00", "15:30", "16:00", "17:30"];
  
  // Logic for "Complet cette semaine"
  const now = new Date();
  const currentDay = now.getDay() === 0 ? 7 : now.getDay(); // Make Sunday 7 instead of 0
  const daysUntilSunday = 7 - currentDay;
  const endOfWeek = new Date(now);
  endOfWeek.setDate(now.getDate() + daysUntilSunday);
  endOfWeek.setHours(23, 59, 59, 999);

  const isFullThisWeek = availability ? availability.toLowerCase().includes("complet") : false;
  const isSelectedDateInFullWeek = isFullThisWeek && date && date <= endOfWeek;

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => {
      setOpen(false);
      // reset after closing
      setTimeout(() => setConfirmed(false), 300);
    }, 2000);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if(!v) { setTime(null); setConfirmed(false); } }}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[700px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
        <AnimatePresence mode="wait">
          {!confirmed ? (
            <motion.div
              key="picker"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="flex flex-col sm:flex-row h-[500px]"
            >
              {/* Left Side: Provider Info & Calendar */}
              <div className="w-full sm:w-[55%] bg-muted/10 border-r border-border/40 p-6 flex flex-col">
                <div className="mb-6">
                  <Badge variant="secondary" className="mb-2 bg-primary/10 text-primary hover:bg-primary/20">
                    {specialty}
                  </Badge>
                  <DialogTitle className="text-2xl font-bold">{providerName}</DialogTitle>
                  <DialogDescription className="text-sm mt-1">Sélectionnez une date et une heure pour votre consultation.</DialogDescription>
                </div>
                
                <div className="flex-1 flex justify-center items-start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => { setDate(d); setTime(null); }}
                    className="rounded-xl border border-border/50 bg-card shadow-sm p-3"
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0)) || (!!isFullThisWeek && d <= endOfWeek)}
                  />
                </div>
              </div>

              {/* Right Side: Time Slots */}
              <div className="w-full sm:w-[45%] p-6 flex flex-col bg-card">
                <div className="mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {date ? date.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }) : 'Choisissez une date'}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {date ? (
                    timeSlots.map((t) => (
                      <div key={t} className="flex items-center gap-2">
                        <Button
                          disabled={isSelectedDateInFullWeek}
                          variant={time === t ? "default" : "outline"}
                          className={`flex-1 justify-center transition-all ${time === t ? 'bg-primary shadow-md' : 'border-primary/20 hover:border-primary text-primary hover:bg-primary/5'} ${isSelectedDateInFullWeek ? 'opacity-50 cursor-not-allowed border-muted-foreground/20 text-muted-foreground hover:bg-transparent hover:border-muted-foreground/20 hover:text-muted-foreground' : ''}`}
                          onClick={() => !isSelectedDateInFullWeek && setTime(t)}
                        >
                          {t}
                        </Button>
                        {time === t && (
                          <Button 
                            onClick={handleConfirm}
                            className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-in slide-in-from-right-2"
                          >
                            Valider
                          </Button>
                        )}
                      </div>
                    ))
                  ) : (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm text-center">Sélectionnez une date pour voir les disponibilités</p>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="success"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="p-12 text-center h-[500px] flex flex-col items-center justify-center"
            >
              <div className="w-20 h-20 bg-emerald-100 rounded-full flex items-center justify-center mb-6 mx-auto">
                <CheckCircle2 className="h-10 w-10 text-emerald-600" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Créneau réservé !</h2>
              <p className="text-muted-foreground">
                Votre rendez-vous avec {providerName} est confirmé pour le{" "}
                <span className="font-medium text-foreground">
                  {date?.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })} à {time}
                </span>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
