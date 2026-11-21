import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";

export type AppointmentStatus = "en_attente" | "confirme" | "termine" | "annule";

export interface Appointment {
  _id: string;
  id: string;
  day?: string;
  date: string;
  time: string;
  name: string;
  providerId?: string;
  providerName?: string;
  specialty?: string;
  serviceType?: string;
  image?: string;
  consultationFee?: number;
  patient?: string;
  patientName?: string;
  patientPhone?: string;
  type: string;
  duration: string;
  status: AppointmentStatus;
  address?: string;
  notes?: string;
  cancellationReason?: string;
  recurrenceSeriesId?: string;
  servicePrice?: number;
  serviceSnapshot?: {
    name: string;
    price: number;
    duration: number;
  };
  occurrenceIndex?: number;
  beneficiaryId?: string;
  bookedByUserId?: string;
  bookedByName?: string;
}

export interface Demande {
  _id: string;
  id: string;
  patientId: string;
  patientName: string;
  patientPhone: string;
  patientEmail: string;
  patientImage: string;
  serviceType: string;
  type: string;
  date: string;
  time: string;
  duration: string;
  notes: string;
  message: string;
  status: AppointmentStatus;
  address: string;
}

export function useAppointments() {
  const pendingRequestsQuery = useQuery(api.appointments.getPendingRequests);
  const providerScheduleQuery = useQuery(api.appointments.getProviderSchedule);
  const patientAppointmentsQuery = useQuery(api.appointments.getPatientAppointments, {});

  const acceptMutation = useMutation(api.appointments.accept);
  const rejectMutation = useMutation(api.appointments.reject);
  const cancelMutation = useMutation(api.appointments.cancel);

  const pendingDemandes: Demande[] = ((pendingRequestsQuery || []) as any) as Demande[];
  const proAppointments: Appointment[] = ((providerScheduleQuery || []) as any) as Appointment[];
  const patientAppointments: Appointment[] = ((patientAppointmentsQuery || []) as any) as Appointment[];

  const acceptDemande = async (id: string) => {
    return await acceptMutation({ appointmentId: id as Id<"appointments"> });
  };

  const rejectDemande = async (id: string, reason?: string) => {
    return await rejectMutation({
      appointmentId: id as Id<"appointments">,
      reason: reason || "Refusé par le praticien",
    });
  };

  const cancelAppointment = async (id: string, reason?: string) => {
    return await cancelMutation({
      appointmentId: id as Id<"appointments">,
      reason,
    });
  };

  return {
    // Professional view
    demandes: pendingDemandes,
    pendingDemandes,
    appointments: proAppointments,
    proAppointments,
    acceptDemande,
    rejectDemande,

    // Patient view
    patientAppointments,

    // Common
    cancelAppointment,

    // Loading states
    isLoadingPending: pendingRequestsQuery === undefined,
    isLoadingSchedule: providerScheduleQuery === undefined,
    isLoadingPatientAppointments: patientAppointmentsQuery === undefined,
  };
}
