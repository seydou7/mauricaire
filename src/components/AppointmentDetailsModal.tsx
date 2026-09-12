import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Calendar, Clock, MapPin, User, Stethoscope, FileText, CheckCircle2, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";

interface AppointmentDetailsModalProps {
  children: React.ReactNode;
  appointment: any;
  role: "patient" | "professionnel";
}

export function AppointmentDetailsModal({ children, appointment, role }: AppointmentDetailsModalProps) {
  const [open, setOpen] = useState(false);

  const name = role === "patient" ? appointment.name : appointment.patient;
  const date = appointment.date || "Aujourd'hui";
  const time = appointment.time;
  const status = appointment.status;
  const type = appointment.type;
  const duration = appointment.duration || "1h";

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children}
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px] p-0 overflow-hidden bg-card/95 backdrop-blur-xl border-primary/20 shadow-2xl">
        {/* Header */}
        <div className="bg-gradient-to-br from-emerald-600 to-emerald-800 p-6 text-white relative">
          <Badge 
            variant="secondary" 
            className={`absolute top-4 right-4 text-xs font-semibold ${
              status === "confirme" 
                ? "bg-white/20 text-white border-white/30" 
                : "bg-orange-500/80 text-white border-orange-400"
            }`}
          >
            {status === "confirme" ? "Confirmé" : "En attente"}
          </Badge>
          
          <DialogHeader className="pt-2">
            <DialogTitle className="text-xl font-bold text-white flex flex-col gap-1">
              <span>{role === "patient" ? "Rendez-vous" : "Consultation"}</span>
              <span className="text-emerald-100 font-normal text-sm">{type}</span>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Time & Date */}
          <div className="flex bg-muted/30 rounded-xl p-4 border border-border/50 shadow-sm">
            <div className="flex-1 flex flex-col items-center justify-center border-r border-border/50">
              <Calendar className="h-5 w-5 text-primary mb-1" />
              <span className="text-sm font-semibold">{date}</span>
            </div>
            <div className="flex-1 flex flex-col items-center justify-center">
              <Clock className="h-5 w-5 text-primary mb-1" />
              <span className="text-sm font-semibold">{time}</span>
              <span className="text-[10px] text-muted-foreground">({duration})</span>
            </div>
          </div>

          <Separator />

          {/* Details */}
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                {role === "patient" ? <Stethoscope className="h-4 w-4 text-primary" /> : <User className="h-4 w-4 text-primary" />}
              </div>
              <div>
                <p className="text-xs text-muted-foreground">{role === "patient" ? "Soignant" : "Patient"}</p>
                <p className="text-sm font-medium">{name}</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Lieu</p>
                <p className="text-sm font-medium">À domicile</p>
                <p className="text-xs text-muted-foreground">Nouakchott, Mauritanie</p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Motif</p>
                <p className="text-sm font-medium">{type}</p>
              </div>
            </div>
          </div>

          <Separator />

          {/* Actions */}
          <div className="flex flex-col gap-2 pt-2">
            {status === "en_attente" && role === "professionnel" && (
              <Button className="w-full bg-primary gap-2">
                <CheckCircle2 className="h-4 w-4" />
                Accepter la demande
              </Button>
            )}
            <Button variant="outline" className="w-full gap-2 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700">
              <XCircle className="h-4 w-4" />
              {role === "patient" ? "Annuler le rendez-vous" : "Refuser / Annuler"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
