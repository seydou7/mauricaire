import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useAuth } from "@/hooks/use-auth";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Shield,
  CheckCircle2,
  XCircle,
  AlertCircle,
  FileText,
  User,
  Phone,
  Mail,
  MapPin,
  Clock,
  ExternalLink,
  Loader2,
  Search,
  Filter,
  LogOut,
  ArrowLeft,
  Sparkles,
  AlertTriangle,
  History,
  FileCheck,
  Check,
  Building,
  DollarSign,
  Languages,
} from "lucide-react";
import { toast } from "sonner";

const COMPLEMENT_REASON_OPTIONS = [
  "Pièce d'identité illisible ou expirée",
  "Diplôme ou attestation professionnelle non conforme",
  "Numéro de licence non vérifiable auprès de l'Ordre",
  "Zones d'intervention ou tarifs non précisés",
  "Biographie insuffisante ou non conforme",
  "Autre motif (détaillé ci-dessous)",
];

export default function AdminPage() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language.startsWith("ar");
  const { user, role, isAdmin, isLoading: authLoading, isAuthenticated, signOut } = useAuth();
  const navigate = useNavigate();

  // Route Guard: Unauthenticated -> /auth, Patient/Professional -> /dashboard
  useEffect(() => {
    if (!authLoading) {
      if (!isAuthenticated || !user) {
        navigate("/auth", { replace: true });
      } else if (!isAdmin) {
        navigate("/dashboard", { replace: true });
      }
    }
  }, [authLoading, isAuthenticated, user, isAdmin, navigate]);

  const [activeTab, setActiveTab] = useState<
    "pending" | "under_review" | "complement_required" | "approved" | "rejected" | "all"
  >("pending");
  const [searchQuery, setSearchQuery] = useState("");

  // Rejection dialog state
  const [rejectModalOpen, setRejectModalOpen] = useState(false);
  const [selectedProviderId, setSelectedProviderId] = useState<any>(null);
  const [selectedProviderName, setSelectedProviderName] = useState("");
  const [rejectReason, setRejectReason] = useState("");
  const [isRejecting, setIsRejecting] = useState(false);

  // Complement dialog state
  const [complementModalOpen, setComplementModalOpen] = useState(false);
  const [selectedComplementId, setSelectedComplementId] = useState<any>(null);
  const [selectedComplementName, setSelectedComplementName] = useState("");
  const [selectedReasons, setSelectedReasons] = useState<string[]>([]);
  const [complementComment, setComplementComment] = useState("");
  const [isSubmittingComplement, setIsSubmittingComplement] = useState(false);

  // Detail dialog state
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [detailProviderId, setDetailProviderId] = useState<any>(null);

  // Approve action loading state
  const [approvingId, setApprovingId] = useState<string | null>(null);

  // Queries & Mutations
  const providers = useQuery(
    api.admin.getProvidersForVerification,
    isAdmin ? { filter: activeTab === "all" ? "all" : activeTab } : "skip"
  );

  const approveProviderMutation = useMutation(api.admin.approveProvider);
  const rejectProviderMutation = useMutation(api.admin.rejectProvider);
  const requestComplementMutation = useMutation(api.admin.requestDossierComplement);

  // 1. Loading state
  if (authLoading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          Vérification des accréditations administrateur...
        </p>
      </div>
    );
  }

  // 2. Unauthenticated
  if (!isAuthenticated || !user) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background p-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary mb-4" />
        <p className="text-sm font-medium text-muted-foreground">
          Redirection vers la page de connexion...
        </p>
      </div>
    );
  }

  // 3. Not Admin
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4" dir={isRtl ? "rtl" : "ltr"}>
        <Card className="max-w-md w-full border-destructive/20 shadow-xl text-center p-6">
          <div className="h-14 w-14 rounded-2xl bg-destructive/10 text-destructive flex items-center justify-center mx-auto mb-4">
            <Shield className="h-7 w-7" />
          </div>
          <CardTitle className="text-xl font-bold">Accès réservé aux administrateurs</CardTitle>
          <CardDescription className="mt-2 text-sm text-muted-foreground">
            Vous devez être authentifié avec un compte administrateur MauriCare pour accéder au portail de vérification.
          </CardDescription>
          <div className="mt-6 flex flex-col sm:flex-row gap-2 justify-center">
            <Button asChild variant="default" className="rounded-xl">
              <Link to="/dashboard">Retour au tableau de bord</Link>
            </Button>
            <Button asChild variant="outline" className="rounded-xl">
              <Link to="/">Retour à l'accueil</Link>
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  // Handle Approve
  const handleApprove = async (providerId: any, name: string) => {
    setApprovingId(providerId);
    try {
      await approveProviderMutation({ providerId });
      toast.success(`Le praticien ${name} a été approuvé avec succès.`);
      if (detailModalOpen && detailProviderId === providerId) {
        setDetailModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'approbation du professionnel.");
    } finally {
      setApprovingId(null);
    }
  };

  // Handle Reject
  const handleConfirmReject = async () => {
    if (!selectedProviderId) return;
    if (!rejectReason.trim()) {
      toast.error("Veuillez indiquer un motif de refus obligatoire.");
      return;
    }

    setIsRejecting(true);
    try {
      await rejectProviderMutation({
        providerId: selectedProviderId,
        reason: rejectReason.trim(),
      });
      toast.success(`La demande de ${selectedProviderName} a été rejetée.`);
      setRejectModalOpen(false);
      setSelectedProviderId(null);
      setRejectReason("");
      if (detailModalOpen && detailProviderId === selectedProviderId) {
        setDetailModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors du rejet du professionnel.");
    } finally {
      setIsRejecting(false);
    }
  };

  // Handle Request Complement
  const handleConfirmComplement = async () => {
    if (!selectedComplementId) return;
    if (selectedReasons.length === 0 && !complementComment.trim()) {
      toast.error("Veuillez sélectionner au moins un motif ou ajouter un commentaire.");
      return;
    }

    setIsSubmittingComplement(true);
    try {
      await requestComplementMutation({
        providerId: selectedComplementId,
        reasons: selectedReasons,
        comment: complementComment.trim() || undefined,
      });
      toast.success(`Une demande de complément a été transmise à ${selectedComplementName}.`);
      setComplementModalOpen(false);
      setSelectedComplementId(null);
      setSelectedReasons([]);
      setComplementComment("");
      if (detailModalOpen && detailProviderId === selectedComplementId) {
        setDetailModalOpen(false);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'envoi de la demande de complément.");
    } finally {
      setIsSubmittingComplement(false);
    }
  };

  const toggleComplementReason = (reason: string) => {
    if (selectedReasons.includes(reason)) {
      setSelectedReasons(selectedReasons.filter((r) => r !== reason));
    } else {
      setSelectedReasons([...selectedReasons, reason]);
    }
  };

  // Filter list by search query
  const filteredList = (providers || []).filter((p: any) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase().trim();
    return (
      p.name?.toLowerCase().includes(q) ||
      p.specialty?.toLowerCase().includes(q) ||
      p.licenseNumber?.toLowerCase().includes(q) ||
      p.city?.toLowerCase().includes(q) ||
      p.email?.toLowerCase().includes(q)
    );
  });

  const pendingCount = (providers || []).filter(
    (p: any) => p.verificationStatus === "pending" || p.onboardingStatus === "submitted"
  ).length;
  const complementCount = (providers || []).filter(
    (p: any) => p.onboardingStatus === "complement_required"
  ).length;

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col" dir={isRtl ? "rtl" : "ltr"}>
      {/* Top Admin Header */}
      <header className="sticky top-0 z-30 border-b border-border/40 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link to="/" className="flex items-center gap-2 group">
              <div className="h-9 w-9 rounded-xl bg-primary flex items-center justify-center text-primary-foreground font-bold shadow-md shadow-primary/20">
                MC
              </div>
              <div className="flex flex-col">
                <span className="font-bold text-sm tracking-tight">MauriCare</span>
                <span className="text-[10px] text-muted-foreground uppercase font-semibold tracking-wider">
                  Admin Console
                </span>
              </div>
            </Link>
            <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs hidden sm:inline-flex">
              <Shield className="h-3 w-3 mr-1" />
              {t("admin.official_accreditation", "Accréditation & Vérification")}
            </Badge>
          </div>

          <div className="flex items-center gap-3">
            <LanguageSwitcher />
            <div className="text-right hidden sm:block">
              <p className="text-xs font-semibold">{user.name || "Administrateur MauriCare"}</p>
              <p className="text-[10px] text-muted-foreground">{user.email}</p>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => signOut()}
              className="rounded-xl gap-1 text-xs border-border/40 hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30"
            >
              <LogOut className="h-3.5 w-3.5 rtl:rotate-180" />
              <span className="hidden sm:inline">{t("nav.logout", "Déconnexion")}</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 py-8 space-y-6">
        {/* Welcome Card */}
        <div className="rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/15 p-6 sm:p-8 relative overflow-hidden">
          <div className="max-w-2xl relative z-10 space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/15 text-primary text-xs font-semibold mb-1">
              <Sparkles className="h-3.5 w-3.5" />
              Contrôle & Régulation Professionnelle
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
              Vérification des Professionnels de Santé
            </h1>
            <p className="text-sm text-muted-foreground leading-relaxed">
              Examinez les dossiers d'accréditation, inspectez les pièces d'identité et diplômes d'État, demandez des compléments d'information et autorisez la parution au répertoire public.
            </p>
          </div>
        </div>

        {/* Controls and Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-4">
          {/* Tabs */}
          <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 overflow-x-auto">
            <button
              onClick={() => setActiveTab("pending")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "pending"
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t("admin.tab_pending", "En attente")}</span>
              {pendingCount > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {pendingCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("complement_required")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
                activeTab === "complement_required"
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <span>{t("admin.tab_complement", "Complément requis")}</span>
              {complementCount > 0 && (
                <span className="h-4 min-w-[16px] px-1 rounded-full bg-orange-500 text-white text-[10px] font-bold flex items-center justify-center">
                  {complementCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab("approved")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                activeTab === "approved"
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.tab_approved", "Approuvés")}
            </button>

            <button
              onClick={() => setActiveTab("rejected")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                activeTab === "rejected"
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.tab_rejected", "Rejetés")}
            </button>

            <button
              onClick={() => setActiveTab("all")}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all shrink-0 ${
                activeTab === "all"
                  ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {t("admin.tab_all", "Tous")}
            </button>
          </div>

          {/* Search box */}
          <div className="relative w-full sm:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Rechercher nom, licence, ville..."
              className="w-full h-9 pl-9 pr-4 rounded-xl border border-border/50 bg-card text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
          </div>
        </div>

        {/* Providers Table / Cards */}
        {providers === undefined ? (
          <div className="py-24 text-center space-y-3">
            <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto" />
            <p className="text-sm text-muted-foreground">Chargement des dossiers professionnels...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <Card className="border-dashed border-border/60 p-12 text-center">
            <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center mx-auto mb-3 text-muted-foreground">
              <CheckCircle2 className="h-6 w-6 text-emerald-500" />
            </div>
            <h3 className="text-base font-bold">Aucun dossier dans cette catégorie</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto mt-1">
              {activeTab === "pending"
                ? "Tous les soignants inscrits ont été traités. Aucun dossier en attente de vérification."
                : "Aucun profil soignant ne correspond aux critères sélectionnés."}
            </p>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredList.map((p: any) => {
              const status = p.onboardingStatus || (p.verified ? "approved" : "onboarding_incomplete");
              const isApproved = status === "approved" || p.verified;
              const isRejected = status === "rejected";
              const isComplement = status === "complement_required";
              const isPending = status === "submitted" || status === "under_review" || (!isApproved && !isRejected && !isComplement);

              return (
                <Card
                  key={p.providerId}
                  className="border-border/50 bg-card/90 backdrop-blur-sm shadow-sm hover:shadow-md transition-all flex flex-col justify-between"
                >
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <CardTitle className="text-base font-bold flex items-center gap-2">
                          {p.name}
                        </CardTitle>
                        <CardDescription className="text-xs capitalize mt-0.5">
                          {p.specialty?.replace("_", " ")} • {p.city}
                        </CardDescription>
                      </div>

                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 font-medium px-2 py-0.5 ${
                          isApproved
                            ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                            : isRejected
                            ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                            : isComplement
                            ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                            : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                        }`}
                      >
                        {isApproved
                          ? "Approuvé"
                          : isRejected
                          ? "Rejeté"
                          : isComplement
                          ? "Complément requis"
                          : "En attente"}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="space-y-3 text-xs flex-1">
                    <div className="space-y-1.5 bg-muted/25 p-3 rounded-xl border border-border/30">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">N° Licence</span>
                        <span className="font-mono font-semibold text-foreground">{p.licenseNumber || "Non renseigné"}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Expérience</span>
                        <span className="font-medium">{p.yearsOfExperience || 0} an(s)</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Tarif indicatif</span>
                        <span className="font-medium text-primary">
                          {p.consultationFee ? `${p.consultationFee} MRU` : "Non spécifié"}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Contact</span>
                        <span className="truncate max-w-[150px]">{p.phone || p.email}</span>
                      </div>
                    </div>

                    {/* Documents shortcut tags */}
                    <div className="space-y-1">
                      <span className="text-muted-foreground block text-[11px] font-medium">Justificatifs fournis :</span>
                      <div className="flex flex-wrap gap-1.5">
                        {p.identityDocUrl ? (
                          <a
                            href={p.identityDocUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-primary/10 text-primary text-[10px] font-medium hover:underline"
                          >
                            <FileText className="h-3 w-3" /> CNI / Passeport <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px]">
                            CNI manquante
                          </span>
                        )}

                        {p.proProofUrl ? (
                          <a
                            href={p.proProofUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 text-[10px] font-medium hover:underline"
                          >
                            <FileCheck className="h-3 w-3" /> Diplôme / Carte Pro <ExternalLink className="h-2.5 w-2.5" />
                          </a>
                        ) : (
                          <span className="px-2 py-0.5 rounded-md bg-muted text-muted-foreground text-[10px]">
                            Diplôme manquant
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Feedback notices */}
                    {isComplement && p.complementReasons && p.complementReasons.length > 0 && (
                      <div className="p-2.5 rounded-lg bg-orange-500/10 border border-orange-500/20 text-orange-700 dark:text-orange-300 text-[11px] space-y-0.5">
                        <span className="font-semibold block">Compléments demandés :</span>
                        <span>{p.complementReasons.join(", ")}</span>
                      </div>
                    )}

                    {isRejected && p.rejectionReason && (
                      <div className="p-2.5 rounded-lg bg-destructive/5 border border-destructive/20 text-destructive text-[11px] space-y-0.5">
                        <span className="font-semibold block">Motif de refus :</span>
                        <span>{p.rejectionReason}</span>
                      </div>
                    )}
                  </CardContent>

                  <div className="p-4 pt-0 border-t border-border/40 mt-3 flex items-center justify-between gap-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDetailProviderId(p.providerId);
                        setDetailModalOpen(true);
                      }}
                      className="text-xs h-8 px-2.5 rounded-lg text-muted-foreground hover:text-foreground"
                    >
                      Détails
                    </Button>

                    <div className="flex items-center gap-1.5 flex-wrap justify-end">
                      {/* Complement Request button */}
                      {!isApproved && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedComplementId(p.providerId);
                            setSelectedComplementName(p.name);
                            setSelectedReasons(p.complementReasons || []);
                            setComplementComment(p.adminComment || "");
                            setComplementModalOpen(true);
                          }}
                          className="text-xs h-8 px-2.5 rounded-lg border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                        >
                          <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                          Complément
                        </Button>
                      )}

                      {/* Reject button */}
                      {!isRejected && (
                        <Button
                          variant="destructive"
                          size="sm"
                          onClick={() => {
                            setSelectedProviderId(p.providerId);
                            setSelectedProviderName(p.name);
                            setRejectModalOpen(true);
                          }}
                          className="text-xs h-8 px-2.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20"
                        >
                          <XCircle className="h-3.5 w-3.5 mr-1" />
                          Rejeter
                        </Button>
                      )}

                      {/* Approve button */}
                      {!isApproved && (
                        <Button
                          size="sm"
                          disabled={approvingId === p.providerId}
                          onClick={() => handleApprove(p.providerId, p.name)}
                          className="text-xs h-8 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                        >
                          {approvingId === p.providerId ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                          ) : (
                            <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                          )}
                          Approuver
                        </Button>
                      )}
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      {/* Reject Confirmation Dialog */}
      <Dialog open={rejectModalOpen} onOpenChange={setRejectModalOpen}>
        <DialogContent className="sm:max-w-md bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              Rejeter la vérification professionnelle
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Voulez-vous rejeter l'accréditation de <strong>{selectedProviderName}</strong> ? Ce soignant restera invisible dans l'annuaire public.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2 py-2">
            <label className="text-xs font-semibold text-foreground">
              Motif du rejet (obligatoire, notifié au praticien) :
            </label>
            <textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Ex : Numéro de licence invalide ou non enregistré auprès de l'Ordre national des médecins/infirmiers."
              className="w-full p-2.5 rounded-xl border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-destructive/20"
            />
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setRejectModalOpen(false);
                setRejectReason("");
              }}
              disabled={isRejecting}
              className="rounded-xl text-xs"
            >
              Annuler
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleConfirmReject}
              disabled={isRejecting}
              className="rounded-xl text-xs"
            >
              {isRejecting ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Confirmer le rejet
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Request Complement Dialog */}
      <Dialog open={complementModalOpen} onOpenChange={setComplementModalOpen}>
        <DialogContent className="sm:max-w-lg bg-card">
          <DialogHeader>
            <DialogTitle className="text-base font-bold flex items-center gap-2 text-orange-600">
              <AlertTriangle className="h-5 w-5" />
              Demander un complément de dossier
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Spécifiez les points que <strong>{selectedComplementName}</strong> doit corriger ou compléter. Un courriel et une notification lui seront envoyés.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div className="space-y-2">
              <label className="font-semibold text-foreground block">
                Motifs fréquents à cocher :
              </label>
              <div className="space-y-1.5">
                {COMPLEMENT_REASON_OPTIONS.map((reason) => {
                  const checked = selectedReasons.includes(reason);
                  return (
                    <button
                      key={reason}
                      type="button"
                      onClick={() => toggleComplementReason(reason)}
                      className={`w-full p-2.5 rounded-xl border text-left flex items-center justify-between transition-all ${
                        checked
                          ? "bg-orange-500/10 border-orange-500/30 text-orange-950 dark:text-orange-200 font-semibold"
                          : "border-border/50 text-muted-foreground hover:bg-muted/40"
                      }`}
                    >
                      <span>{reason}</span>
                      {checked ? (
                        <Check className="h-4 w-4 text-orange-600" />
                      ) : (
                        <div className="h-4 w-4 rounded border border-border" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="font-semibold text-foreground block">
                Commentaires et consignes détaillées :
              </label>
              <textarea
                rows={3}
                value={complementComment}
                onChange={(e) => setComplementComment(e.target.value)}
                placeholder="Ex : Merci de téléverser une copie lisible de votre diplôme certifié ou de renseigner vos zones de garde à Nouakchott."
                className="w-full p-2.5 rounded-xl border border-border/60 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setComplementModalOpen(false);
                setSelectedReasons([]);
                setComplementComment("");
              }}
              disabled={isSubmittingComplement}
              className="rounded-xl text-xs"
            >
              Annuler
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={handleConfirmComplement}
              disabled={isSubmittingComplement}
              className="rounded-xl text-xs bg-orange-600 hover:bg-orange-700 text-white"
            >
              {isSubmittingComplement ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : null}
              Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Comprehensive Provider Dossier & History Modal */}
      {detailModalOpen && detailProviderId && (
        <ProviderDetailModal
          providerId={detailProviderId}
          onClose={() => {
            setDetailModalOpen(false);
            setDetailProviderId(null);
          }}
          onApprove={(name) => handleApprove(detailProviderId, name)}
          onRequestComplement={(name, reasons, comment) => {
            setSelectedComplementId(detailProviderId);
            setSelectedComplementName(name);
            setSelectedReasons(reasons || []);
            setComplementComment(comment || "");
            setComplementModalOpen(true);
          }}
          onReject={(name) => {
            setSelectedProviderId(detailProviderId);
            setSelectedProviderName(name);
            setRejectModalOpen(true);
          }}
        />
      )}
    </div>
  );
}

/**
 * Subcomponent to fetch and render single provider dossier details with documents and audit trail.
 */
function ProviderDetailModal({
  providerId,
  onClose,
  onApprove,
  onRequestComplement,
  onReject,
}: {
  providerId: any;
  onClose: () => void;
  onApprove: (name: string) => void;
  onRequestComplement: (name: string, reasons?: string[], comment?: string) => void;
  onReject: (name: string) => void;
}) {
  const details = useQuery(api.admin.getProviderVerificationDetails, { providerId });

  if (details === undefined) {
    return (
      <Dialog open onOpenChange={onClose}>
        <DialogContent className="sm:max-w-lg bg-card">
          <div className="py-12 flex flex-col items-center justify-center space-y-2">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">Chargement du dossier médical...</span>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isApproved = details.onboardingStatus === "approved" || details.verified;
  const isRejected = details.onboardingStatus === "rejected";
  const isComplement = details.onboardingStatus === "complement_required";

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="sm:max-w-2xl bg-card max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              {details.name}
            </DialogTitle>
            <Badge
              variant="outline"
              className={`text-xs ${
                isApproved
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : isRejected
                  ? "bg-rose-500/10 text-rose-600 border-rose-500/20"
                  : isComplement
                  ? "bg-orange-500/10 text-orange-600 border-orange-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              }`}
            >
              {isApproved
                ? "Agréé & Vérifié"
                : isRejected
                ? "Dossier Rejeté"
                : isComplement
                ? "Complément Requis"
                : "En cours d'examen"}
            </Badge>
          </div>
          <DialogDescription className="text-xs">
            Dossier d'accréditation complet, pièces justificatives et historique des décisions.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5 py-2 text-xs">
          {/* Section 1: Civil & Identity */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <User className="h-3.5 w-3.5 text-primary" /> Coordonnées Civiles & Identité
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/40">
              <div>
                <span className="text-muted-foreground block text-[11px]">Téléphone</span>
                <span className="font-semibold">{details.phone || "Non renseigné"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Email</span>
                <span className="font-semibold truncate block">{details.email || "Non renseigné"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Ville</span>
                <span className="font-semibold">{details.city || "Nouakchott"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Genre</span>
                <span className="font-semibold capitalize">{details.gender || "homme"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Date de naissance</span>
                <span className="font-semibold">{details.birthDate || "Non renseignée"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Adresse</span>
                <span className="font-semibold truncate block">{details.address || "Non renseignée"}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Professional & License */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <FileCheck className="h-3.5 w-3.5 text-primary" /> Qualification Médicale & Exercice
            </span>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-muted/30 p-3.5 rounded-xl border border-border/40">
              <div>
                <span className="text-muted-foreground block text-[11px]">Spécialité</span>
                <span className="font-semibold capitalize">{details.specialty?.replace("_", " ")}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Titre professionnel</span>
                <span className="font-semibold">{details.professionalTitle || "Soignant"}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">N° Licence / Ordre</span>
                <span className="font-mono font-semibold text-primary">{details.licenseNumber}</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Expérience</span>
                <span className="font-semibold">{details.yearsOfExperience || 0} an(s)</span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Tarif indicatif</span>
                <span className="font-semibold text-emerald-600">
                  {details.consultationFee ? `${details.consultationFee} MRU` : "Non spécifié"}
                </span>
              </div>
              <div>
                <span className="text-muted-foreground block text-[11px]">Disponibilité publique</span>
                <span className="font-semibold">{details.available ? "Active" : "Inactive"}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Zones and Languages */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-1">
              <span className="font-semibold text-foreground block">Zones d'intervention :</span>
              <div className="flex flex-wrap gap-1">
                {(details.interventionZones || []).map((zone: string) => (
                  <Badge key={zone} variant="secondary" className="text-[10px]">
                    {zone}
                  </Badge>
                ))}
              </div>
            </div>

            <div className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-1">
              <span className="font-semibold text-foreground block">Langues maîtrisées :</span>
              <div className="flex flex-wrap gap-1">
                {(details.languages || []).map((l: string) => (
                  <Badge key={l} variant="outline" className="text-[10px]">
                    {l}
                  </Badge>
                ))}
              </div>
            </div>
          </div>

          {/* Bio */}
          {details.bio && (
            <div className="space-y-1">
              <span className="font-semibold text-foreground block">Présentation / Biographie :</span>
              <p className="p-3 rounded-xl bg-muted/20 border border-border/30 text-muted-foreground leading-relaxed italic">
                "{details.bio}"
              </p>
            </div>
          )}

          {/* Section 4: Uploaded Private Documents */}
          <div className="space-y-2">
            <span className="font-semibold text-foreground flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5 text-primary" /> Pièces Justificatives Téléversées
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* Identity doc */}
              <div className="p-3 rounded-xl border border-border/40 bg-card flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-2">
                  <User className="h-4 w-4 text-primary shrink-0" />
                  <div className="truncate">
                    <p className="font-medium truncate">CNI / Passeport</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {details.identityDocumentName || "Fichier pièce d'identité"}
                    </p>
                  </div>
                </div>
                {details.identityDocUrl ? (
                  <Button asChild size="sm" variant="outline" className="text-xs h-7 rounded-lg gap-1 shrink-0">
                    <a href={details.identityDocUrl} target="_blank" rel="noopener noreferrer">
                      Ouvrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Non fourni</Badge>
                )}
              </div>

              {/* Professional proof doc */}
              <div className="p-3 rounded-xl border border-border/40 bg-card flex items-center justify-between">
                <div className="min-w-0 flex items-center gap-2">
                  <FileCheck className="h-4 w-4 text-emerald-600 shrink-0" />
                  <div className="truncate">
                    <p className="font-medium truncate">Diplôme / Carte Pro</p>
                    <p className="text-[10px] text-muted-foreground truncate">
                      {details.professionalProofName || "Fichier attestation"}
                    </p>
                  </div>
                </div>
                {details.proProofUrl ? (
                  <Button asChild size="sm" variant="outline" className="text-xs h-7 rounded-lg gap-1 shrink-0">
                    <a href={details.proProofUrl} target="_blank" rel="noopener noreferrer">
                      Ouvrir <ExternalLink className="h-3 w-3" />
                    </a>
                  </Button>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">Non fourni</Badge>
                )}
              </div>

              {/* Additional documents if any */}
              {details.documents && details.documents.length > 0 && (
                <div className="col-span-1 sm:col-span-2 space-y-1.5 pt-1">
                  <span className="text-[11px] font-semibold text-muted-foreground block">
                    Pièces justificatives indexées ({details.documents.length}) :
                  </span>
                  <div className="space-y-1.5">
                    {details.documents.map((doc: any) => (
                      <div
                        key={doc._id}
                        className="p-2.5 rounded-lg border border-border/30 bg-muted/10 flex items-center justify-between"
                      >
                        <div className="flex items-center gap-2 truncate">
                          <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                          <span className="text-xs truncate font-medium">{doc.originalName || doc.fileName || "Document"}</span>
                          <Badge variant="secondary" className="text-[9px] uppercase">
                            {doc.category === "identity"
                              ? "Identité"
                              : doc.category === "professional_proof"
                              ? "Preuve d'exercice"
                              : doc.category}
                          </Badge>
                        </div>
                        {doc.url && (
                          <Button
                            asChild
                            size="sm"
                            variant="ghost"
                            className="text-xs h-6 px-2 gap-1 shrink-0 text-primary hover:text-primary"
                          >
                            <a href={doc.url} target="_blank" rel="noopener noreferrer">
                              Ouvrir <ExternalLink className="h-3 w-3" />
                            </a>
                          </Button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Section 5: Verification Audit History Timeline */}
          {details.history && details.history.length > 0 && (
            <div className="space-y-2 pt-2 border-t border-border/40">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <History className="h-3.5 w-3.5 text-primary" /> Historique & Piste d'Audit
              </span>
              <div className="space-y-2">
                {details.history.map((h: any, i: number) => (
                  <div key={i} className="p-3 rounded-xl bg-muted/20 border border-border/30 space-y-1">
                    <div className="flex items-center justify-between text-[11px]">
                      <Badge variant="outline" className="text-[10px] uppercase font-bold tracking-wider">
                        {h.action.replace("_", " ")}
                      </Badge>
                      <span className="text-muted-foreground">
                        {new Date(h.createdAt).toLocaleDateString()} à {new Date(h.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>

                    {h.reasons && h.reasons.length > 0 && (
                      <p className="text-[11px] text-orange-700 dark:text-orange-300 font-medium">
                        Motifs : {h.reasons.join(", ")}
                      </p>
                    )}

                    {h.comment && (
                      <p className="text-[11px] text-muted-foreground italic">
                        "{h.comment}"
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between border-t border-border/40 pt-4">
          <Button variant="outline" size="sm" onClick={onClose} className="rounded-xl text-xs">
            Fermer
          </Button>

          <div className="flex items-center gap-1.5">
            {!isApproved && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => onRequestComplement(details.name, details.complementReasons, details.adminComment)}
                className="rounded-xl text-xs border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
              >
                <AlertTriangle className="h-3.5 w-3.5 mr-1" />
                Demander un complément
              </Button>
            )}

            {!isRejected && (
              <Button
                variant="destructive"
                size="sm"
                onClick={() => onReject(details.name)}
                className="rounded-xl text-xs bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 border border-rose-500/20"
              >
                <XCircle className="h-3.5 w-3.5 mr-1" />
                Rejeter
              </Button>
            )}

            {!isApproved && (
              <Button
                size="sm"
                onClick={() => onApprove(details.name)}
                className="rounded-xl text-xs bg-emerald-600 hover:bg-emerald-700 text-white"
              >
                <CheckCircle2 className="h-3.5 w-3.5 mr-1" />
                Approuver
              </Button>
            )}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
