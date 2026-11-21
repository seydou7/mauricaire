import React, { useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useTranslation } from "react-i18next";
import { CreateRelayModal } from "./CreateRelayModal";
import { RelayDetailModal } from "./RelayDetailModal";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import {
  Inbox,
  Send,
  Plus,
  AlertTriangle,
  Clock,
  MessageSquare,
  FileText,
  User,
  ShieldCheck,
  ChevronRight,
  Search,
  Filter,
} from "lucide-react";

export const RelayInbox: React.FC = () => {
  const { t } = useTranslation();

  const [activeTab, setActiveTab] = useState<"received" | "sent">("received");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedRelayId, setSelectedRelayId] = useState<string | null>(null);

  const incomingRequests = useQuery(api.relay.getIncomingRelayRequests) || [];
  const sentRequests = useQuery(api.relay.getMySentRelayRequests) || [];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "requested":
        return <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[10px]">{t("relay.status_requested", t("status.requested", "En attente d'avis"))}</Badge>;
      case "accepted":
        return <Badge variant="outline" className="bg-sky-50 text-sky-700 border-sky-200 text-[10px]">{t("relay.status_accepted", t("status.accepted", "Acceptée"))}</Badge>;
      case "in_progress":
        return <Badge variant="outline" className="bg-indigo-50 text-indigo-700 border-indigo-200 text-[10px]">{t("relay.status_in_progress", t("status.in_progress", "En cours"))}</Badge>;
      case "answered":
        return <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-[10px]">{t("relay.status_answered", t("status.answered", "Avis rendu"))}</Badge>;
      case "completed":
        return <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px]">{t("relay.status_completed", t("status.completed", "Clôturée"))}</Badge>;
      case "declined":
        return <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[10px]">{t("relay.status_declined", t("status.declined", "Déclinée"))}</Badge>;
      case "cancelled":
        return <Badge variant="outline" className="bg-slate-100 text-slate-600 border-slate-200 text-[10px]">{t("relay.status_cancelled", t("status.cancelled", "Annulée"))}</Badge>;
      default:
        return <Badge variant="outline" className="text-[10px]">{status}</Badge>;
    }
  };

  // Filter incoming
  const filteredIncoming = incomingRequests.filter((r) => {
    if (statusFilter === "pending" && r.status !== "requested") return false;
    if (
      statusFilter === "active" &&
      r.status !== "accepted" &&
      r.status !== "in_progress" &&
      r.status !== "answered"
    )
      return false;
    if (statusFilter === "completed" && r.status !== "completed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchPatient = r.patientName.toLowerCase().includes(q);
      const matchRequester = (r.requesterName || "").toLowerCase().includes(q);
      if (!matchReason && !matchPatient && !matchRequester) return false;
    }
    return true;
  });

  // Filter sent
  const filteredSent = sentRequests.filter((r) => {
    if (statusFilter === "pending" && r.status !== "requested") return false;
    if (
      statusFilter === "active" &&
      r.status !== "accepted" &&
      r.status !== "in_progress" &&
      r.status !== "answered"
    )
      return false;
    if (statusFilter === "completed" && r.status !== "completed") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchReason = r.reason.toLowerCase().includes(q);
      const matchPatient = r.patientName.toLowerCase().includes(q);
      const matchResponder = (r.responderName || "").toLowerCase().includes(q);
      if (!matchReason && !matchPatient && !matchResponder) return false;
    }
    return true;
  });

  const pendingIncomingCount = incomingRequests.filter((r) => r.status === "requested").length;
  const activeIncomingCount = incomingRequests.filter(
    (r) => r.status === "accepted" || r.status === "in_progress"
  ).length;

  return (
    <div className="space-y-6">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-xl border border-slate-200 shadow-sm">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <h2 className="text-xl font-bold text-slate-900 tracking-tight">
              {t("relay.title")}
            </h2>
            <Badge variant="outline" className="bg-teal-50 text-teal-700 border-teal-200 text-xs">
              Pro-to-Pro
            </Badge>
          </div>
          <p className="text-xs text-slate-500 max-w-2xl">
            {t("relay.subtitle")} •{" "}
            <span className="text-teal-700 font-medium">{t("relay.no_ai_disclaimer")}</span>
          </p>
        </div>

        <Button
          onClick={() => setIsCreateModalOpen(true)}
          className="bg-teal-600 hover:bg-teal-700 text-white shadow-sm flex items-center gap-2 shrink-0 self-start sm:self-auto"
        >
          <Plus className="w-4 h-4" />
          <span>{t("relay.btn_new_request")}</span>
        </Button>
      </div>

      {/* Main Container */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-slate-200 px-5 pt-3 bg-slate-50/50">
          <div className="flex gap-2">
            <button
              onClick={() => {
                setActiveTab("received");
                setStatusFilter("all");
              }}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "received"
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Inbox className="w-4 h-4" />
              <span>{t("relay.tab_received")}</span>
              {pendingIncomingCount > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-amber-500 text-white text-[10px]">
                  {pendingIncomingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab("sent");
                setStatusFilter("all");
              }}
              className={`flex items-center gap-2 pb-3 px-3 text-xs font-semibold border-b-2 transition-colors ${
                activeTab === "sent"
                  ? "border-teal-600 text-teal-700"
                  : "border-transparent text-slate-500 hover:text-slate-800"
              }`}
            >
              <Send className="w-4 h-4" />
              <span>{t("relay.tab_sent")}</span>
              {sentRequests.length > 0 && (
                <span className="px-1.5 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px]">
                  {sentRequests.length}
                </span>
              )}
            </button>
          </div>

          {/* Search bar */}
          <div className="hidden sm:flex items-center gap-2 pb-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-2.5 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par motif, patient..."
                className="pl-8 pr-3 py-1.5 text-xs bg-white border border-slate-200 rounded-md focus:outline-none focus:border-teal-500 w-56"
              />
            </div>
          </div>
        </div>

        {/* Filter Pills */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex items-center gap-2 text-xs overflow-x-auto">
          <span className="text-slate-400 font-medium text-[11px] mr-1">Filtres :</span>
          <button
            onClick={() => setStatusFilter("all")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === "all"
                ? "bg-slate-900 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Toutes
          </button>
          <button
            onClick={() => setStatusFilter("pending")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === "pending"
                ? "bg-amber-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            En attente ({activeTab === "received" ? pendingIncomingCount : sentRequests.filter(s => s.status === "requested").length})
          </button>
          <button
            onClick={() => setStatusFilter("active")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === "active"
                ? "bg-teal-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            En cours / Répondues
          </button>
          <button
            onClick={() => setStatusFilter("completed")}
            className={`px-2.5 py-1 rounded-full text-xs font-medium transition-colors ${
              statusFilter === "completed"
                ? "bg-emerald-600 text-white"
                : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-100"
            }`}
          >
            Clôturées
          </button>
        </div>

        {/* List Content */}
        <div className="divide-y divide-slate-100">
          {activeTab === "received" ? (
            filteredIncoming.length === 0 ? (
              <div className="p-12 text-center text-slate-400">
                <Inbox className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
                <p className="text-sm font-medium text-slate-600">{t("relay.empty_received")}</p>
                <p className="text-xs text-slate-400 mt-1">
                  Les demandes d'avis confraternels de vos collègues soignants s'afficheront ici.
                </p>
              </div>
            ) : (
              filteredIncoming.map((item) => (
                <div
                  key={item._id}
                  onClick={() => setSelectedRelayId(item._id)}
                  className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                      {getStatusBadge(item.status)}
                      {item.urgencyLevel === "priority" ? (
                        <Badge className="bg-rose-600 text-white text-[10px] py-0">
                          Prioritaire
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="text-slate-500 text-[10px] py-0">
                          Standard
                        </Badge>
                      )}
                      <span className="text-[11px] text-slate-400">
                        {new Date(item.createdAt).toLocaleDateString()}
                      </span>
                    </div>

                    <h4 className="text-sm font-semibold text-slate-900 truncate">
                      {item.reason}
                    </h4>

                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                      {item.clinicalContext?.observations}
                    </p>

                    <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                      <span>
                        Patient : <strong className="text-slate-700">{item.patientName}</strong>
                      </span>
                      <span>
                        Demandeur : <strong className="text-slate-700">{item.requesterName}</strong> ({item.requesterSpecialty})
                      </span>
                      {item.attachmentCount > 0 && (
                        <span className="flex items-center gap-1 text-teal-600">
                          <FileText className="w-3.5 h-3.5" />
                          {item.attachmentCount} pièce(s)
                        </span>
                      )}
                      {item.messageCount > 0 && (
                        <span className="flex items-center gap-1 text-indigo-600">
                          <MessageSquare className="w-3.5 h-3.5" />
                          {item.messageCount} msg
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 rtl:rotate-180" />
                </div>
              ))
            )
          ) : filteredSent.length === 0 ? (
            <div className="p-12 text-center text-slate-400">
              <Send className="w-10 h-10 mx-auto mb-2 text-slate-300 stroke-[1.2]" />
              <p className="text-sm font-medium text-slate-600">{t("relay.empty_sent")}</p>
              <p className="text-xs text-slate-400 mt-1">
                Sollicitez l'avis d'un médecin ou d'un confrère pour sécuriser la prise en charge d'un patient.
              </p>
              <Button
                onClick={() => setIsCreateModalOpen(true)}
                className="mt-4 bg-teal-600 hover:bg-teal-700 text-white text-xs"
              >
                {t("relay.btn_new_request")}
              </Button>
            </div>
          ) : (
            filteredSent.map((item) => (
              <div
                key={item._id}
                onClick={() => setSelectedRelayId(item._id)}
                className="p-4 hover:bg-slate-50 transition-colors cursor-pointer flex items-center justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    {getStatusBadge(item.status)}
                    {item.urgencyLevel === "priority" ? (
                      <Badge className="bg-rose-600 text-white text-[10px] py-0">
                        Prioritaire
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 text-[10px] py-0">
                        Standard
                      </Badge>
                    )}
                    <span className="text-[11px] text-slate-400">
                      {new Date(item.createdAt).toLocaleDateString()}
                    </span>
                  </div>

                  <h4 className="text-sm font-semibold text-slate-900 truncate">
                    {item.reason}
                  </h4>

                  <p className="text-xs text-slate-500 mt-0.5 line-clamp-1">
                    {item.clinicalContext?.observations}
                  </p>

                  <div className="flex items-center gap-4 mt-2 text-[11px] text-slate-500">
                    <span>
                      Patient : <strong className="text-slate-700">{item.patientName}</strong>
                    </span>
                    <span>
                      Consultant :{" "}
                      {item.responderName ? (
                        <strong className="text-slate-700">{item.responderName} ({item.responderSpecialty})</strong>
                      ) : (
                        <span className="text-amber-600">Spécialité : {item.requestedSpecialty}</span>
                      )}
                    </span>
                    {item.messageCount > 0 && (
                      <span className="flex items-center gap-1 text-indigo-600">
                        <MessageSquare className="w-3.5 h-3.5" />
                        {item.messageCount} msg
                      </span>
                    )}
                  </div>
                </div>

                <ChevronRight className="w-5 h-5 text-slate-300 shrink-0 rtl:rotate-180" />
              </div>
            ))
          )}
        </div>
      </div>

      {/* Create Modal */}
      <CreateRelayModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={(id) => setSelectedRelayId(id)}
      />

      {/* Detail Modal */}
      <RelayDetailModal
        relayId={selectedRelayId}
        isOpen={Boolean(selectedRelayId)}
        onClose={() => setSelectedRelayId(null)}
      />
    </div>
  );
};
