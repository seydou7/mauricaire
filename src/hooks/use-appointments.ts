import { useState, useEffect } from "react";

export type AppointmentStatus = "À venir" | "Terminé" | "Annulé";

export interface Appointment {
  id: string;
  day: string;
  time: string;
  name: string;
  type: string;
  duration: string;
  status?: AppointmentStatus;
}

export interface Demande {
  id: string;
  patientName: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  message: string;
  status: "pending" | "accepted" | "rejected";
}

const DEFAULT_PRO_APPOINTMENTS: Appointment[] = [
  { id: "a1", day: "Lun 14", time: "09:00", name: "Aïcha M.", type: "Consultation diabète", duration: "1h" },
  { id: "a2", day: "Lun 14", time: "11:00", name: "Mohamed L.", type: "Rééducation post-op", duration: "45min" },
  { id: "a3", day: "Mer 16", time: "14:30", name: "Mariam T.", type: "Soins palliatifs", duration: "1h" },
  { id: "a4", day: "Ven 18", time: "10:00", name: "Fatimata D.", type: "Consultation hypertension", duration: "30min" },
  { id: "a5", day: "Sam 19", time: "08:30", name: "Sidi O.", type: "Kinésithérapie lombaire", duration: "45min" },
];

const DEFAULT_DEMANDES: Demande[] = [
  {
    id: "d1",
    patientName: "Oumar B.",
    type: "Consultation initiale",
    date: "Mar 15",
    time: "10:00",
    duration: "45min",
    message: "Bonjour, je souhaite un rendez-vous pour des douleurs au dos.",
    status: "pending",
  },
  {
    id: "d2",
    patientName: "Khadija S.",
    type: "Suivi mensuel",
    date: "Jeu 17",
    time: "15:30",
    duration: "30min",
    message: "Rendez-vous de suivi habituel.",
    status: "pending",
  },
];

export function useAppointments() {
  const [appointments, setAppointments] = useState<Appointment[]>(() => {
    const saved = localStorage.getItem("proAppointments");
    return saved ? JSON.parse(saved) : DEFAULT_PRO_APPOINTMENTS;
  });

  const [demandes, setDemandes] = useState<Demande[]>(() => {
    const saved = localStorage.getItem("proDemandes");
    return saved ? JSON.parse(saved) : DEFAULT_DEMANDES;
  });

  useEffect(() => {
    localStorage.setItem("proAppointments", JSON.stringify(appointments));
  }, [appointments]);

  useEffect(() => {
    localStorage.setItem("proDemandes", JSON.stringify(demandes));
  }, [demandes]);

  const acceptDemande = (id: string) => {
    const demande = demandes.find((d) => d.id === id);
    if (!demande) return;

    // Update demande status
    setDemandes(demandes.map((d) => (d.id === id ? { ...d, status: "accepted" } : d)));

    // Create new appointment
    const newAppointment: Appointment = {
      id: `a_${Date.now()}`,
      day: demande.date,
      time: demande.time,
      name: demande.patientName,
      type: demande.type,
      duration: demande.duration,
      status: "À venir",
    };

    setAppointments((prev) => [...prev, newAppointment].sort((a, b) => {
      // Sort loosely based on time (for prototype)
      return a.day.localeCompare(b.day) || a.time.localeCompare(b.time);
    }));
  };

  const rejectDemande = (id: string) => {
    setDemandes(demandes.map((d) => (d.id === id ? { ...d, status: "rejected" } : d)));
  };

  return {
    appointments,
    demandes,
    pendingDemandes: demandes.filter((d) => d.status === "pending"),
    acceptDemande,
    rejectDemande,
  };
}
