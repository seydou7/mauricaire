import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar } from "@/components/ui/calendar";
import { Badge } from "@/components/ui/badge";
import { Calendar as CalendarIcon, Clock, CheckCircle2, AlertCircle, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

interface ProviderAvailabilityProps {
  children: React.ReactNode;
  providerName: string;
  specialty: string;
  availability?: string;
  providerId?: Id<"providers">;
}

export function ProviderAvailability({
  children,
  providerName,
  specialty,
  availability,
  providerId,
}: ProviderAvailabilityProps) {
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [time, setTime] = useState<string | null>(null);
  const [confirmed, setConfirmed] = useState(false);

  const dateString = date ? date.toISOString().split("T")[0] : "";

  // Query authoritative slots from server (Module 4)
  const availableSlotsData = useQuery(
    api.availability.getAvailableSlots,
    providerId && dateString
      ? { providerId, date: dateString }
      : "skip"
  );

  const handleConfirm = () => {
    setConfirmed(true);
    setTimeout(() => {
      setOpen(false);
      setTimeout(() => setConfirmed(false), 300);
    }, 2000);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (!v) {
          setTime(null);
          setConfirmed(false);
        }
      }}
    >
      <DialogTrigger asChild>{children}</DialogTrigger>
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
                  <DialogDescription className="text-sm mt-1">
                    Consultez les disponibilités en temps réel de ce soignant.
                  </DialogDescription>
                </div>

                <div className="flex-1 flex justify-center items-start">
                  <Calendar
                    mode="single"
                    selected={date}
                    onSelect={(d) => {
                      setDate(d);
                      setTime(null);
                    }}
                    className="rounded-xl border border-border/50 bg-card shadow-sm p-3"
                    disabled={(d) => d < new Date(new Date().setHours(0, 0, 0, 0))}
                  />
                </div>
              </div>

              {/* Right Side: Time Slots */}
              <div className="w-full sm:w-[45%] p-6 flex flex-col bg-card">
                <div className="mb-4">
                  <h3 className="font-semibold flex items-center gap-2">
                    <CalendarIcon className="h-4 w-4 text-primary" />
                    {date ? date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" }) : "Choisissez une date"}
                  </h3>
                </div>

                <div className="flex-1 overflow-y-auto pr-2 space-y-2">
                  {!date ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground">
                      <Clock className="h-8 w-8 mb-2 opacity-20" />
                      <p className="text-sm text-center">Sélectionnez une date pour voir les disponibilités</p>
                    </div>
                  ) : availableSlotsData === undefined ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground gap-2">
                      <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      <p className="text-xs">Chargement des disponibilités...</p>
                    </div>
                  ) : !availableSlotsData.available || availableSlotsData.slots.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-muted-foreground p-4 text-center">
                      <AlertCircle className="h-8 w-8 mb-2 text-amber-500 opacity-80" />
                      <p className="text-sm font-medium text-foreground">Aucun créneau disponible</p>
                      <p className="text-xs text-muted-foreground mt-1">
                        {availableSlotsData.reason || "Le soignant n'a pas de disponibilité sur cette date."}
                      </p>
                    </div>
                  ) : (
                    availableSlotsData.slots.map((t) => {
                      const isSelected = time === t;
                      return (
                        <div key={t} className="flex items-center gap-2">
                          <Button
                            variant={isSelected ? "default" : "outline"}
                            className={`flex-1 justify-between transition-all ${
                              isSelected
                                ? "bg-primary shadow-md text-primary-foreground font-bold"
                                : "border-primary/20 hover:border-primary text-primary hover:bg-primary/5"
                            }`}
                            onClick={() => setTime(t)}
                          >
                            <span>{t}</span>
                          </Button>
                          {isSelected && (
                            <Button
                              onClick={handleConfirm}
                              className="bg-emerald-600 hover:bg-emerald-700 text-white shadow-md animate-in slide-in-from-right-2 text-xs h-9 px-3"
                            >
                              Valider
                            </Button>
                          )}
                        </div>
                      );
                    })
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
              <h2 className="text-2xl font-bold mb-2">Créneau sélectionné !</h2>
              <p className="text-muted-foreground">
                Créneau avec {providerName} sélectionné pour le{" "}
                <span className="font-medium text-foreground">
                  {date?.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" })} à {time}
                </span>.
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </DialogContent>
    </Dialog>
  );
}
