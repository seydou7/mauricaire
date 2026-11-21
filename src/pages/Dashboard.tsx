import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  CardFooter,
} from "@/components/ui/card";
import {
  Activity,
  AlertCircle,
  Bell,
  Calendar,
  CalendarCheck,
  CalendarDays,
  ChartBar,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock,
  CreditCard,
  Download,
  Edit3,
  FileText,
  Filter,
  Globe,
  Heart,
  HeartPulse,
  History,
  LogOut,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  MessageSquare,
  MoreHorizontal,
  Phone,
  Plus,
  Search,
  Shield,
  Star,
  Stethoscope,
  Syringe,
  TrendingUp,
  User,
  Users,
  Video,
  X,
  XCircle,
  ArrowUpRight,
  ArrowLeft,
  DollarSign,
  Pill,
  Briefcase,
  CalendarPlus,
  Loader2,
  ExternalLink,
  Upload,
  Send,
  Repeat,
  HeartHandshake,
  Share2,
  FlaskConical,
} from "lucide-react";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import type { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router";
import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { toast } from "sonner";
import logo from "@/assets/logo.svg";
import { Separator } from "@/components/ui/separator";
import { BookingStepper } from "@/components/BookingStepper";
import { useAppointments } from "@/hooks/use-appointments";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ProviderAvailability } from "@/components/ProviderAvailability";
import { NewMessageModal } from "@/components/NewMessageModal";
import { ReviewModal } from "@/components/ReviewModal";
import { AppointmentDetailsModal } from "@/components/AppointmentDetailsModal";
import { ProfessionalOnboarding } from "@/components/ProfessionalOnboarding";
import { EmergencyContactTab } from "@/components/profile/EmergencyContactTab";
import { AccountSecurityTab } from "@/components/profile/AccountSecurityTab";
import { ProviderServicesTab } from "@/components/profile/ProviderServicesTab";
import { ProviderScheduleTab } from "@/components/profile/ProviderScheduleTab";
import { CircleManagement } from "@/components/circle/CircleManagement";
import { AccompaniedPatientsSection } from "@/components/circle/AccompaniedPatientsSection";
import { PendingCircleInvitationsCard } from "@/components/circle/PendingCircleInvitationsCard";
import { DelegatedPatientView } from "@/components/circle/DelegatedPatientView";
import { RelayInbox } from "@/components/relay/RelayInbox";
import { CreateRelayModal } from "@/components/relay/CreateRelayModal";
import { PatientRelayTimelineCard } from "@/components/relay/PatientRelayTimelineCard";
import { HomeLabManagement } from "@/components/homelab/HomeLabManagement";
import { CreateHomeLabRequestModal } from "@/components/homelab/CreateHomeLabRequestModal";
import { PatientHomeLabCard } from "@/components/homelab/PatientHomeLabCard";
import { ChronicManagement } from "@/components/chronic/ChronicManagement";
import { PatientChronicTimelineCard } from "@/components/chronic/PatientChronicTimelineCard";
import { VoiceAssistantFloatingButton } from "@/components/voice/VoiceAssistantFloatingButton";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "@/components/LanguageSwitcher";
import { getNormalizedLanguage } from "@/i18n";
import { getLocalizedServiceLabel, getLocalizedSpecialtyLabel } from "@/lib/services";
import { formatLocalizedActivity } from "@/lib/activity";

// ===================== TYPES =====================
type UserRole = "patient" | "professionnel";
type DashboardSection = "apercu" | "planning" | "reseau" | "messages" | "profil" | "demandes" | "patient-details" | "onboarding" | "circle" | "relay" | "homelab" | "chronic" | "circle-patient" | "patients";

interface PatientInfo {
  id: number;
  name: string;
  age: number;
  gender: string;
  condition: string;
  lastVisit: string;
  nextVisit: string;
  phone: string;
  address: string;
}

interface ProviderInfo {
  id: number;
  name: string;
  specialty: string;
  rating: number;
  reviews: number;
  distance: string;
  availability: string;
  phone: string;
  price: string;
  image: string;
}

interface StatCard {
  value: string;
  label: string;
  icon: React.ElementType;
  trend: string;
  trendUp: boolean;
}

interface Message {
  id: number;
  from: string;
  avatar: string;
  text: string;
  time: string;
  unread: boolean;
  attachments?: number;
}

// ===================== SIDEBAR NAV =====================
function getNavItems(
  role: UserRole,
  isApprovedPro: boolean = true,
  t?: any
): { id: DashboardSection; label: string; icon: React.ElementType }[] {
  const tr = t || ((_k: string, d?: string) => d || _k);

  if (role === "professionnel" && !isApprovedPro) {
    return [
      { id: "onboarding" as const, label: tr("nav.accreditation", "Accréditation & Dossier"), icon: Shield },
      { id: "profil" as const, label: tr("nav.profile", "Mon profil"), icon: User },
    ];
  }

  const base = [
    { id: "apercu" as const, label: tr("nav.overview", "Vue d'ensemble"), icon: ChartBar },
    { id: "planning" as const, label: tr("nav.planning", "Planning"), icon: CalendarDays },
    { id: "messages" as const, label: tr("nav.messages", "Messages"), icon: MessageSquare },
    { id: "profil" as const, label: tr("nav.profile", "Mon profil"), icon: User },
  ];

  if (role === "patient") {
    return [
      ...base.slice(0, 2),
      { id: "chronic" as const, label: tr("nav.chronic", "Suivi Santé"), icon: Activity },
      { id: "homelab" as const, label: tr("nav.homelab", "HomeLab (Analyses)"), icon: FlaskConical },
      { id: "reseau" as const, label: tr("nav.caregivers", "Soignants"), icon: Stethoscope },
      { id: "circle" as const, label: tr("nav.circle", "Cercle de proches"), icon: HeartHandshake },
      ...base.slice(2),
    ];
  }

  return [
    ...base.slice(0, 2),
    { id: "demandes" as const, label: tr("nav.requests", "Mes demandes"), icon: FileText },
    { id: "chronic" as const, label: tr("nav.chronic_pro", "Suivi Constantes"), icon: Activity },
    { id: "relay" as const, label: tr("nav.relay", "MauriCare Relay"), icon: Share2 },
    { id: "homelab" as const, label: tr("nav.homelab", "HomeLab"), icon: FlaskConical },
    { id: "patients" as const, label: tr("nav.patients", "Mes patients"), icon: Users },
    { id: "onboarding" as const, label: tr("nav.accreditation", "Accréditation"), icon: Shield },
    ...base.slice(2),
  ];
}

// ===================== SIDEBAR CONTENT =====================
function SidebarContent({
  initials,
  user,
  role,
  isApprovedPro = true,
  onboardingStatus,
  activeSection,
  onNavigate,
  onSignOut,
  onCloseMobile,
  unreadMessagesCount = 0,
  t,
}: {
  initials: string;
  user: any;
  role: UserRole;
  isApprovedPro?: boolean;
  onboardingStatus?: string;
  activeSection: DashboardSection;
  onNavigate: (id: DashboardSection) => void;
  onSignOut: () => void;
  onCloseMobile: () => void;
  unreadMessagesCount?: number;
  t: any;
}) {
  const navItems = getNavItems(role, isApprovedPro, t);

  const getFooterStatusText = () => {
    if (role === "patient") {
      return t("dashboard.footer.patient", "Patient • Mauritanie");
    }
    if (isApprovedPro) {
      return t("dashboard.footer.approved", "Professionnel agréé");
    }
    if (onboardingStatus === "complement_required") {
      return t("dashboard.footer.complement", "Complément requis");
    }
    if (onboardingStatus === "rejected") {
      return t("dashboard.footer.rejected", "Accréditation refusée");
    }
    return t("dashboard.footer.pending", "Accréditation en attente");
  };

  return (
    <div className="flex flex-col h-full">
      {/* Sidebar header */}
      <div className="flex items-center justify-between px-5 h-16 border-b border-border/30">
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center group-hover:bg-primary/15 transition-colors">
            <img src={logo} alt="MauriCare" className="h-5 w-5" />
          </div>
          <span className="font-semibold text-base tracking-tight">
            Mauri<span className="text-primary">Care</span>
          </span>
        </Link>
        <button
          onClick={onCloseMobile}
          className="lg:hidden p-1.5 rounded-lg hover:bg-accent transition-colors"
        >
          <X className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {/* Sidebar nav */}
      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              onClick={() => {
                onNavigate(item.id);
                onCloseMobile();
              }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-300 relative overflow-hidden ${
                activeSection === item.id
                  ? "bg-gradient-to-r from-primary/15 to-transparent rtl:bg-gradient-to-l text-primary shadow-[inset_2px_0_0_0_var(--theme-primary)] rtl:shadow-[inset_-2px_0_0_0_var(--theme-primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span className="truncate">{item.label}</span>
              {item.id === "messages" && unreadMessagesCount > 0 && (
                <span className="ms-auto h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  {unreadMessagesCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="px-3 py-4 border-t border-border/30 space-y-2">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {role === "professionnel" && user?.name === "Patient Test" ? "Praticien" : user?.name || "Utilisateur"}
            </p>
            <p className="text-[10px] text-muted-foreground truncate">
              {getFooterStatusText()}
            </p>
          </div>
        </div>

        <div className="pt-1">
          <LanguageSwitcher className="w-full justify-center text-xs" />
        </div>

        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5 rtl:rotate-180" />
          <span>{t("nav.logout", "Déconnexion")}</span>
        </button>
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function Dashboard() {
  const { t, i18n } = useTranslation();
  const currentLang = getNormalizedLanguage(i18n.language);
  const isRtl = currentLang === "ar";
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const role: UserRole = user?.role === "professionnel" ? "professionnel" : "patient";
  const [activeSection, setActiveSection] = useState<DashboardSection>("apercu");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [selectedAccompaniedPatientId, setSelectedAccompaniedPatientId] = useState<Id<"users"> | null>(null);
  const [searchParams, setSearchParams] = useSearchParams();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const sectionParam = searchParams.get("section") as DashboardSection | null;
    const patientIdParam = searchParams.get("patientId") as Id<"users"> | null;
    if (sectionParam === "circle-patient" && patientIdParam) {
      setSelectedAccompaniedPatientId(patientIdParam);
      setActiveSection("circle-patient");
    }
  }, [searchParams]);

  const handleOpenAccompaniedPatient = (patientId: Id<"users">) => {
    setSelectedAccompaniedPatientId(patientId);
    setActiveSection("circle-patient");
    setSearchParams({ section: "circle-patient", patientId });
  };

  const handleBackFromAccompaniedPatient = () => {
    setSelectedAccompaniedPatientId(null);
    setActiveSection("circle");
    setSearchParams({});
  };

  // Top-level query for provider record to gate professional dashboard access
  const currentProvider = useQuery(
    api.providers.getCurrentProvider,
    isAuthenticated && role === "professionnel" ? {} : "skip"
  );
  const isApprovedPro =
    role === "professionnel" &&
    currentProvider !== undefined &&
    currentProvider !== null &&
    Boolean(currentProvider.verified) &&
    (currentProvider.onboardingStatus === "approved" ||
      (!currentProvider.onboardingStatus && currentProvider.verificationStatus === "approved")) &&
    !user?.deactivatedAt &&
    !currentProvider.deactivated;

  // Guard for unapproved professional: strictly lock view to onboarding or profil only
  useEffect(() => {
    if (role === "professionnel" && currentProvider !== undefined && !isApprovedPro) {
      if (activeSection !== "onboarding" && activeSection !== "profil") {
        setActiveSection("onboarding");
      }
    }
  }, [role, currentProvider, isApprovedPro, activeSection]);

  const initials = user?.name
    ? user.name.split(" ").map((n: string) => n[0]).join("").toUpperCase().slice(0, 2)
    : "MC";

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  // Real-time unread notifications and messages counters
  const unreadNotificationsCount = useQuery(
    api.notifications.getUnreadCount,
    isAuthenticated ? {} : "skip"
  ) || 0;
  const notificationsList = useQuery(
    api.notifications.getForUser,
    isAuthenticated ? {} : "skip"
  ) || [];
  const conversationsList = useQuery(
    api.messages.getConversations,
    isAuthenticated ? {} : "skip"
  ) || [];
  const unreadMessagesCount = conversationsList.filter((c) => c.unreadCount > 0).length;

  const markNotificationRead = useMutation(api.notifications.markRead);
  const markAllNotificationsRead = useMutation(api.notifications.markAllRead);

  // ---- Guard / Redirect for Admin: Admin must NEVER render patient/pro dashboard ----
  useEffect(() => {
    if (!isLoading && isAuthenticated && user?.role === "admin") {
      navigate("/admin", { replace: true });
    }
  }, [isLoading, isAuthenticated, user, navigate]);

  if (!isLoading && isAuthenticated && user?.role === "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/[0.02]">
        <div className="flex flex-col items-center gap-4">
          <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
            <img src={logo} alt="MauriCare" className="h-7 w-7" />
          </div>
          <p className="text-sm font-medium text-foreground">Redirection vers l'administration...</p>
        </div>
      </div>
    );
  }

  // ---- Loading state ----
  if (isLoading || (isAuthenticated && role === "professionnel" && currentProvider === undefined)) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/[0.02]">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
              <img src={logo} alt="MauriCare" className="h-7 w-7" />
            </div>
            <div className="absolute -top-1 -right-1 h-4 w-4 rounded-full bg-primary animate-ping" />
          </div>
          <div className="space-y-2 text-center">
            <p className="text-sm font-medium text-foreground">{t("dashboard.loading", "Chargement du tableau de bord...")}</p>
            <p className="text-xs text-muted-foreground">{t("dashboard.preparing_secure_data", "Préparation de vos données sécurisées")}</p>
          </div>
        </div>
      </div>
    );
  }

  // ---- Unauthenticated ----
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-background via-background to-primary/[0.02] p-4">
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        >
          <Card className="max-w-md w-full text-center border-border/40 shadow-xl shadow-primary/5">
            <CardHeader className="pb-6">
              <div className="flex justify-center mb-4">
                <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center">
                  <Shield className="h-8 w-8 text-primary" />
                </div>
              </div>
              <CardTitle className="text-2xl">{t("dashboard.restricted_access_title", "Accès restreint")}</CardTitle>
              <CardDescription className="text-sm mt-2">
                {t("dashboard.restricted_access_desc", "Connectez-vous ou créez un compte pour accéder à votre tableau de bord MauriCare.")}
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6 space-y-3">
              <Link to="/auth">
                <Button size="lg" className="w-full rounded-xl gap-2 h-12 text-base shadow-lg shadow-primary/20">
                  {t("dashboard.sign_in", "Se connecter")}
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm" className="w-full rounded-xl text-muted-foreground">
                  {t("dashboard.back_home", "Retour à l'accueil")}
                </Button>
              </Link>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    );
  }

  const sidebarProps = {
    initials,
    user,
    role,
    isApprovedPro,
    onboardingStatus: currentProvider?.onboardingStatus,
    activeSection,
    onNavigate: setActiveSection,
    onSignOut: handleSignOut,
    onCloseMobile: () => setSidebarOpen(false),
    unreadMessagesCount,
    t,
  };

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="flex h-screen overflow-hidden bg-gradient-to-br from-background via-background to-primary/[0.02]"
    >
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 h-screen sticky top-0 bg-card border-r rtl:border-r-0 rtl:border-l border-border/40 overflow-y-auto z-30">
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ==================== MOBILE SIDEBAR OVERLAY ==================== */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* ==================== MOBILE SIDEBAR ==================== */}
      <aside
        className={`fixed inset-y-0 left-0 rtl:left-auto rtl:right-0 z-50 w-64 bg-card border-r rtl:border-r-0 rtl:border-l border-border/40 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full rtl:translate-x-full"
        }`}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-w-0 flex flex-col h-screen overflow-y-auto">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/5 shadow-sm shadow-primary/[0.02]">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors -ml-2 rtl:-mr-2 rtl:ml-0"
              >
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {getNavItems(role, isApprovedPro, t).find((n) => n.id === activeSection)?.label || t("nav.accreditation", "Accréditation")}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              {/* Language Switcher in Top Bar */}
              <LanguageSwitcher />

              {/* Notification Bell with interactive Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    aria-label={t("notifications.title", "Notifications")}
                    className="relative p-2 rounded-full hover:bg-primary/5 transition-colors focus:outline-none"
                  >
                    <BellIcon />
                    {unreadNotificationsCount > 0 && (
                      <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
                    )}
                  </button>
                </PopoverTrigger>
                <PopoverContent align={isRtl ? "start" : "end"} className="w-80 sm:w-96 p-0 shadow-xl border-border/40" dir={isRtl ? "rtl" : "ltr"}>
                  <div className="flex items-center justify-between p-3.5 border-b border-border/30 bg-muted/20">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm">{t("notifications.title", "Notifications")}</span>
                      {unreadNotificationsCount > 0 && (
                        <span className="text-[11px] px-1.5 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                          {unreadNotificationsCount}
                        </span>
                      )}
                    </div>
                    {unreadNotificationsCount > 0 && (
                      <button
                        onClick={() => markAllNotificationsRead()}
                        className="text-xs text-primary hover:underline font-medium"
                      >
                        {t("notifications.mark_all_read", "Tout marquer comme lu")}
                      </button>
                    )}
                  </div>

                  <div className="max-h-[350px] overflow-y-auto divide-y divide-border/20">
                    {notificationsList.length === 0 ? (
                      <div className="p-6 text-center text-xs text-muted-foreground">
                        {t("notifications.empty", "Aucune notification pour le moment.")}
                      </div>
                    ) : (
                      notificationsList.map((notif) => {
                        const isAr = currentLang === "ar";
                        const displayTitle = isAr && (notif as any).titleAr ? (notif as any).titleAr : notif.title;
                        const displayMessage = isAr && (notif as any).messageAr ? (notif as any).messageAr : notif.message;
                        return (
                        <div
                          key={notif._id}
                          onClick={() => {
                            if (!notif.read) {
                              markNotificationRead({ notificationId: notif._id });
                            }
                          }}
                          className={`p-3 text-left rtl:text-right transition-colors cursor-pointer hover:bg-muted/30 ${
                            !notif.read ? "bg-primary/[0.04]" : ""
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <p className={`text-xs ${!notif.read ? "font-bold text-foreground" : "font-medium text-foreground/80"}`}>
                              {displayTitle}
                            </p>
                            {!notif.read && (
                              <span className="h-1.5 w-1.5 rounded-full bg-primary shrink-0 mt-1" />
                            )}
                          </div>
                          <p className="text-[11px] text-muted-foreground mt-0.5 leading-relaxed">
                            {displayMessage}
                          </p>
                          <p className="text-[9px] text-muted-foreground/60 mt-1">
                            {new Date(notif._creationTime).toLocaleDateString(currentLang === "ar" ? "ar-MR" : "fr-FR", {
                              hour: "2-digit",
                              minute: "2-digit",
                              day: "numeric",
                              month: "short",
                            })}
                          </p>
                        </div>
                      );})
                    )}
                  </div>
                </PopoverContent>
              </Popover>

              <DropdownMenu dir={isRtl ? "rtl" : "ltr"}>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10 outline-none">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                      {initials}
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align={isRtl ? "start" : "end"} className="w-56">
                  <DropdownMenuLabel>{t("nav.my_account", "Mon compte")}</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveSection("profil")} className="cursor-pointer gap-2">
                    <User className="h-4 w-4" />
                    <span>{t("nav.profile", "Mon Profil")}</span>
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => i18n.changeLanguage(isRtl ? "fr" : "ar")} className="cursor-pointer gap-2">
                    <Globe className="h-4 w-4" />
                    <span>{isRtl ? "Passer en Français" : "التبديل إلى العربية"}</span>
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer gap-2">
                    <LogOut className="h-4 w-4 rtl:rotate-180" />
                    <span>{t("nav.logout", "Déconnexion")}</span>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          {role === "professionnel" && !isApprovedPro ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={`unapproved-${activeSection}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeSection === "profil" ? (
                  <ProfilSection role={role} user={user} initials={initials} signOut={handleSignOut} />
                ) : (
                  <ProfessionalOnboarding onSuccess={() => setActiveSection("planning")} />
                )}
              </motion.div>
            </AnimatePresence>
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${role}-${activeSection}`}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
              >
                {activeSection === "apercu" && (
                  <Apercu
                    role={role}
                    user={user}
                    initials={initials}
                    onNavigate={setActiveSection}
                    onSelectAccompaniedPatient={handleOpenAccompaniedPatient}
                  />
                )}
                {activeSection === "planning" && <Planning role={role} user={user} />}
                {activeSection === "demandes" && <DemandesSection />}
                {activeSection === "relay" && <RelayInbox />}
                {activeSection === "homelab" && <HomeLabManagement role={role} userId={user?._id} />}
                {activeSection === "chronic" && (
                  <ChronicManagement
                    role={role}
                    userId={user?._id}
                    initialPatientId={selectedPatientId || undefined}
                  />
                )}
                {activeSection === "patients" && (
                  <MesPatientsSection
                    onNavigateToPatient={(id) => {
                      setSelectedPatientId(id);
                      setActiveSection("patient-details");
                    }}
                  />
                )}
                {activeSection === "reseau" && (
                  role === "patient" ? (
                    <SoignantsSection onNavigate={setActiveSection} />
                  ) : (
                    <MesPatientsSection
                      onNavigateToPatient={(id) => {
                        setSelectedPatientId(id);
                        setActiveSection("patient-details");
                      }}
                    />
                  )
                )}
                {activeSection === "patient-details" && selectedPatientId && (
                  <PatientDetailsSection
                    patientId={selectedPatientId}
                    onBack={() => setActiveSection(role === "professionnel" ? "patients" : "reseau")}
                  />
                )}
                {activeSection === "messages" && <MessagesSection role={role} user={user} />}
                {activeSection === "profil" && <ProfilSection role={role} user={user} initials={initials} signOut={handleSignOut} />}
                {activeSection === "circle" && <CircleManagement onSelectAccompaniedPatient={handleOpenAccompaniedPatient} />}
                {activeSection === "circle-patient" && selectedAccompaniedPatientId && (
                  <DelegatedPatientView
                    patientId={selectedAccompaniedPatientId}
                    onBack={handleBackFromAccompaniedPatient}
                    onNavigate={setActiveSection}
                  />
                )}
                {activeSection === "onboarding" && <ProfessionalOnboarding onSuccess={() => setActiveSection("planning")} />}
              </motion.div>
            </AnimatePresence>
          )}
        </main>
      </div>

      {/* MauriCare Voice AI - Orchestration vocale & conversationnelle (Module 9) */}
      {(role === "patient" || isApprovedPro) && (
        <VoiceAssistantFloatingButton
          onNavigateToSection={(s) => setActiveSection(s as any)}
          activePatientId={selectedPatientId}
          currentSection={activeSection}
        />
      )}
    </div>
  );
}

// ===================== BELL ICON COMPONENT =====================
function BellIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="text-muted-foreground"
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0" />
    </svg>
  );
}

// ===================== VUE D'ENSEMBLE =====================
function Apercu({
  role,
  user,
  initials,
  onNavigate,
  onSelectAccompaniedPatient,
}: {
  role: UserRole;
  user: any;
  initials: string;
  onNavigate: (id: DashboardSection) => void;
  onSelectAccompaniedPatient?: (patientId: Id<"users">) => void;
}) {
  if (role === "patient")
    return (
      <ApercuPatient
        user={user}
        initials={initials}
        onNavigate={onNavigate}
        onSelectAccompaniedPatient={onSelectAccompaniedPatient}
      />
    );
  return <ApercuProfessionnel user={user} initials={initials} onNavigate={onNavigate} />;
}

function ApercuPatient({
  user,
  initials,
  onNavigate,
  onSelectAccompaniedPatient,
}: {
  user: any;
  initials: string;
  onNavigate: (id: DashboardSection) => void;
  onSelectAccompaniedPatient?: (patientId: Id<"users">) => void;
}) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language?.startsWith("ar");
  const localeCode = isRtl ? "ar-MR" : "fr-FR";
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString(localeCode, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const { patientAppointments } = useAppointments();
  const appointments = patientAppointments;
  const upcomingCount = patientAppointments.filter(
    (a) => a.status === "confirme" || a.status === "en_attente"
  ).length;
  const completedCount = patientAppointments.filter(
    (a) => a.status === "termine"
  ).length;
  const myCaregivers = useQuery(api.providers.getMyCaregivers) ?? [];
  const myProfile = useQuery(api.patientRecords.getMyProfile);
  const documentsCount = myProfile?.documents?.length ?? 0;

  const stats: StatCard[] = [
    { value: String(myCaregivers.length), label: t("dashboard.stats.caregivers_consulted", "Soignants consultés"), icon: Stethoscope, trend: t("dashboard.trends.history", "Historique"), trendUp: true },
    { value: String(completedCount), label: t("dashboard.stats.consultations_completed", "Consultations terminées"), icon: CalendarCheck, trend: t("dashboard.trends.up_to_date", "À jour"), trendUp: true },
    { value: String(documentsCount), label: t("dashboard.stats.medical_documents", "Documents médicaux"), icon: FileText, trend: t("dashboard.trends.dossier", "Dossier"), trendUp: true },
    { value: String(upcomingCount), label: t("dashboard.stats.upcoming_appointments", "Prochains rendez-vous"), icon: Calendar, trend: t("dashboard.trends.scheduled", "Planifié"), trendUp: true },
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 sm:p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t("dashboard.welcome_greeting", { name: user?.name?.split(" ")[0] || t("dashboard.dear_patient", "Cher Patient"), defaultValue: `Bonjour, ${user?.name?.split(" ")[0] || "Cher Patient"}` })}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {today.charAt(0).toUpperCase() + today.slice(1)} • {t("dashboard.care_motto", "Nous sommes là pour prendre soin de vous")}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <BookingStepper>
              <Button size="sm" className="rounded-xl gap-1.5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                <CalendarCheck className="h-4 w-4" />
                {t("appointments.new_appointment", "Nouveau rendez-vous")}
              </Button>
            </BookingStepper>
            <Button size="sm" variant="outline" onClick={() => onNavigate("reseau")} className="rounded-xl gap-1.5 border-primary/20 hover:bg-primary/5">
              <Search className="h-4 w-4" />
              {t("appointments.find_caregiver", "Trouver un soignant")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Invitations reçues au Cercle de proches (Module 5) */}
      <PendingCircleInvitationsCard />

      {/* Personnes que j'accompagne (MauriCare Circle - Module 5) */}
      <AccompaniedPatientsSection
        onSelectAccompaniedPatient={onSelectAccompaniedPatient}
        onViewBeneficiaryAppointments={onSelectAccompaniedPatient}
      />

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <Card className="border-primary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-xl shadow-lg shadow-primary/5 hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Icon className="h-24 w-24" />
                </div>
                <CardContent className="p-5 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {stat.label}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* My providers */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card className="border-border/40 shadow-md shadow-primary/5 bg-card/80 backdrop-blur-xl hover:border-primary/10 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-primary" />
                  {t("dashboard.my_caregivers", "Mes soignants")}
                </CardTitle>
                <CardDescription>{t("dashboard.caregivers_following_you", "Professionnels qui vous suivent")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg" onClick={() => onNavigate("reseau")}>
                {t("common.see_all", "Voir tout")} <ChevronRight className="h-3 w-3 ml-1 rtl:mr-1 rtl:ml-0 rtl:rotate-180" />
              </Button>
            </CardHeader>
            <CardContent>
              {myCaregivers.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/40">
                  {t("dashboard.no_caregivers_history", "Aucun soignant dans votre historique. Vos soignants apparaîtront ici dès qu'une première consultation aura été clôturée.")}
                </div>
              ) : (
                <div className="space-y-3">
                  {myCaregivers.slice(0, 4).map((prov, i) => {
                    const name = prov.user?.name || "Professionnel de santé";
                    const pInitials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "MC";
                    return (
                      <motion.div
                        key={prov._id}
                        onClick={() => navigate(`/provider/${prov._id}`)}
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-primary/[0.02] border border-border/40 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                            {prov.user?.image && prov.user.image.startsWith("http") ? (
                              <img src={prov.user.image} alt={name} className="h-full w-full object-cover" />
                            ) : (
                              pInitials
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{name}</p>
                            <p className="text-xs text-muted-foreground">{getLocalizedSpecialtyLabel(prov.specialty, i18n.language)}</p>
                          </div>
                        </div>
                        <div className="text-right rtl:text-left">
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-2 py-0.5"
                          >
                            {prov.completedCount} {t("dashboard.consultation", { count: prov.completedCount, defaultValue: "consultation" })}
                          </Badge>
                          <p className="text-[10px] text-muted-foreground mt-1">{t("dashboard.last_consultation_prefix", "Dernière : ")}{prov.lastConsultationDate}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>

        {/* Upcoming appointments */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="border-border/40 shadow-md shadow-primary/5 bg-card/80 backdrop-blur-xl hover:border-primary/10 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-primary" />
                  {t("dashboard.my_upcoming_appointments", "Mes prochains rendez-vous")}
                </CardTitle>
                <CardDescription>{t("dashboard.upcoming_consultations", "Consultations à venir")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("planning")} className="text-xs rounded-lg">
                {t("common.see_all", "Voir tout")} <ChevronRight className="h-3 w-3 ml-1 rtl:mr-1 rtl:ml-0 rtl:rotate-180" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appointments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/50">
                    {t("dashboard.no_appointments_scheduled", "Aucun rendez-vous planifié pour le moment.")}
                  </div>
                ) : (
                  appointments.map((appt, i) => (
                    <AppointmentDetailsModal key={appt.id || appt._id} appointment={appt} role="patient">
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-primary/[0.02] border border-border/40 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                            {(appt.name || appt.providerName || "S").split(" ").map((n: string) => n[0]).join("")}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{appt.name || appt.providerName}</p>
                            <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                              <span>{getLocalizedServiceLabel(appt.serviceSnapshot?.name || appt.serviceType || appt.type, i18n.language)}</span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span>{appt.date || appt.day}</span>
                              <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                              <span>{appt.time}</span>
                            </div>
                          </div>
                        </div>
                        <Badge
                          variant={appt.status === "confirme" ? "default" : "secondary"}
                          className={`text-[10px] px-2 py-0.5 ${
                            appt.status === "confirme"
                              ? "bg-emerald-600 text-white"
                              : appt.status === "annule"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {appt.status === "confirme"
                            ? t("status.confirme", "Confirmé")
                            : appt.status === "annule"
                            ? t("status.annule", "Annulé")
                            : t("status.en_attente", "En attente")}
                        </Badge>
                      </motion.div>
                    </AppointmentDetailsModal>
                  ))
                )}
                <BookingStepper>
                  <Button variant="outline" size="sm" className="w-full mt-2 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    {t("appointments.schedule_care", "Planifier une consultation")}
                  </Button>
                </BookingStepper>
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Quick health summary */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <HeartPulse className="h-4 w-4 text-primary" />
              {t("dashboard.my_health_summary", "Mon suivi santé")}
            </CardTitle>
            <CardDescription>{t("dashboard.medical_record_overview", "Aperçu de votre dossier médical")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs font-semibold">{t("dashboard.last_consultation", "Dernière consultation")}</span>
                </div>
                <p className="text-2xl font-bold">
                  {myCaregivers.length > 0 ? myCaregivers[0].lastConsultationDate : "-"}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {myCaregivers.length > 0
                    ? t("dashboard.with_caregiver", { name: myCaregivers[0].user?.name || "Soignant MauriCare", defaultValue: `Avec ${myCaregivers[0].user?.name || "Soignant MauriCare"}` })
                    : t("dashboard.no_completed_consultations", "Aucune consultation terminée")}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <FileText className="h-4 w-4" />
                  <span className="text-xs font-semibold">{t("dashboard.medical_documents", "Documents médicaux")}</span>
                </div>
                <p className="text-2xl font-bold">{documentsCount}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {documentsCount > 0 ? t("dashboard.documents_in_record", { count: documentsCount, defaultValue: `${documentsCount} document(s) au dossier` }) : t("dashboard.no_documents", "Aucun document")}
                </p>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Stethoscope className="h-4 w-4" />
                  <span className="text-xs font-semibold">{t("dashboard.attending_caregivers", "Soignants traitants")}</span>
                </div>
                <p className="text-2xl font-bold">{myCaregivers.length}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {myCaregivers.length > 0
                    ? t("dashboard.caregivers_in_team", { count: myCaregivers.length, defaultValue: `${myCaregivers.length} soignant(s) dans votre équipe` })
                    : t("dashboard.no_attending_caregiver", "Aucun soignant traitant")}
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* MauriCare Relay - Coordination de soins & avis confraternels (Module 6) */}
      {user?._id && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.4 }}
        >
          <PatientRelayTimelineCard patientId={user._id} />
        </motion.div>
      )}

      {/* MauriCare HomeLab - Analyses & bilans médicaux à domicile (Module 7) */}
      {user?._id && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.35, duration: 0.4 }}
        >
          <PatientHomeLabCard patientId={user._id} />
        </motion.div>
      )}

      {/* MauriCare Chronic - Suivi longitudinal des constantes (Module 8) */}
      {user?._id && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38, duration: 0.4 }}
        >
          <PatientChronicTimelineCard patientId={user._id} onNavigateToChronic={() => onNavigate("chronic")} />
        </motion.div>
      )}
    </div>
  );
}

function ApercuProfessionnel({ user, initials, onNavigate }: { user: any; initials: string; onNavigate: (id: DashboardSection) => void }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language?.startsWith("ar");
  const localeCode = isRtl ? "ar-MR" : "fr-FR";
  const navigate = useNavigate();
  const { pendingDemandes, proAppointments } = useAppointments();
  const appointments = proAppointments;
  const today = new Date().toLocaleDateString(localeCode, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const confirmedCount = proAppointments.filter((a) => a.status === "confirme").length;

  const realPatients = useQuery(api.patientRecords.getPatientsForProvider) || [];
  const currentProvider = useQuery(api.providers.getCurrentProvider);
  const notifications = useQuery(api.notifications.getForUser) || [];

  const stats: StatCard[] = [
    { value: String(confirmedCount), label: t("dashboard.stats.confirmed_consultations", "Consultations confirmées"), icon: Activity, trend: t("dashboard.trends.upcoming", "À venir"), trendUp: true },
    { value: String(realPatients.length), label: t("dashboard.stats.monitored_patients", "Patients suivis"), icon: Users, trend: t("dashboard.trends.care_relation", "Relation de soins"), trendUp: true },
    { value: currentProvider?.rating ? currentProvider.rating.toFixed(1) : "5.0", label: t("dashboard.stats.average_rating", "Note moyenne"), icon: Star, trend: `${currentProvider?.reviewCount ?? 0} ${t("dashboard.reviews", "avis")}`, trendUp: true },
    { value: currentProvider?.consultationFee ? `${currentProvider.consultationFee.toLocaleString(localeCode)} MRU` : "—", label: t("dashboard.stats.consultation_fee", "Tarif consultation"), icon: DollarSign, trend: t("dashboard.trends.per_act", "Par acte"), trendUp: true },
  ];

  const recentActivity = notifications.slice(0, 4).map((n: any) => ({
    id: n._id,
    text: formatLocalizedActivity(n, i18n.language),
    time: new Date(n._creationTime).toLocaleTimeString(localeCode, { hour: "2-digit", minute: "2-digit" }),
    type: n.type === "alert" ? ("alert" as const) : ("check" as const),
  }));

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Welcome banner */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/10 p-6 sm:p-8"
      >
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full -translate-y-1/2 translate-x-1/4 blur-3xl" />
        <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center text-lg font-bold text-primary shrink-0">
              {initials}
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight">
                {t("dashboard.welcome_pro", { name: user?.name === "Patient Test" ? t("dashboard.practitioner", "Praticien") : (user?.name?.split(" ")[0] || t("dashboard.practitioner", "Cher Praticien")), defaultValue: `Bonjour, ${user?.name === "Patient Test" ? "Praticien" : (user?.name?.split(" ")[0] || "Cher Praticien")}` })}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {today.charAt(0).toUpperCase() + today.slice(1)} • {t("dashboard.consultations_today", { count: appointments.length || 3, defaultValue: `${appointments.length || 3} consultations aujourd'hui` })}
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onNavigate("demandes")} className="rounded-xl gap-1.5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground relative">
              {pendingDemandes.length > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-destructive text-[9px] font-bold text-white shadow-sm ring-2 ring-background">
                  {pendingDemandes.length}
                </span>
              )}
              <Bell className="h-4 w-4" />
              {t("nav.requests", "Mes demandes")}
            </Button>
            <Button size="sm" variant="outline" onClick={() => onNavigate("patients")} className="rounded-xl gap-1.5">
              <Users className="h-4 w-4" />
              {t("nav.patients", "Mes patients")}
            </Button>
          </div>
        </div>
      </motion.div>

      {/* Verification / Accreditation Banner if not fully approved */}
      {currentProvider && (!currentProvider.verified || currentProvider.onboardingStatus !== "approved") && (
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className={`p-5 rounded-2xl border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            currentProvider.onboardingStatus === "complement_required"
              ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
              : currentProvider.onboardingStatus === "rejected"
              ? "bg-rose-500/10 border-rose-500/30 text-rose-950 dark:text-rose-200"
              : currentProvider.onboardingStatus === "submitted" || currentProvider.onboardingStatus === "under_review"
              ? "bg-primary/10 border-primary/20 text-foreground"
              : "bg-muted/40 border-border/50 text-foreground"
          }`}
        >
          <div className="flex items-start gap-3">
            <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${
              currentProvider.onboardingStatus === "complement_required"
                ? "bg-amber-500/20 text-amber-600"
                : currentProvider.onboardingStatus === "rejected"
                ? "bg-rose-500/20 text-rose-600"
                : "bg-primary/20 text-primary"
            }`}>
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold">
                  {currentProvider.onboardingStatus === "complement_required"
                    ? t("dashboard.accreditation.complement_title", "Complément d'information requis")
                    : currentProvider.onboardingStatus === "rejected"
                    ? t("dashboard.accreditation.rejected_title", "Dossier d'accréditation non retenu")
                    : currentProvider.onboardingStatus === "submitted" || currentProvider.onboardingStatus === "under_review"
                    ? t("dashboard.accreditation.under_review_title", "Dossier en cours d'examen administratif")
                    : t("dashboard.accreditation.finalize_title", "Finalisez votre accréditation soignant")}
                </h3>
                <Badge variant="outline" className="text-[10px] capitalize">
                  {currentProvider.onboardingStatus === "complement_required"
                    ? t("dashboard.accreditation.action_required", "Action requise")
                    : currentProvider.onboardingStatus === "submitted" || currentProvider.onboardingStatus === "under_review"
                    ? t("dashboard.accreditation.in_progress", "En cours")
                    : t("dashboard.accreditation.to_complete", "À compléter")}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5 max-w-xl">
                {currentProvider.onboardingStatus === "complement_required"
                  ? t("dashboard.accreditation.complement_desc", "L'équipe de régulation médicale a demandé des précisions ou pièces complémentaires pour valider votre dossier.")
                  : currentProvider.onboardingStatus === "submitted" || currentProvider.onboardingStatus === "under_review"
                  ? t("dashboard.accreditation.under_review_desc", "Vos pièces justificatives et votre licence sont en cours de contrôle. Vous recevrez une alerte dès l'activation publique.")
                  : t("dashboard.accreditation.finalize_desc", "Téléversez votre pièce d'identité et votre justificatif professionnel pour que votre profil soit vérifié et visible.")}
              </p>
            </div>
          </div>
          <Button
            size="sm"
            onClick={() => onNavigate("onboarding")}
            className="rounded-xl text-xs gap-1.5 shrink-0 self-end sm:self-auto shadow-sm"
          >
            <span>
              {currentProvider.onboardingStatus === "complement_required"
                ? t("dashboard.accreditation.fix_dossier", "Corriger mon dossier")
                : currentProvider.onboardingStatus === "submitted" || currentProvider.onboardingStatus === "under_review"
                ? t("dashboard.accreditation.view_status", "Voir le statut")
                : t("dashboard.accreditation.complete_dossier", "Compléter mon dossier")}
            </span>
            <ChevronRight className="h-3.5 w-3.5" />
          </Button>
        </motion.div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((stat, i) => {
          const Icon = stat.icon;
          return (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06, duration: 0.4 }}
            >
              <Card className="border-primary/10 bg-gradient-to-br from-card to-card/50 backdrop-blur-xl shadow-lg shadow-primary/5 hover:shadow-primary/10 hover:-translate-y-1 transition-all duration-300 overflow-hidden relative">
                <div className="absolute top-0 right-0 p-4 opacity-5 pointer-events-none">
                  <Icon className="h-24 w-24" />
                </div>
                <CardContent className="p-5 relative z-10">
                  <div className="flex items-start justify-between">
                    <div className="space-y-2">
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                        {stat.label}
                      </p>
                      <p className="text-2xl sm:text-3xl font-bold tracking-tight">{stat.value}</p>
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-4 w-4 text-primary" />
                    </div>
                  </div>
                  <div className="flex items-center gap-1 mt-3 text-xs">
                    <TrendingUp className={`h-3 w-3 ${stat.trendUp ? "text-emerald-500" : "text-red-500"}`} />
                    <span className={stat.trendUp ? "text-emerald-500 font-medium" : "text-red-500 font-medium"}>
                      {stat.trend}
                    </span>
                    <span className="text-muted-foreground">{t("dashboard.vs_last_month", "vs mois dernier")}</span>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          );
        })}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Today's schedule */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.4 }}
        >
          <Card className="border-border/40 shadow-md shadow-primary/5 bg-card/80 backdrop-blur-xl hover:border-primary/10 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Clock className="h-4 w-4 text-primary" />
                  {t("dashboard.today_consultations", "Consultations du jour")}
                </CardTitle>
                <CardDescription>
                  {appointments.length > 1
                    ? t("dashboard.consultation_count_plural", { count: appointments.length })
                    : t("dashboard.consultation_count", { count: appointments.length })}
                </CardDescription>
              </div>
              <Button variant="ghost" size="sm" onClick={() => onNavigate("planning")} className="text-xs rounded-lg">
                {t("common.see_all", "Voir tout")} <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appointments.length === 0 ? (
                  <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/50">
                    {t("dashboard.no_consultations_today", "Aucune consultation planifiée pour le moment.")}
                  </div>
                ) : (
                  appointments.map((appt, i) => (
                    <AppointmentDetailsModal key={appt.id || appt._id} appointment={appt} role="professionnel">
                      <motion.div
                        initial={{ opacity: 0, x: -8 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.06 }}
                        className="flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-primary/[0.02] border border-border/40 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <div className="text-center min-w-[48px]">
                            <p className="text-xs font-bold text-primary">{appt.time}</p>
                            <p className="text-[10px] text-muted-foreground">{appt.duration}</p>
                          </div>
                          <div className="h-8 w-[2px] bg-primary/20 rounded-full" />
                          <div>
                            <p className="text-sm font-medium">{appt.patient || appt.name || "Patient"}</p>
                            <p className="text-xs text-muted-foreground">{appt.type} • {appt.day || appt.date}</p>
                          </div>
                        </div>
                        <Badge
                          variant={appt.status === "confirme" ? "default" : "secondary"}
                          className={`text-[10px] px-2 py-0.5 ${
                            appt.status === "confirme"
                              ? "bg-emerald-600 text-white"
                              : appt.status === "annule"
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : "bg-amber-500/10 text-amber-600 border-amber-500/20"
                          }`}
                        >
                          {appt.status === "confirme"
                            ? t("status.confirme", "Confirmé")
                            : appt.status === "annule"
                            ? t("status.annule", "Annulé")
                            : t("status.en_attente", "En attente")}
                        </Badge>
                      </motion.div>
                    </AppointmentDetailsModal>
                  ))
                )}
                <Button variant="outline" size="sm" className="w-full mt-2 rounded-xl border-dashed border-border/50 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  {t("dashboard.add_slot", "Ajouter un créneau")}
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Recent activity */}
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2, duration: 0.4 }}
        >
          <Card className="border-border/40 shadow-md shadow-primary/5 bg-card/80 backdrop-blur-xl hover:border-primary/10 transition-colors">
            <CardHeader className="flex flex-row items-center justify-between pb-4">
              <div>
                <CardTitle className="text-base flex items-center gap-2">
                  <Activity className="h-4 w-4 text-primary" />
                  {t("dashboard.recent_activity", "Activité récente")}
                </CardTitle>
                <CardDescription>{t("dashboard.latest_events", "Les derniers événements")}</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg">
                <Filter className="h-3 w-3 mr-1" />
                {t("common.filters", "Filtres")}
              </Button>
            </CardHeader>
            <CardContent>
              {recentActivity.length === 0 ? (
                <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/40">
                  {t("dashboard.no_recent_activity", "Aucune activité récente. Les événements et notifications apparaîtront ici.")}
                </div>
              ) : (
                <div className="space-y-0">
                  {recentActivity.map((act: any, i: number) => (
                    <motion.div
                      key={act.id}
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="flex items-start gap-3 py-3 px-2 rounded-xl hover:bg-muted/30 transition-colors border-b border-border/20 last:border-0"
                    >
                      <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                        act.type === "alert"
                          ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40"
                          : "bg-emerald-100 text-emerald-600 dark:bg-emerald-950/40"
                      }`}>
                        {act.type === "alert" ? <AlertCircle className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm" dir="auto">{act.text}</p>
                        <p className="text-xs text-muted-foreground mt-0.5">{act.time}</p>
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* My patients quick view */}
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.4 }}
      >
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="flex flex-row items-center justify-between pb-4">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <Users className="h-4 w-4 text-primary" />
                {t("dashboard.my_patients", "Mes patients")}
              </CardTitle>
              <CardDescription>{t("dashboard.patients_under_care", "Patients sous votre suivi médical")}</CardDescription>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onNavigate("patients")} className="text-xs rounded-lg">
              {t("common.see_all", "Voir tout")} <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            {realPatients.length === 0 ? (
              <div className="py-8 text-center text-xs text-muted-foreground border border-dashed rounded-xl border-border/40">
                {t("dashboard.no_patients_followed", "Aucun patient suivi actuellement. Dès qu'une consultation est confirmée, vos patients apparaîtront ici.")}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {realPatients.slice(0, 4).map((pat: any, i: number) => (
                  <motion.div
                    key={pat.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => onNavigate("patients")}
                    className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/20 transition-all cursor-pointer group"
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {pat.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{pat.name}</p>
                      <p className="text-xs text-muted-foreground">{pat.age} {t("dashboard.years_old", "ans")} • {pat.primaryCondition}</p>
                      <p className="text-[10px] text-primary font-medium mt-0.5">{t("dashboard.last_care_prefix", "Dernier soin: ")}{pat.lastVisit}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ===================== PLANNING =====================
function Planning({ role, user }: { role: UserRole; user: any }) {
  const { t, i18n } = useTranslation();
  const navigate = useNavigate();
  const { proAppointments, patientAppointments, acceptDemande, rejectDemande } = useAppointments();
  const appointments = role === "patient" ? patientAppointments : proAppointments;

  const [statusFilter, setStatusFilter] = useState<string>("tous");
  const recurringSeries = useQuery(
    api.recurringCare.getPatientRecurringSeries,
    role === "patient" ? {} : "skip"
  );
  const cancelRecurringMutation = useMutation(api.recurringCare.cancelRecurringAppointment);

  // Date du jour formatée avec locale
  const localeCode = i18n.language === "ar" ? "ar-MR" : "fr-FR";
  const todayFormatted = new Intl.DateTimeFormat(localeCode, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());

  const filteredAppointments = appointments.filter((appt) => {
    if (statusFilter === "tous") return true;
    if (statusFilter === "confirme") return appt.status === "confirme";
    if (statusFilter === "en_attente") return appt.status === "en_attente";
    if (statusFilter === "termine") return appt.status === "termine";
    if (statusFilter === "annule") return appt.status === "annule";
    return true;
  });

  const handleCancelSeries = async (firstApptId: any) => {
    if (!confirm(t("planning.confirm_interrupt", "Voulez-vous interrompre ce protocole de soins récurrents pour toutes les séances futures ?"))) return;
    try {
      await cancelRecurringMutation({
        appointmentId: firstApptId,
        mode: "this_and_future",
        reason: "Interrompu par le patient",
      });
      toast.success(t("planning.series_interrupted", "Protocole de soins récurrents interrompu."));
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'annulation de la série.");
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-bold flex items-center gap-2">
            <CalendarDays className="h-5 w-5 text-primary" />
            {role === "patient" ? t("planning.patient_title", "Mes rendez-vous & soins à domicile") : t("planning.pro_title", "Planning des interventions")}
          </h2>
          <p className="text-xs text-muted-foreground capitalize mt-0.5">{todayFormatted} {t("planning.time_zone_note", "(Heure UTC Mauritanie)")}</p>
        </div>

        <div className="flex items-center gap-2">
          {role === "patient" && (
            <BookingStepper>
              <Button size="sm" className="rounded-xl gap-1.5 shadow-md shadow-primary/20 text-xs h-9">
                <CalendarPlus className="h-4 w-4" />
                {t("planning.book_appointment", "Prendre un rendez-vous")}
              </Button>
            </BookingStepper>
          )}
        </div>
      </div>

      {/* Status Filter Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 overflow-x-auto text-xs">
        <button
          onClick={() => setStatusFilter("tous")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
            statusFilter === "tous"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("planning.all_tab", "Tous")} ({appointments.length})
        </button>
        <button
          onClick={() => setStatusFilter("confirme")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
            statusFilter === "confirme"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("planning.upcoming_tab", "À venir")} ({appointments.filter((a) => a.status === "confirme").length})
        </button>
        <button
          onClick={() => setStatusFilter("en_attente")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
            statusFilter === "en_attente"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("planning.pending_tab", "En attente")} ({appointments.filter((a) => a.status === "en_attente").length})
        </button>
        <button
          onClick={() => setStatusFilter("termine")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
            statusFilter === "termine"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("planning.history_tab", "Historique")} ({appointments.filter((a) => a.status === "termine").length})
        </button>
        <button
          onClick={() => setStatusFilter("annule")}
          className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 ${
            statusFilter === "annule"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("planning.cancelled_tab", "Annulés")} ({appointments.filter((a) => a.status === "annule").length})
        </button>
        {role === "patient" && (
          <button
            onClick={() => setStatusFilter("recurrent")}
            className={`px-3 py-1.5 rounded-lg font-medium transition-all shrink-0 flex items-center gap-1 ${
              statusFilter === "recurrent"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Repeat className="h-3 w-3 text-primary" />
            {t("planning.recurring_protocols", "Protocoles récurrents")} ({recurringSeries?.length || 0})
          </button>
        )}
      </div>

      {/* VUE PROTOCOLES RÉCURRENTS (PATIENTS) */}
      {role === "patient" && statusFilter === "recurrent" ? (
        <div className="space-y-3">
          {recurringSeries === undefined ? (
            <div className="py-12 flex items-center justify-center text-xs text-muted-foreground gap-2">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              {t("planning.loading_recurring", "Chargement de vos protocoles récurrents...")}
            </div>
          ) : recurringSeries.length === 0 ? (
            <div className="text-center py-12 border border-dashed rounded-2xl border-border/50 p-6">
              <Repeat className="h-8 w-8 text-primary/40 mx-auto mb-2" />
              <p className="text-sm font-semibold text-foreground">{t("planning.no_recurring", "Aucun protocole de soins récurrents")}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {t("planning.no_recurring_desc", "Vous pouvez programmer des séries de soins réguliers (injections quotidiennes, pansements réguliers, rééducation) directement depuis le formulaire de réservation.")}
              </p>
            </div>
          ) : (
            recurringSeries.map((series) => (
              <Card key={series._id} className="border-border/40 shadow-sm p-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-sm text-foreground">
                        {getLocalizedServiceLabel(series.serviceSnapshot?.name, i18n.language) || t("planning.recurring_protocols", "Protocole récurrent")}
                      </span>
                      <Badge
                        variant={series.status === "active" ? "default" : "secondary"}
                        className="text-[10px]"
                      >
                        {series.status === "active" ? t("status.active", "Actif") : t("status.termine", "Terminé / Interrompu")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {t("planning.practitioner_prefix", "Praticien : ")}<strong>{series.providerName}</strong> ({getLocalizedSpecialtyLabel(series.providerSpecialty, i18n.language)})
                    </p>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground pt-1">
                      <span>{t("planning.frequency_prefix", "Fréquence : ")}{series.rule === "daily" ? t("planning.daily", "Quotidienne") : series.rule === "weekly" ? t("planning.weekly", "Hebdomadaire") : t("planning.chosen_days", "Jours choisis")}</span>
                      <span>•</span>
                      <span>{t("planning.start_prefix", "Début le ")}{series.startDate} {t("common.at", "à")} {series.time}</span>
                      <span>•</span>
                      <span className="font-semibold text-primary">{series.serviceSnapshot?.price || 500} {t("planning.per_session", "MRU / séance")}</span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1 flex items-center gap-2">
                      <span className="text-emerald-600 font-bold">{series.completedCount} {t("planning.completed_count_plural", "terminée(s)")}</span>
                      <span>/</span>
                      <span className="text-foreground">{series.appointmentsCount} {t("planning.total_count_plural", "totale(s)")}</span>
                      {series.cancelledCount > 0 && (
                        <span className="text-destructive font-medium">({series.cancelledCount} {t("status.annule", "annulée(s)")})</span>
                      )}
                    </div>
                  </div>

                  {series.status === "active" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={async () => {
                        const appts = appointments.filter((a) => a.recurrenceSeriesId === series._id && (a.status === "en_attente" || a.status === "confirme"));
                        if (appts.length > 0) {
                          handleCancelSeries(appts[0].id || appts[0]._id);
                        } else {
                          toast.info("Aucune séance future en attente pour cette série.");
                        }
                      }}
                      className="rounded-xl text-xs text-destructive hover:bg-destructive/10 border-destructive/20 h-8 self-start sm:self-center"
                    >
                      {t("planning.interrupt_protocol", "Interrompre le protocole")}
                    </Button>
                  )}
                </div>
              </Card>
            ))
          )}
        </div>
      ) : (
        /* VUE RENDEZ-VOUS LIST */
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold">
              {role === "patient" ? t("planning.patient_appts_title", "Mes rendez-vous") : t("planning.team_consultations_title", "Consultations de l'équipe")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {filteredAppointments.length === 0 ? (
                <div className="text-center py-10 border border-dashed rounded-xl border-border/50 text-sm text-muted-foreground p-4">
                  {role === "patient"
                    ? t("planning.no_appts_filter", "Aucun rendez-vous ne correspond à ce filtre.")
                    : t("planning.no_consultations_filter", "Aucune consultation programmée pour ce statut.")}
                </div>
              ) : (
                filteredAppointments.map((appt, i) => {
                  const isConfirmed = appt.status === "confirme";
                  const isPending = appt.status === "en_attente";
                  const isCancelled = appt.status === "annule";
                  const isCompleted = appt.status === "termine";

                  return (
                    <div
                      key={appt.id || appt._id || `${appt.day}-${appt.time}-${i}`}
                      className="flex flex-col sm:flex-row sm:items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/20 transition-all gap-3"
                    >
                      <AppointmentDetailsModal
                        appointment={appt}
                        role={role === "patient" ? "patient" : "professionnel"}
                      >
                        <div className="flex items-center gap-4 cursor-pointer flex-1">
                          <div className="text-center min-w-[60px]">
                            <p className="text-xs font-medium text-primary">{appt.day || appt.date}</p>
                            <p className="text-lg font-bold">{appt.time}</p>
                          </div>
                          <div className="h-8 w-[2px] bg-primary/20 rounded-full" />
                          <div>
                            <p className="text-sm font-semibold">{appt.name || appt.patient || "Patient"}</p>
                            <p className="text-xs text-muted-foreground">
                              {getLocalizedServiceLabel(appt.serviceSnapshot?.name || appt.serviceType || appt.type, i18n.language)} • {appt.duration}
                              {appt.servicePrice ? ` • ${appt.servicePrice} MRU` : ""}
                              {appt.recurrenceSeriesId ? ` (${t("planning.recurring_protocols", "Protocole récurrent")})` : ""}
                            </p>
                            {appt.bookedByName && (
                              <p className="text-[11px] text-teal-700 font-medium flex items-center gap-1 mt-0.5">
                                <HeartHandshake className="w-3.5 h-3.5 text-teal-600" />
                                {t("appointments.booked_by_prefix", "Réservé par : ")}{appt.bookedByName}
                              </p>
                            )}
                          </div>
                        </div>
                      </AppointmentDetailsModal>

                      <div className="flex items-center gap-2 self-end sm:self-center">
                        <Badge
                          variant="outline"
                          className={`text-[10px] ${
                            isConfirmed
                              ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                              : isPending
                              ? "bg-amber-500/10 text-amber-600 border-amber-500/20"
                              : isCancelled
                              ? "bg-red-500/10 text-red-600 border-red-500/20"
                              : isCompleted
                              ? "bg-primary/10 text-primary border-primary/20"
                              : "bg-muted/50 text-muted-foreground"
                          }`}
                        >
                          {isConfirmed
                            ? t("status.confirme", "Confirmé")
                            : isPending
                            ? t("status.en_attente", "En attente")
                            : isCancelled
                            ? t("status.annule", "Annulé")
                            : isCompleted
                            ? t("status.termine", "Terminé")
                            : appt.status || appt.duration}
                        </Badge>

                        {/* ACTION BUTTONS FOR PROFESSIONAL ON PENDING REQUEST */}
                        {role === "professionnel" && isPending && (
                          <div className="flex items-center gap-1.5">
                            <Button
                              size="sm"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await acceptDemande(appt.id || appt._id);
                                  toast.success("Rendez-vous confirmé.");
                                } catch (err: any) {
                                  toast.error(err?.message || "Erreur lors de la confirmation.");
                                }
                              }}
                              className="rounded-lg text-xs h-7 px-2.5 gap-1 bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                            >
                              <CheckCircle2 className="h-3 w-3" />
                              {t("planning.confirm", "Confirmer")}
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={async (e) => {
                                e.stopPropagation();
                                try {
                                  await rejectDemande(appt.id || appt._id);
                                  toast.info("Rendez-vous refusé.");
                                } catch (err: any) {
                                  toast.error(err?.message || "Erreur lors du refus.");
                                }
                              }}
                              className="rounded-lg text-xs h-7 px-2.5 gap-1 border-destructive/30 text-destructive hover:bg-destructive/10"
                            >
                              <XCircle className="h-3 w-3" />
                              {t("planning.reject", "Refuser")}
                            </Button>
                          </div>
                        )}

                        {/* REBOOK BUTTON ON COMPLETED APPOINTMENT (Section 16) */}
                        {role === "patient" && isCompleted && (
                          <BookingStepper
                            providerId={appt.providerId}
                            initialSpecialty={appt.specialty}
                            initialAddress={appt.address}
                          >
                            <Button
                              size="sm"
                              variant="outline"
                              className="rounded-xl text-xs h-7 px-2.5 gap-1 border-primary/30 text-primary hover:bg-primary/5"
                            >
                              <Repeat className="h-3 w-3" />
                              {t("planning.rebook", "Reprendre rdv")}
                            </Button>
                          </BookingStepper>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ===================== RÉSEAU SECTION =====================
function ReseauSection({ role, user, onNavigate, onNavigateToPatient }: { role: UserRole; user: any; onNavigate: (id: DashboardSection) => void; onNavigateToPatient?: (id: string) => void }) {
  if (role === "patient") return <SoignantsSection onNavigate={onNavigate} />;
  return <MesPatientsSection onNavigateToPatient={onNavigateToPatient} />;
}

function SoignantsSection({ onNavigate }: { onNavigate: (id: DashboardSection) => void }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<"mes" | "favoris" | "tous">("tous");
  const [coords, setCoords] = useState<{ lat: number; lon: number } | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [locationActive, setLocationActive] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("Tous");
  const [filterZone, setFilterZone] = useState("Toutes zones");
  const [filterMaxPrice, setFilterMaxPrice] = useState<number | null>(null);

  // Dynamic queries
  const myCaregivers = useQuery(api.providers.getMyCaregivers);
  const favorites = useQuery(api.favorites.getFavorites);
  const toggleFavoriteMutation = useMutation(api.favorites.toggleFavorite);

  const rawProviders = useQuery(
    api.providers.getNearbyProviders,
    coords
      ? {
          latitude: coords.lat,
          longitude: coords.lon,
          zone: filterZone !== "Toutes zones" ? filterZone : undefined,
          maxPrice: filterMaxPrice !== null ? filterMaxPrice : undefined,
        }
      : {
          zone: filterZone !== "Toutes zones" ? filterZone : undefined,
          maxPrice: filterMaxPrice !== null ? filterMaxPrice : undefined,
        }
  );

  const SPECIALTY_MAP: Record<string, string> = {
    Tous: "Tous",
    medecin: "medecin",
    infirmier: "infirmier",
    kinestherapeute: "kinestherapeute",
    aide_soignant: "aide_soignant",
  };

  const SPECIALTY_DISPLAY: Record<string, string> = {
    medecin: t("specialties.medecin", "Médecin généraliste"),
    infirmier: t("specialties.infirmier", "Infirmier(ère)"),
    kinestherapeute: t("specialties.kinestherapeute", "Kinésithérapeute"),
    aide_soignant: t("specialties.aide_soignant", "Aide-soignant(e)"),
  };

  const specialties = [
    { key: "Tous", label: t("common.all", "Tous") },
    { key: "medecin", label: t("specialties.medecin", "Médecin généraliste") },
    { key: "infirmier", label: t("specialties.infirmier", "Infirmier(ère)") },
    { key: "kinestherapeute", label: t("specialties.kinestherapeute", "Kinésithérapeute") },
    { key: "aide_soignant", label: t("specialties.aide_soignant", "Aide-soignant(e)") },
  ];
  const zonesList = [
    "Toutes zones",
    "Tevragh Zeina",
    "Ksar",
    "Sebkha",
    "El Mina",
    "Teyarett",
    "Dar Naim",
    "Arafat",
    "Riyadh",
    "Toujounine",
  ];

  const handleLocate = () => {
    if (locationActive) {
      setLocationActive(false);
      setCoords(null);
      return;
    }

    if (!navigator.geolocation) {
      toast.error("La géolocalisation n'est pas supportée par votre navigateur");
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setCoords({ lat: pos.coords.latitude, lon: pos.coords.longitude });
        setLocationActive(true);
        setIsLocating(false);
        toast.success("Position localisée avec succès");
      },
      (err) => {
        console.warn("Geolocation denied or unavailable:", err);
        setIsLocating(false);
        toast.error("Impossible d'obtenir votre position précise. Affichage sans calcul de distance.");
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  const isProviderFavorite = (providerId: string) => {
    return (favorites || []).some((f) => f.providerId === providerId);
  };

  const handleToggleFavorite = async (providerId: any, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      const res = await toggleFavoriteMutation({ providerId });
      toast.success(res.isFavorite ? "Ajouté aux favoris." : "Retiré des favoris.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour des favoris.");
    }
  };

  const allDirectoryProviders = (rawProviders || []).map((p) => {
    const specialtyDisplay = SPECIALTY_DISPLAY[p.specialty] || p.specialty;
    const name = p.user?.name || "Professionnel de santé";
    return {
      id: p._id,
      userId: p.userId,
      name,
      specialty: specialtyDisplay,
      rawSpecialty: p.specialty,
      rating: p.rating ?? null,
      reviews: p.reviewCount ?? 0,
      distance: p.distance !== undefined ? `${p.distance} km` : p.city || "Nouakchott",
      hasCalculatedDistance: p.distance !== undefined,
      available: p.available,
      availability: p.available ? "Disponible" : "Indisponible",
      availabilityPreview: (p as any).availabilityPreview,
      phone: p.user?.phone || null,
      price: p.consultationFee !== undefined ? `${p.consultationFee} MRU` : t("appointments.fee_not_specified"),
      rawPrice: p.consultationFee,
      image: p.user?.image || null,
      initials: name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "MC",
      zones: p.interventionZones || [],
    };
  });

  const filteredDirectory = allDirectoryProviders.filter((p) => {
    const matchesSearch =
      p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.zones.some((z: string) => z.toLowerCase().includes(searchQuery.toLowerCase()));
    const matchesFilter = filterSpecialty === "Tous" || p.rawSpecialty === filterSpecialty;
    return matchesSearch && matchesFilter;
  });

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      {/* Header with Segmented 3 Tabs (Section 15) */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold tracking-tight">{t("caregivers.title")}</h2>
          <p className="text-sm text-muted-foreground">
            {activeTab === "mes"
              ? myCaregivers === undefined
                ? t("caregivers.loading_team", "Chargement de votre équipe de soignants...")
                : t("caregivers.caregivers_completed_summary", { count: myCaregivers.length })
              : activeTab === "favoris"
              ? favorites === undefined
                ? t("caregivers.loading_favorites", "Chargement de vos favoris...")
                : t("caregivers.favorites_summary", { count: favorites.length })
              : rawProviders === undefined
                ? t("caregivers.loading_directory", "Chargement de l'annuaire médical...")
                : t("caregivers.directory_summary", { count: filteredDirectory.length })}
          </p>
        </div>

        {/* 3 TABS: [ Mes soignants ] [ Favoris ] [ Tous les soignants ] */}
        <div className="flex items-center p-1 bg-muted/60 rounded-xl border border-border/40 w-fit">
          <button
            onClick={() => setActiveTab("mes")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "mes"
                ? "bg-card text-foreground shadow-sm border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("caregivers.tab_my_caregivers", "Mes soignants")} {myCaregivers ? `(${myCaregivers.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("favoris")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
              activeTab === "favoris"
                ? "bg-card text-foreground shadow-sm border border-border/40"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Heart className={`h-3.5 w-3.5 ${activeTab === "favoris" ? "fill-rose-500 text-rose-500" : ""}`} />
            {t("caregivers.tab_favorites", "Favoris")} {favorites ? `(${favorites.length})` : ""}
          </button>
          <button
            onClick={() => setActiveTab("tous")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              activeTab === "tous"
                ? "bg-card text-foreground shadow-sm border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t("caregivers.tab_all_caregivers", "Tous les soignants")}
          </button>
        </div>
      </div>

      {/* TAB 1: MES SOIGNANTS */}
      {activeTab === "mes" && (
        <>
          {myCaregivers === undefined ? (
            <div className="py-16 flex justify-center items-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">{t("caregivers.loading_team", "Chargement de votre équipe de soignants...")}</p>
              </div>
            </div>
          ) : myCaregivers.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border/60 rounded-2xl p-8 bg-card/40">
              <div className="h-12 w-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-3">
                <Stethoscope className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-foreground">{t("caregivers.empty_title")}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {t("caregivers.empty_desc")}
              </p>
              <Button
                size="sm"
                onClick={() => setActiveTab("tous")}
                className="mt-4 rounded-xl text-xs gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                {t("caregivers.explore_directory")}
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCaregivers.map((c, i) => {
                const name = c.user?.name || "Professionnel de santé";
                const specialtyLabel = SPECIALTY_DISPLAY[c.specialty] || c.specialty;
                const pInitials = name.split(" ").map((n: string) => n[0]).join("").slice(0, 2).toUpperCase() || "MC";
                const feeDisplay = c.consultationFee !== undefined ? `${c.consultationFee} MRU` : t("appointments.fee_not_specified");
                const isFav = isProviderFavorite(c._id);

                return (
                  <motion.div
                    key={c._id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full flex flex-col justify-between">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div
                            onClick={() => navigate(`/provider/${c._id}`)}
                            className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
                          >
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden">
                              {c.user?.image && c.user.image.startsWith("http") ? (
                                <img src={c.user.image} alt={name} className="h-full w-full object-cover" />
                              ) : (
                                pInitials
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-semibold hover:text-primary transition-colors">{name}</p>
                              <p className="text-xs text-muted-foreground">{specialtyLabel}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleToggleFavorite(c._id, e)}
                              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
                              title={isFav ? t("caregivers.remove_favorite", "Retirer des favoris") : t("caregivers.add_favorite", "Ajouter aux favoris")}
                            >
                              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                            </button>
                            <Badge
                              variant={c.available ? "default" : "secondary"}
                              className="text-[10px] shrink-0"
                            >
                              {c.available ? t("common.available", "Disponible") : t("common.unavailable", "Indisponible")}
                            </Badge>
                          </div>
                        </div>

                        <div className="text-xs text-muted-foreground space-y-1">
                          <p>
                            {t("caregivers.completed_consultations", {
                              count: c.completedCount,
                            })}
                          </p>
                          {c.lastConsultationDate && (
                            <p className="text-[11px] text-muted-foreground/80">
                              {t("caregivers.last_consultation", {
                                date: c.lastConsultationDate,
                              })}
                            </p>
                          )}
                        </div>

                        <Separator />

                        <div className="flex items-center justify-between text-xs">
                          <span className="font-semibold text-foreground">{feeDisplay}</span>
                          <span className="text-muted-foreground text-[11px]">{c.city || "Nouakchott"}</span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 pt-1">
                          <NewMessageModal
                            role="patient"
                            targetRecipient={{
                              id: c.userId,
                              name,
                              specialty: specialtyLabel,
                            }}
                            onConversationCreated={() => onNavigate("messages")}
                          >
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full text-xs gap-1.5 h-8 border-primary/20 hover:bg-primary/5 text-primary"
                            >
                              <MessageCircle className="h-3.5 w-3.5" />
                              {t("caregivers.send_message")}
                            </Button>
                          </NewMessageModal>

                          {/* REBOOK BUTTON (Section 16) */}
                          <BookingStepper
                            providerId={c._id}
                            initialSpecialty={c.specialty}
                          >
                            <Button
                              size="sm"
                              className="w-full text-xs gap-1.5 h-8"
                            >
                              <Repeat className="h-3.5 w-3.5" />
                              {t("caregivers.rebook", "Reprendre RDV")}
                            </Button>
                          </BookingStepper>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* TAB 2: FAVORIS (Section 15) */}
      {activeTab === "favoris" && (
        <>
          {favorites === undefined ? (
            <div className="py-16 flex justify-center items-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">{t("caregivers.loading_favorites", "Chargement de vos favoris...")}</p>
              </div>
            </div>
          ) : favorites.length === 0 ? (
            <div className="text-center py-16 border border-dashed border-border/60 rounded-2xl p-8 bg-card/40">
              <div className="h-12 w-12 rounded-full bg-rose-500/10 text-rose-500 flex items-center justify-center mx-auto mb-3">
                <Heart className="h-6 w-6" />
              </div>
              <p className="text-base font-semibold text-foreground">{t("caregivers.no_favorites_title", "Aucun soignant dans vos favoris")}</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-md mx-auto">
                {t("caregivers.no_favorites_desc", "Ajoutez vos praticiens de confiance en favoris en cliquant sur le cœur pour les retrouver rapidement ici.")}
              </p>
              <Button
                size="sm"
                onClick={() => setActiveTab("tous")}
                className="mt-4 rounded-xl text-xs gap-1.5"
              >
                <Search className="h-3.5 w-3.5" />
                {t("caregivers.explore_directory", "Parcourir l'annuaire")}
              </Button>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {favorites.map((fav, i) => (
                <motion.div
                  key={fav.favoriteId}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                >
                  <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full flex flex-col justify-between">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div
                          onClick={() => navigate(`/provider/${fav.providerId}`)}
                          className="flex items-center gap-3 cursor-pointer hover:opacity-85 transition-opacity"
                        >
                          <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 overflow-hidden">
                            {fav.image ? (
                              <img src={fav.image} alt={fav.name} className="h-full w-full object-cover" />
                            ) : (
                              fav.name.slice(0, 2).toUpperCase()
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-semibold hover:text-primary transition-colors">{fav.name}</p>
                            <p className="text-xs text-muted-foreground">{SPECIALTY_DISPLAY[fav.specialty] || fav.specialty}</p>
                          </div>
                        </div>
                        <button
                          onClick={(e) => handleToggleFavorite(fav.providerId, e)}
                          className="p-1 rounded-full text-rose-500 hover:bg-rose-500/10 transition-colors"
                          title={t("caregivers.remove_favorite", "Retirer des favoris")}
                        >
                          <Heart className="h-4 w-4 fill-rose-500" />
                        </button>
                      </div>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-0.5 text-amber-500 font-medium">
                          <Star className="h-3 w-3 fill-amber-400" />
                          {fav.rating.toFixed(1)}
                        </span>
                        <span>•</span>
                        <span>{fav.city || "Nouakchott"}</span>
                        {fav.consultationFee && (
                          <>
                            <span>•</span>
                            <span className="font-semibold text-foreground">{fav.consultationFee} MRU</span>
                          </>
                        )}
                      </div>

                      <Separator />

                      <div className="grid grid-cols-2 gap-2 pt-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => navigate(`/provider/${fav.providerId}`)}
                          className="w-full text-xs h-8"
                        >
                          {t("caregivers.view_profile", "Voir profil")}
                        </Button>
                        <BookingStepper
                          providerId={fav.providerId}
                          initialSpecialty={fav.specialty}
                        >
                          <Button
                            size="sm"
                            className="w-full text-xs gap-1.5 h-8 shadow-sm"
                          >
                            <CalendarPlus className="h-3.5 w-3.5" />
                            {t("common.book", "Réserver")}
                          </Button>
                        </BookingStepper>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          )}
        </>
      )}

      {/* TAB 3: TOUS LES SOIGNANTS (ANNUAIRE AVEC FILTRES AVANCÉS) */}
      {activeTab === "tous" && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t("caregivers.search_directory_placeholder", "Rechercher par nom, spécialité, zone...")}
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
              />
            </div>

            {/* Zone Selector (Section 12/24) */}
            <select
              value={filterZone}
              onChange={(e) => setFilterZone(e.target.value)}
              className="h-10 px-3 rounded-xl border border-border/40 bg-card text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-primary/20"
            >
              {zonesList.map((z) => (
                <option key={z} value={z}>
                  {z === "Toutes zones" ? t("caregivers.all_zones", "Toutes zones") : z}
                </option>
              ))}
            </select>

            <Button
              size="sm"
              onClick={handleLocate}
              disabled={isLocating}
              variant={locationActive ? "default" : "outline"}
              className={`rounded-lg gap-1.5 transition-all ${locationActive ? 'shadow-md shadow-primary/20' : ''}`}
            >
              <MapPin className={`h-3.5 w-3.5 ${isLocating ? 'animate-bounce' : ''}`} />
              {isLocating ? t("caregivers.locating", "Localisation...") : locationActive ? t("caregivers.less_than_5km", "Moins de 5 km") : t("caregivers.locate_me", "Près de chez moi")}
            </Button>
          </div>

          {/* Specialty chips */}
          <div className="flex gap-2 overflow-x-auto pb-1">
            {specialties.map((s) => (
              <button
                key={s.key}
                onClick={() => setFilterSpecialty(s.key)}
                className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                  filterSpecialty === s.key
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-card border border-border/30 text-muted-foreground hover:text-foreground"
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          {rawProviders === undefined ? (
            <div className="py-16 flex justify-center items-center">
              <div className="flex flex-col items-center gap-2">
                <Loader2 className="w-6 h-6 text-primary animate-spin" />
                <p className="text-xs text-muted-foreground">{t("caregivers.loading_directory", "Chargement de l'annuaire médical...")}</p>
              </div>
            </div>
          ) : filteredDirectory.length === 0 ? (
            <div className="text-center py-12 border border-dashed border-border/60 rounded-2xl p-8">
              <p className="text-sm font-medium text-foreground">{t("caregivers.no_providers_found", "Aucun professionnel trouvé")}</p>
              <p className="text-xs text-muted-foreground mt-1">{t("caregivers.no_providers_found_desc", "Essayez de modifier votre recherche ou vos filtres de zone.")}</p>
            </div>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredDirectory.map((item, i) => {
                const isFav = isProviderFavorite(item.id);
                return (
                  <motion.div
                    key={item.id}
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.04 }}
                  >
                    <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full group">
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div
                            onClick={() => navigate(`/provider/${item.id}`)}
                            className="flex items-center gap-3 cursor-pointer hover:opacity-80 transition-opacity"
                          >
                            <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0 group-hover:ring-2 group-hover:ring-primary/20 transition-all overflow-hidden">
                              {item.image && item.image.startsWith('http') ? (
                                <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                              ) : (
                                item.initials
                              )}
                            </div>
                            <div>
                              <p className="text-sm font-medium hover:text-primary transition-colors">{item.name}</p>
                              <p className="text-xs text-muted-foreground">{item.specialty}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-1.5">
                            <button
                              onClick={(e) => handleToggleFavorite(item.id, e)}
                              className="p-1 rounded-full hover:bg-muted text-muted-foreground hover:text-rose-500 transition-colors"
                              title={isFav ? t("caregivers.remove_favorite", "Retirer des favoris") : t("caregivers.add_favorite", "Ajouter aux favoris")}
                            >
                              <Heart className={`h-4 w-4 ${isFav ? "fill-rose-500 text-rose-500" : ""}`} />
                            </button>
                            {item.availabilityPreview?.hasSlots ? (
                              <Badge
                                variant="default"
                                className="text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium gap-1 shrink-0"
                              >
                                <Clock className="h-2.5 w-2.5" />
                                {item.availabilityPreview.nextSlotText}
                              </Badge>
                            ) : item.availabilityPreview?.hasSchedule === false ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] text-muted-foreground shrink-0 border border-border/50"
                              >
                                {t("caregivers.dispo_not_configured", "Dispos non configurées")}
                              </Badge>
                            ) : item.available ? (
                              <Badge
                                variant="secondary"
                                className="text-[10px] shrink-0"
                              >
                                {t("caregivers.no_slot_7d", "Aucun créneau disponible (7j)")}
                              </Badge>
                            ) : (
                              <Badge
                                variant="secondary"
                                className="text-[10px] text-muted-foreground shrink-0"
                              >
                                {t("common.unavailable", "Indisponible")}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                          {item.rating !== null && item.rating !== undefined ? (
                            <div className="flex items-center gap-1 font-medium text-foreground">
                              <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                              <span>{item.rating.toFixed(1)}</span>
                              <span className="text-muted-foreground font-normal">({item.reviews})</span>
                            </div>
                          ) : (
                            <span>{t("caregivers.new_provider", "Nouveau soignant")}</span>
                          )}
                          <span>•</span>
                          <span>{item.distance}</span>
                        </div>

                        {item.zones && item.zones.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1">
                            {item.zones.slice(0, 3).map((z: string) => {
                              const isSelectedZone =
                                filterZone !== "Toutes zones" &&
                                z.toLowerCase().replace(/[-_]/g, " ").trim() ===
                                  filterZone.toLowerCase().replace(/[-_]/g, " ").trim();
                              return (
                                <span
                                  key={z}
                                  className={`text-[10px] px-2 py-0.5 rounded-md ${
                                    isSelectedZone
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 font-semibold border border-emerald-300 dark:border-emerald-800"
                                      : "bg-muted/50 text-muted-foreground"
                                  }`}
                                >
                                  {z}
                                </span>
                              );
                            })}
                          </div>
                        )}

                        <Separator className="my-3" />

                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                            <DollarSign className="h-3 w-3 text-muted-foreground" />
                            {item.price}
                          </div>
                          <div className="flex gap-1 items-center">
                            {item.phone && (
                              <a
                                href={`tel:${item.phone}`}
                                className="inline-flex items-center justify-center h-7 w-7 rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground"
                                title={`Appeler ${item.phone}`}
                              >
                                <Phone className="h-3.5 w-3.5" />
                              </a>
                            )}
                            <NewMessageModal
                              role="patient"
                              targetRecipient={{
                                id: item.userId,
                                name: item.name,
                                specialty: item.specialty,
                              }}
                              onConversationCreated={() => onNavigate("messages")}
                            >
                              <Button
                                variant="ghost"
                                size="icon-sm"
                                className="h-7 w-7 rounded-lg text-primary hover:bg-primary/10"
                                title={t("caregivers.send_message", "Envoyer un message")}
                              >
                                <MessageCircle className="h-3.5 w-3.5" />
                              </Button>
                            </NewMessageModal>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-2 mt-3">
                          <Button
                            variant="outline"
                            onClick={() => navigate(`/provider/${item.id}`)}
                            className="w-full rounded-lg h-9 text-xs"
                          >
                            {t("caregivers.details_and_reviews", "Détails & Avis")}
                          </Button>
                          {item.availabilityPreview?.hasSchedule === false ? (
                            <Button
                              variant="outline"
                              disabled
                              className="w-full rounded-lg h-9 text-[11px] gap-1 border-dashed text-muted-foreground cursor-not-allowed opacity-80"
                              title="Ce professionnel n'a pas encore configuré ses disponibilités"
                            >
                              <Clock className="h-3.5 w-3.5" />
                              {t("caregivers.dispo_not_configured", "Dispos non configurées")}
                            </Button>
                          ) : (
                            <BookingStepper
                              providerId={item.id}
                              initialSpecialty={item.rawSpecialty}
                            >
                              <Button
                                className="w-full rounded-lg h-9 text-xs gap-1 shadow-sm"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                                {t("common.book", "Réserver")}
                              </Button>
                            </BookingStepper>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function MesPatientsSection({ onNavigateToPatient }: { onNavigateToPatient?: (id: string) => void }) {
  const { t } = useTranslation();
  const realPatients = useQuery(api.patientRecords.getPatientsForProvider);
  const [searchQuery, setSearchQuery] = useState("");

  const isLoading = realPatients === undefined;
  const patients = realPatients || [];

  const filtered = patients.filter((p: any) =>
    (p.name || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.condition || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
    (p.address || "").toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("patients.title", "Mes patients")}</h2>
          <p className="text-sm text-muted-foreground">
            {isLoading
              ? t("patients.loading_records", "Chargement des dossiers...")
              : filtered.length > 1
              ? t("patients.count_with_relation_plural", { count: filtered.length })
              : t("patients.count_with_relation", { count: filtered.length })}
          </p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder={t("patients.search_placeholder", "Rechercher un patient par nom, motif, ville...")}
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground gap-3">
          <Loader2 className="h-6 w-6 animate-spin text-primary" />
          <p className="text-sm">{t("patients.loading_patients", "Chargement des patients suivis...")}</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 px-4 bg-muted/10 border border-dashed rounded-2xl border-border/60">
          <User className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
          <h3 className="font-semibold text-base mb-1">{t("patients.not_found_title", "Aucun patient trouvé")}</h3>
          <p className="text-xs text-muted-foreground max-w-sm mx-auto">
            {searchQuery
              ? t("patients.search_empty", "Aucun patient ne correspond à votre recherche.")
              : t("patients.empty_desc", "Vos patients suivis apparaîtront ici dès vos premières consultations ou rendez-vous réservés.")}
          </p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((item: any, i: number) => (
            <motion.div
              key={item.id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              onClick={() => onNavigateToPatient?.(item.id.toString())}
              className="cursor-pointer"
            >
              <Card className="border-border/40 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-300 h-full">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                        {item.image || (item.name || "P").split(" ").map((n: string) => n[0]).join("")}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{item.name}</p>
                        <p className="text-xs text-muted-foreground">{item.condition}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-[10px]">
                      {item.nextVisit !== "Aucune" ? `${t("patients.next_visit_prefix", "Prochain: ")}${item.nextVisit}` : t("patients.no_upcoming_visit", "Aucun RDV à venir")}
                    </Badge>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                    <span>{item.age > 0 ? `${item.age} ${t("dashboard.years_old", "ans")}` : t("patients.age_not_specified", "Âge non précisé")}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>{item.sex === "F" ? t("patients.sex_f", "Femme") : item.sex === "M" ? t("patients.sex_m", "Homme") : item.sex}</span>
                    <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                    <span>{item.consultationsCount} {item.consultationsCount > 1 ? t("patients.care_count_plural", "soins") : t("patients.care_count", "soin")}</span>
                  </div>

                  <Separator className="my-3" />

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <MapPin className="h-3 w-3" />
                      {item.address}
                    </div>
                    <div className="flex gap-1">
                      {item.phone && (
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          className="h-7 w-7 rounded-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            window.location.href = `tel:${item.phone}`;
                          }}
                        >
                          <Phone className="h-3.5 w-3.5" />
                        </Button>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 mt-3">
                    <Button
                      size="sm"
                      className="w-full rounded-lg h-8 text-xs"
                      onClick={(e) => {
                        e.stopPropagation();
                        onNavigateToPatient?.(item.id.toString());
                      }}
                    >
                      {t("patients.view_medical_record", "Voir dossier médical")}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}

// ===================== MESSAGES SECTION =====================
function MessagesSection({ role, user }: { role: UserRole; user: any }) {
  const { t } = useTranslation();
  const conversations = useQuery(api.messages.getConversations) || [];
  const [selectedChatUserId, setSelectedChatUserId] = useState<string | null>(null);
  const [inputText, setInputText] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  const sendMessageMutation = useMutation(api.messages.send);
  const markReadMutation = useMutation(api.messages.markRead);

  // If a chat is selected, query the conversation
  const currentChatMessages = useQuery(
    api.messages.getConversation,
    selectedChatUserId ? { otherUserId: selectedChatUserId as Id<"users"> } : "skip"
  );

  // Automatically mark incoming messages as read when opening conversation
  useEffect(() => {
    if (selectedChatUserId) {
      markReadMutation({ otherUserId: selectedChatUserId as Id<"users"> }).catch(() => {});
    }
  }, [selectedChatUserId, currentChatMessages?.length, markReadMutation]);

  const selectedConv = conversations.find((c) => c.counterpartId === selectedChatUserId);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!selectedChatUserId || !inputText.trim() || isSending) return;

    const textToSend = inputText.trim();
    setInputText("");
    setIsSending(true);

    try {
      await sendMessageMutation({
        receiverId: selectedChatUserId as Id<"users">,
        content: textToSend,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erreur lors de l'envoi du message";
      toast.error(msg);
      setInputText(textToSend); // restore on failure
    } finally {
      setIsSending(false);
    }
  };

  const filteredConversations = conversations.filter((c) =>
    c.counterpartName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.counterpartSpecialty && c.counterpartSpecialty.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  const totalUnreadConversations = conversations.filter((c) => c.unreadCount > 0).length;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">{t("nav.messages", "Messagerie")}</h2>
          <p className="text-sm text-muted-foreground">
            {totalUnreadConversations > 1
              ? t("messages.unread_count_plural", { count: totalUnreadConversations })
              : t("messages.unread_count", { count: totalUnreadConversations })}
          </p>
        </div>
        <NewMessageModal role={role} onConversationCreated={(recId) => setSelectedChatUserId(recId)}>
          <Button size="sm" className="rounded-lg gap-1.5 shadow-sm">
            <Edit3 className="h-3.5 w-3.5" />
            {role === "patient" ? t("messages.new_message_to_provider", "Nouveau message") : t("messages.contact_patient", "Contacter un patient")}
          </Button>
        </NewMessageModal>
      </div>

      <div className="grid lg:grid-cols-3 gap-0 bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm min-h-[550px]">
        {/* Conversation list */}
        <div className="lg:col-span-1 border-r border-border/30 flex flex-col">
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder={t("messages.search_placeholder", "Rechercher...")}
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border/30 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[500px] flex-1 divide-y divide-border/20">
            {filteredConversations.length === 0 ? (
              <div className="p-8 text-center text-xs text-muted-foreground">
                {searchTerm ? t("messages.search_empty", "Aucun contact correspondant.") : t("messages.no_conversations", "Aucune conversation pour l'instant. Utilisez le bouton ci-dessus pour entamer une discussion.")}
              </div>
            ) : (
              filteredConversations.map((conv, i) => {
                const isSelected = selectedChatUserId === conv.counterpartId;
                const initials = conv.counterpartName
                  .split(" ")
                  .map((n) => n[0])
                  .join("")
                  .toUpperCase()
                  .slice(0, 2);

                const timeStr = new Date(conv.lastMessageTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

                return (
                  <motion.button
                    key={conv.counterpartId}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => setSelectedChatUserId(conv.counterpartId)}
                    className={`w-full flex items-start gap-3 p-3.5 text-left transition-colors hover:bg-muted/30 ${
                      isSelected ? "bg-primary/10 border-l-2 border-primary" : "border-l-2 border-transparent"
                    } ${conv.unreadCount > 0 ? "bg-primary/[0.03]" : ""}`}
                  >
                    <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                      {initials}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className={`text-sm ${conv.unreadCount > 0 ? "font-bold text-foreground" : "font-medium"}`}>
                          {conv.counterpartName}
                        </span>
                        <span className="text-[10px] text-muted-foreground">{timeStr}</span>
                      </div>
                      {conv.counterpartSpecialty && (
                        <p className="text-[11px] text-primary/80 font-medium capitalize">
                          {conv.counterpartSpecialty}
                        </p>
                      )}
                      <p className={`text-xs truncate mt-0.5 ${conv.unreadCount > 0 ? "font-semibold text-foreground" : "text-muted-foreground"}`}>
                        {conv.lastMessage}
                      </p>
                    </div>
                    {conv.unreadCount > 0 && (
                      <span className="h-5 min-w-5 rounded-full bg-primary text-primary-foreground text-[10px] font-bold flex items-center justify-center px-1 shrink-0 mt-1 shadow-sm">
                        {conv.unreadCount}
                      </span>
                    )}
                  </motion.button>
                );
              })
            )}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 flex flex-col">
          {selectedChatUserId && selectedConv ? (
            <>
              {/* Header of active chat */}
              <div className="flex items-center justify-between gap-3 p-4 border-b border-border/30 bg-muted/10">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shadow-xs">
                    {selectedConv.counterpartName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2)}
                  </div>
                  <div>
                    <p className="text-sm font-semibold">{selectedConv.counterpartName}</p>
                    <p className="text-xs text-muted-foreground capitalize">
                      {selectedConv.counterpartSpecialty || (selectedConv.counterpartRole === "professionnel" ? t("roles.professionnel", "Soignant") : t("roles.patient", "Patient"))}
                    </p>
                  </div>
                </div>
              </div>

              {/* Message scroll container */}
              <div className="flex-1 p-4 overflow-y-auto max-h-[420px] space-y-3 bg-muted/5 flex flex-col">
                {currentChatMessages === undefined ? (
                  <div className="flex-1 flex items-center justify-center">
                    <Loader2 className="h-6 w-6 animate-spin text-primary/60" />
                  </div>
                ) : currentChatMessages.length === 0 ? (
                  <div className="flex-1 flex flex-col items-center justify-center text-center p-6">
                    <MessageCircle className="h-8 w-8 text-muted-foreground/30 mb-2" />
                    <p className="text-sm font-medium text-muted-foreground">{t("messages.conversation_start", "Début de la conversation")}</p>
                    <p className="text-xs text-muted-foreground/70 mt-1">{t("messages.conversation_start_desc", "Envoyez votre premier message ci-dessous.")}</p>
                  </div>
                ) : (
                  currentChatMessages.map((msg) => (
                    <div
                      key={msg._id}
                      className={`flex flex-col ${msg.isSelf ? "items-end" : "items-start"}`}
                    >
                      <div
                        className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm shadow-xs ${
                          msg.isSelf
                            ? "bg-primary text-primary-foreground rounded-br-xs"
                            : "bg-card border border-border/40 text-card-foreground rounded-bl-xs"
                        }`}
                      >
                        <p className="whitespace-pre-wrap break-words">{msg.content}</p>
                        <div
                          className={`text-[9px] mt-1 flex items-center justify-end gap-1 ${
                            msg.isSelf ? "text-primary-foreground/70" : "text-muted-foreground"
                          }`}
                        >
                          <span>{new Date(msg._creationTime).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                          {msg.isSelf && (
                            <CheckCircle2 className={`h-3 w-3 ${msg.read ? "text-primary-foreground" : "text-primary-foreground/50"}`} />
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Composer */}
              <form onSubmit={handleSendMessage} className="p-3 border-t border-border/30 bg-card">
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder={t("messages.write_message_placeholder", "Écrivez votre message...")}
                    className="flex-1 h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <Button type="submit" size="sm" disabled={!inputText.trim() || isSending} className="rounded-xl h-10 px-4 gap-1.5 shadow-sm">
                    {isSending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <>
                        <Send className="h-4 w-4" />
                        <span className="hidden sm:inline">{t("messages.send", "Envoyer")}</span>
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </>
          ) : (
            <div className="flex items-center justify-center flex-1 min-h-[400px]">
              <div className="text-center p-6">
                <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4 border border-primary/10">
                  <MessageCircle className="h-8 w-8 text-primary/40" />
                </div>
                <p className="text-sm font-semibold text-foreground">{t("messages.select_conversation_title", "Sélectionnez une conversation")}</p>
                <p className="text-xs text-muted-foreground mt-1 max-w-xs">
                  {t("messages.select_conversation_desc", "Choisissez une conversation dans la liste à gauche ou contactez un nouveau professionnel autorisé.")}
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ===================== PROFIL SECTION =====================
function ProfilSection({ role, user, initials, signOut }: { role: UserRole; user: any; initials: string; signOut: () => void }) {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";

  const profileData = useQuery(api.users.getCompleteUserProfile);
  const currentProvider = useQuery(api.providers.getCurrentProvider);

  const updatePatientProfileMutation = useMutation(api.users.updatePatientProfile);
  const updateProfessionalProfileMutation = useMutation(api.users.updateProfessionalProfile);
  const generateAvatarUploadUrlMutation = useMutation(api.users.generateAvatarUploadUrl);
  const saveAvatarMutation = useMutation(api.users.saveAvatar);
  const removeAvatarMutation = useMutation(api.users.removeAvatar);

  // Active sub-tab state
  const [activeTab, setActiveTab] = useState<"personal" | "public" | "emergency" | "accreditation" | "security" | "services" | "schedule">(
    role === "professionnel" ? "public" : "personal"
  );

  // Patient / Common state
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("Nouakchott");
  const [neighborhood, setNeighborhood] = useState("");
  const [address, setAddress] = useState("");
  const [birthDate, setBirthDate] = useState("");
  const [gender, setGender] = useState<"homme" | "femme">("homme");

  // Professional state
  const [specialty, setSpecialty] = useState<any>("infirmier");
  const [professionalTitle, setProfessionalTitle] = useState("");
  const [licenseNumber, setLicenseNumber] = useState("");
  const [yearsOfExperience, setYearsOfExperience] = useState<number>(0);
  const [consultationFee, setConsultationFee] = useState<number>(500);
  const [bio, setBio] = useState("");
  const [available, setAvailable] = useState<boolean>(false);
  const [interventionZones, setInterventionZones] = useState<string[]>(["Tevragh Zeina", "Ksar"]);
  const [languages, setLanguages] = useState<string[]>(["Français", "Hassaniya"]);

  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  // Sync state when profile loads
  useEffect(() => {
    if (profileData) {
      if (profileData.firstName) setFirstName(profileData.firstName);
      if (profileData.lastName) setLastName(profileData.lastName);
      if (profileData.phone) setPhone(profileData.phone);
      if (profileData.city) setCity(profileData.city);
      if (profileData.neighborhood) setNeighborhood(profileData.neighborhood);
      if (profileData.address) setAddress(profileData.address);
      if (profileData.birthDate) setBirthDate(profileData.birthDate);
      if (profileData.gender) setGender(profileData.gender as any);

      if (profileData.provider) {
        const p = profileData.provider;
        if (p.specialty) setSpecialty(p.specialty);
        if (p.professionalTitle) setProfessionalTitle(p.professionalTitle);
        if (p.licenseNumber) setLicenseNumber(p.licenseNumber);
        if (p.yearsOfExperience !== undefined) setYearsOfExperience(p.yearsOfExperience);
        if (p.consultationFee !== undefined) setConsultationFee(p.consultationFee);
        if (p.bio) setBio(p.bio);
        if (p.available !== undefined) setAvailable(p.available);
        if (p.interventionZones) setInterventionZones(p.interventionZones);
        if (p.languages) setLanguages(p.languages);
      }
    }
  }, [profileData]);

  // Handle Photo Upload
  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Veuillez sélectionner un fichier image valide (JPEG, PNG, WebP).");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error("La photo dépasse la taille maximale de 5 Mo.");
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const uploadUrl = await generateAvatarUploadUrlMutation();
      const res = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type },
        body: file,
      });

      if (!res.ok) throw new Error("Échec du téléversement de la photo.");
      const { storageId } = await res.json();
      await saveAvatarMutation({ storageId });
      toast.success("Photo de profil mise à jour.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement de la photo.");
    } finally {
      setIsUploadingPhoto(false);
      e.target.value = "";
    }
  };

  // Handle Photo Removal
  const handleRemovePhoto = async () => {
    try {
      await removeAvatarMutation();
      toast.success("Photo de profil supprimée.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la suppression de la photo.");
    }
  };

  // Handle Save Patient
  const handleSavePatient = async () => {
    setIsSaving(true);
    try {
      await updatePatientProfileMutation({
        firstName,
        lastName,
        phone,
        city,
        neighborhood: neighborhood || undefined,
        address: address || undefined,
        birthDate: birthDate || undefined,
        gender,
      });
      toast.success("Profil patient mis à jour avec succès.");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  // Handle Save Professional
  const handleSaveProfessional = async () => {
    setIsSaving(true);
    try {
      const res = await updateProfessionalProfileMutation({
        firstName,
        lastName,
        phone,
        city,
        neighborhood: neighborhood || undefined,
        address: address || undefined,
        specialty,
        professionalTitle: professionalTitle || undefined,
        licenseNumber,
        yearsOfExperience: Number(yearsOfExperience) || 0,
        bio,
        interventionZones,
        consultationFee: Number(consultationFee) || 500,
        languages,
        available,
      });

      if (res.reverificationRequired) {
        toast.warning(res.message);
      } else {
        toast.success(res.message);
      }
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de la mise à jour.");
    } finally {
      setIsSaving(false);
    }
  };

  const displayName = profileData?.name || user?.name || "Utilisateur";
  const avatarUrl = profileData?.image || user?.image;
  const completionScore = profileData?.completionScore ?? 75;

  return (
    <div className="space-y-6 max-w-4xl mx-auto" dir={isRtl ? "rtl" : "ltr"}>
      {/* Header Profile Identity Overview */}
      <div className="p-6 rounded-2xl bg-card border border-border/50 shadow-sm flex flex-col sm:flex-row items-center sm:items-start justify-between gap-6">
        <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 text-center sm:text-left">
          {/* Avatar with Upload */}
          <div className="relative group shrink-0">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={displayName}
                className="h-20 w-20 rounded-2xl object-cover ring-4 ring-primary/20 shadow-md"
              />
            ) : (
              <div className="h-20 w-20 rounded-2xl bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center text-2xl font-bold text-primary shadow-sm">
                {initials}
              </div>
            )}

            {isUploadingPhoto && (
              <div className="absolute inset-0 bg-background/80 rounded-2xl flex items-center justify-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            )}

            <label className="absolute -bottom-2 -right-2 p-1.5 rounded-xl bg-card border border-border/60 text-foreground hover:bg-muted cursor-pointer shadow-sm group-hover:scale-110 transition-transform">
              <CameraIcon />
              <input
                type="file"
                accept="image/*"
                className="hidden"
                disabled={isUploadingPhoto}
                onChange={handlePhotoUpload}
              />
            </label>
          </div>

          <div className="space-y-1">
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <h2 className="text-xl font-bold text-foreground">{displayName}</h2>
              <Badge variant="secondary" className="text-[10px] font-semibold">
                {role === "patient" ? t("roles.patient", "Patient") : t("roles.professionnel", "Professionnel de Santé")}
              </Badge>
              {role === "professionnel" && (
                <Badge
                  variant={currentProvider?.verified ? "default" : "outline"}
                  className={`text-[10px] ${
                    currentProvider?.verified
                      ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                      : "text-amber-600 border-amber-500/30"
                  }`}
                >
                  {currentProvider?.verified ? t("profile.verified_profile", "✓ Profil Agréé") : t("profile.pending_validation", "En cours de vérification")}
                </Badge>
              )}
            </div>
            <p className="text-xs text-muted-foreground">{profileData?.email || user?.email}</p>
            <p className="text-xs text-muted-foreground">{city}, Mauritanie</p>

            {avatarUrl && (
              <button
                type="button"
                onClick={handleRemovePhoto}
                className="text-[11px] text-destructive hover:underline pt-1 block"
              >
                {t("profile.delete_photo", "Supprimer la photo")}
              </button>
            )}
          </div>
        </div>

        {/* Completion Gauge */}
        <div className="w-full sm:w-48 bg-muted/20 p-3.5 rounded-xl border border-border/30 text-xs space-y-2">
          <div className="flex items-center justify-between font-semibold">
            <span className="text-muted-foreground">{t("profile.completion_score", "Profil complété")}</span>
            <span className="text-primary">{completionScore}%</span>
          </div>
          <div className="w-full h-2 rounded-full bg-muted overflow-hidden">
            <div
              className="h-full bg-primary rounded-full transition-all duration-500"
              style={{ width: `${completionScore}%` }}
            />
          </div>
          <p className="text-[10px] text-muted-foreground">
            {completionScore >= 80 ? t("profile.dossier_optimal", "Dossier prêt & optimal") : t("profile.complete_to_100", "Renseignez vos coordonnées pour atteindre 100%")}
          </p>
        </div>
      </div>

      {/* Profile Section Tabs */}
      <div className="flex items-center gap-1.5 p-1 bg-muted/40 rounded-xl border border-border/40 overflow-x-auto">
        {role === "professionnel" && (
          <button
            onClick={() => setActiveTab("public")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "public"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("profile.tabs.public", "Fiche publique")}</span>
          </button>
        )}

        {role === "professionnel" && (
          <button
            onClick={() => setActiveTab("services")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "services"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("profile.tabs.services", "Prestations & Tarifs")}</span>
          </button>
        )}

        {role === "professionnel" && (
          <button
            onClick={() => setActiveTab("schedule")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "schedule"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("profile.tabs.schedule", "Horaires & Congés")}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("personal")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "personal"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{role === "professionnel" ? t("profile.tabs.personal_pro", "Données personnelles") : t("profile.tabs.personal", "Profil personnel")}</span>
        </button>

        {role === "patient" && (
          <button
            onClick={() => setActiveTab("emergency")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "emergency"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("profile.tabs.emergency", "Contact d'urgence")}</span>
          </button>
        )}

        {role === "professionnel" && (
          <button
            onClick={() => setActiveTab("accreditation")}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
              activeTab === "accreditation"
                ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t("profile.tabs.accreditation", "Accréditation")}</span>
          </button>
        )}

        <button
          onClick={() => setActiveTab("security")}
          className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-all flex items-center gap-1.5 shrink-0 ${
            activeTab === "security"
              ? "bg-card text-foreground shadow-sm font-semibold border border-border/50"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          <span>{t("profile.tabs.security", "Sécurité & Compte")}</span>
        </button>
      </div>

      {/* TAB: Personal Info */}
      {activeTab === "personal" && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              {t("profile.civil_status_title", "Coordonnées & État Civil")}
            </CardTitle>
            <CardDescription className="text-xs">
              {t("profile.civil_status_desc", "Ces informations privées permettent de vous identifier de manière sécurisée lors des prises en charge.")}
            </CardDescription>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.first_name", "Prénom")} *</label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  placeholder="Mohamed"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.last_name", "Nom de famille")} *</label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  placeholder="Ould Vall"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.phone", "Téléphone direct")} *</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+222 45 00 00 00"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.city", "Ville de résidence")} *</label>
                <input
                  type="text"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  placeholder="Nouakchott"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.neighborhood", "Quartier / Moughataa")}</label>
                <input
                  type="text"
                  value={neighborhood}
                  onChange={(e) => setNeighborhood(e.target.value)}
                  placeholder="Ex: Tevragh Zeina, Ilot K"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.address", "Adresse complète ou repère")}</label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  placeholder="Près de la Polyclinique..."
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.birth_date", "Date de naissance")}</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.gender", "Genre")}</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setGender("homme")}
                    className={`flex-1 h-9 rounded-xl text-xs font-medium border transition-all ${
                      gender === "homme"
                        ? "bg-primary/10 border-primary text-primary font-bold"
                        : "border-border/50 hover:bg-muted"
                    }`}
                  >
                    {t("profile.gender_male", "Homme")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setGender("femme")}
                    className={`flex-1 h-9 rounded-xl text-xs font-medium border transition-all ${
                      gender === "femme"
                        ? "bg-primary/10 border-primary text-primary font-bold"
                        : "border-border/50 hover:bg-muted"
                    }`}
                  >
                    {t("profile.gender_female", "Femme")}
                  </button>
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/40 flex justify-end">
            <Button
              size="sm"
              onClick={role === "professionnel" ? handleSaveProfessional : handleSavePatient}
              disabled={isSaving}
              className="rounded-xl text-xs gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t("profile.save_changes", "Enregistrer les modifications")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB: Professional Public Profile */}
      {role === "professionnel" && activeTab === "public" && (
        <Card className="border-border/50 shadow-sm">
          <CardHeader className="pb-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Stethoscope className="h-4 w-4 text-primary" />
                  {t("profile.public_profile_title", "Profil public soignant")}
                </CardTitle>
                <CardDescription className="text-xs">
                  {t("profile.public_profile_desc", "Ces éléments sont visibles par tous les patients mauritaniens dans le répertoire MauriCare.")}
                </CardDescription>
              </div>

              <label className="flex items-center gap-2 cursor-pointer bg-muted/40 p-2 rounded-xl border border-border/50">
                <input
                  type="checkbox"
                  checked={available}
                  onChange={(e) => setAvailable(e.target.checked)}
                  className="accent-primary rounded"
                />
                <span className="text-xs font-medium text-foreground">{t("profile.enable_public_availability", "Activer ma disponibilité publique")}</span>
              </label>
            </div>
          </CardHeader>

          <CardContent className="space-y-4 text-xs">
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.specialty_label", "Spécialité médicale")} *</label>
                <select
                  value={specialty}
                  onChange={(e) => setSpecialty(e.target.value)}
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option value="infirmier">{t("specialties.infirmier", "Infirmier(ère)")}</option>
                  <option value="aide_soignant">{t("specialties.aide_soignant", "Aide-soignant(e)")}</option>
                  <option value="medecin">{t("specialties.medecin", "Médecin généraliste")}</option>
                  <option value="kinestherapeute">{t("specialties.kinestherapeute", "Kinésithérapeute")}</option>
                </select>
                <span className="text-[10px] text-muted-foreground">
                  {t("profile.specialty_note", "Note : Modifier votre spécialité déclarée nécessitera une re-vérification administrative.")}
                </span>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.pro_title", "Titre professionnel ou fonction")}</label>
                <input
                  type="text"
                  value={professionalTitle}
                  onChange={(e) => setProfessionalTitle(e.target.value)}
                  placeholder={t("profile.title_placeholder", "Ex: Infirmier Major / Soins à domicile")}
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.license_number", "N° d'enregistrement / Licence d'exercice")} *</label>
                <input
                  type="text"
                  value={licenseNumber}
                  onChange={(e) => setLicenseNumber(e.target.value)}
                  placeholder="Ex: ONMM-2024-001"
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background font-mono text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.years_experience", "Années d'expérience professionnelle")}</label>
                <input
                  type="number"
                  min="0"
                  value={yearsOfExperience}
                  onChange={(e) => setYearsOfExperience(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-foreground">{t("profile.consultation_fee", "Tarif indicatif de consultation (MRU)")}</label>
                <input
                  type="number"
                  step="50"
                  min="0"
                  value={consultationFee}
                  onChange={(e) => setConsultationFee(Number(e.target.value))}
                  className="w-full h-9 px-3 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label className="font-semibold text-foreground">{t("profile.bio", "Biographie & Présentation aux patients")}</label>
                <textarea
                  rows={3}
                  value={bio}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="Présentez votre approche des soins..."
                  className="w-full p-2.5 rounded-xl border border-border/50 bg-background text-xs focus:outline-none focus:ring-2 focus:ring-primary/20"
                />
              </div>
            </div>
          </CardContent>

          <CardFooter className="pt-2 border-t border-border/40 flex justify-end">
            <Button
              size="sm"
              onClick={handleSaveProfessional}
              disabled={isSaving}
              className="rounded-xl text-xs gap-1.5"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
              {t("profile.save_public_profile", "Enregistrer le profil public")}
            </Button>
          </CardFooter>
        </Card>
      )}

      {/* TAB: Professional Services */}
      {role === "professionnel" && activeTab === "services" && <ProviderServicesTab />}

      {/* TAB: Professional Schedule & Leaves */}
      {role === "professionnel" && activeTab === "schedule" && <ProviderScheduleTab />}

      {/* TAB: Emergency Contacts */}
      {role === "patient" && activeTab === "emergency" && <EmergencyContactTab />}

      {/* TAB: Professional Accreditation */}
      {role === "professionnel" && activeTab === "accreditation" && (
        <Card className="border-border/50 shadow-sm p-6 space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Shield className="h-6 w-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-foreground">{t("profile.accreditation_status_title", "Statut d'Accréditation Officielle")}</h3>
                <p className="text-xs text-muted-foreground">{t("profile.accreditation_regulation", "Régulation médicale et autorisation d'exercice")}</p>
              </div>
            </div>

            <Badge
              variant="outline"
              className={`text-xs px-2.5 py-1 ${
                currentProvider?.verified
                  ? "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                  : "bg-amber-500/10 text-amber-600 border-amber-500/20"
              }`}
            >
              {currentProvider?.verified ? t("profile.verified_profile", "✓ Profil Vérifié & Agréé") : t("profile.pending_validation", "En attente de validation")}
            </Badge>
          </div>

          <div className="p-4 rounded-xl bg-muted/20 border border-border/40 text-xs space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("profile.certified_license", "Numéro de licence certifié")}</span>
              <span className="font-mono font-semibold">{currentProvider?.licenseNumber || t("status.pending", "En attente")}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground">{t("profile.onboarding_status_label", "Statut d'onboarding")}</span>
              <span className="font-semibold capitalize">
                {currentProvider?.onboardingStatus || (currentProvider?.verified ? t("status.approved", "Approuvé") : t("status.in_progress", "En cours"))}
              </span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs text-muted-foreground space-y-1">
            <span className="font-semibold text-foreground block">{t("profile.reverification_policy_title", "Politique de Re-vérification")}</span>
            <p>
              {t("profile.reverification_policy_desc", "Toute modification de votre spécialité ou numéro d'agrément déclenche une re-vérification médicale administrative par nos régulateurs avant parution publique définitive.")}
            </p>
          </div>
        </Card>
      )}

      {/* TAB: Account Security */}
      {activeTab === "security" && (
        <AccountSecurityTab
          currentEmail={profileData?.email || user?.email}
          role={role}
          onSignedOut={signOut}
        />
      )}
    </div>
  );
}

function CameraIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-muted-foreground">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
  );
}

// ===================== DEMANDES SECTION =====================
function DemandesSection() {
  const { t } = useTranslation();
  const { pendingDemandes, acceptDemande, rejectDemande } = useAppointments();
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const handleAccept = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await acceptDemande(id);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors de l'acceptation");
    } finally {
      setActionLoadingId(null);
    }
  };

  const handleReject = async (id: string) => {
    setActionLoadingId(id);
    setActionError(null);
    try {
      await rejectDemande(id);
    } catch (err: any) {
      setActionError(err?.message || "Erreur lors du refus");
    } finally {
      setActionLoadingId(null);
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">{t("demandes.title", "Mes demandes")}</h2>
          <p className="text-sm text-muted-foreground">{t("demandes.subtitle", "Gérez les demandes de rendez-vous de vos patients")}</p>
        </div>
      </div>

      {actionError && (
        <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm">
          {actionError}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder={t("demandes.search_placeholder", "Rechercher une demande...")}
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20">
            {pendingDemandes.length} {t("status.en_attente", "en attente")}
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {pendingDemandes.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl border-border/50">
            <p className="text-muted-foreground">{t("demandes.empty", "Aucune demande en attente pour le moment.")}</p>
          </div>
        ) : (
          pendingDemandes.map((demande, i) => (
            <motion.div
              key={demande.id || demande._id}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Card className="border-border/40 shadow-sm hover:shadow-md transition-shadow overflow-hidden">
                <div className="flex flex-col md:flex-row">
                  <div className="p-6 flex-1 space-y-4">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-lg font-bold text-primary">
                          {demande.patientName.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <div>
                          <h3 className="font-semibold text-lg">{demande.patientName}</h3>
                          <p className="text-sm text-muted-foreground">{demande.type}</p>
                        </div>
                      </div>
                      <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        {t("status.en_attente", "En attente")}
                      </Badge>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-4 text-sm">
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{demande.date}</span>
                      </div>
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{demande.time} ({demande.duration})</span>
                      </div>
                      {demande.address && (
                        <div className="sm:col-span-2 flex items-center gap-2 text-muted-foreground">
                          <MapPin className="h-4 w-4 text-primary shrink-0" />
                          <span>{demande.address}</span>
                        </div>
                      )}
                      <div className="sm:col-span-2 flex items-start gap-2 text-muted-foreground mt-2 bg-muted/30 p-3 rounded-lg border border-border/40">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="italic">"{demande.message || demande.notes || "Demande de rendez-vous"}"</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/10 p-6 border-t md:border-t-0 md:border-l border-border/40 flex md:flex-col items-center justify-center gap-3 min-w-[200px]">
                    <Button
                      onClick={() => handleAccept(demande._id || demande.id)}
                      disabled={actionLoadingId === (demande._id || demande.id)}
                      className="w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      {actionLoadingId === (demande._id || demande.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-4 w-4" />
                      )}
                      {t("demandes.accept", "Accepter")}
                    </Button>
                    <Button
                      onClick={() => handleReject(demande._id || demande.id)}
                      disabled={actionLoadingId === (demande._id || demande.id)}
                      variant="outline"
                      className="w-full gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    >
                      {actionLoadingId === (demande._id || demande.id) ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <XCircle className="h-4 w-4" />
                      )}
                      {t("demandes.refuse", "Refuser")}
                    </Button>
                  </div>
                </div>
              </Card>
            </motion.div>
          ))
        )}
      </div>
    </div>
  );
}

// ===================== PATIENT DETAILS SECTION =====================
function PatientDetailsSection({ patientId, onBack }: { patientId: string; onBack: () => void }) {
  const { t } = useTranslation();
  const patientData = useQuery(
    api.patientRecords.getPatientForProvider,
    patientId ? { patientId: patientId as any } : "skip"
  );

  const addVitalMutation = useMutation(api.patientRecords.addVital);
  const addDocumentMutation = useMutation(api.patientRecords.addDocument);
  const generateUploadUrl = useMutation(api.patientRecords.generateDocumentUploadUrl);

  // Vitals dialog state
  const [openVitalDialog, setOpenVitalDialog] = useState(false);
  const [vitalBp, setVitalBp] = useState("");
  const [vitalPulse, setVitalPulse] = useState("");
  const [isAddingVital, setIsAddingVital] = useState(false);

  // Document dialog state
  const [openDocDialog, setOpenDocDialog] = useState(false);
  const [docName, setDocName] = useState("");
  const [docCategory, setDocCategory] = useState("Ordonnance");
  const [docFile, setDocFile] = useState<File | null>(null);
  const [isAddingDoc, setIsAddingDoc] = useState(false);

  // Relay consultation state
  const [openRelayDialog, setOpenRelayDialog] = useState(false);

  // HomeLab request state
  const [openHomeLabDialog, setOpenHomeLabDialog] = useState(false);

  const handleAddVital = async () => {
    if (!vitalBp.trim() && !vitalPulse.trim()) {
      toast.error("Veuillez saisir au moins une valeur de tension ou de pouls.");
      return;
    }
    setIsAddingVital(true);
    try {
      const pulseNum = vitalPulse.trim() ? parseInt(vitalPulse.trim(), 10) : undefined;
      await addVitalMutation({
        patientId: patientId as any,
        bloodPressure: vitalBp.trim() || undefined,
        pulse: pulseNum && !isNaN(pulseNum) ? pulseNum : undefined,
      });
      toast.success("Constantes enregistrées avec succès");
      setOpenVitalDialog(false);
      setVitalBp("");
      setVitalPulse("");
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'enregistrement des constantes");
    } finally {
      setIsAddingVital(false);
    }
  };

  const handleAddDoc = async () => {
    if (!docName.trim()) {
      toast.error("Veuillez indiquer un intitulé de document");
      return;
    }
    setIsAddingDoc(true);
    try {
      let storageId: string | undefined = undefined;
      if (docFile) {
        const uploadUrl = await generateUploadUrl({ patientId: patientId as any });
        const uploadRes = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": docFile.type || "application/octet-stream" },
          body: docFile,
        });
        if (!uploadRes.ok) {
          throw new Error("Échec du téléversement du fichier vers le stockage sécurisé");
        }
        const json = await uploadRes.json();
        storageId = json.storageId;
      }

      await addDocumentMutation({
        patientId: patientId as any,
        name: docName.trim(),
        category: docCategory,
        storageId,
      });
      toast.success("Document ajouté au dossier médical avec succès");
      setOpenDocDialog(false);
      setDocName("");
      setDocFile(null);
    } catch (err: any) {
      toast.error(err?.message || "Erreur lors de l'ajout du document");
    } finally {
      setIsAddingDoc(false);
    }
  };

  if (patientData === undefined) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-muted-foreground gap-3">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm font-medium">{t("patients.loading_records", "Chargement du dossier médical sécurisé...")}</p>
      </div>
    );
  }

  if (patientData === null) {
    return (
      <div className="max-w-md mx-auto py-20 text-center space-y-4">
        <AlertCircle className="h-12 w-12 text-destructive mx-auto" />
        <h2 className="text-lg font-bold">{t("patients.access_unauthorized_title", "Accès non autorisé")}</h2>
        <p className="text-sm text-muted-foreground">
          {t("patients.access_unauthorized_desc", "Aucune relation de soins active n'a été trouvée avec ce patient. Vous devez avoir au moins un rendez-vous avec le patient pour accéder à son dossier.")}
        </p>
        <Button onClick={onBack} variant="outline" className="rounded-xl">
          {t("patients.back_to_my_patients", "Retour à mes patients")}
        </Button>
      </div>
    );
  }

  const latestVital = patientData.vitals && patientData.vitals.length > 0 ? patientData.vitals[0] : null;

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{patientData.name}</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              {t("patients.active_record", "Dossier actif")}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span>{patientData.age > 0 ? `${patientData.age} ${t("dashboard.years_old", "ans")}` : t("patients.age_not_specified", "Âge non précisé")}</span>
            <span>•</span>
            <span>{t("patients.blood_group_prefix", "Groupe ")}{patientData.bloodGroup}</span>
            <span>•</span>
            <span className="truncate">{patientData.primaryCondition}</span>
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <Dialog open={openVitalDialog} onOpenChange={setOpenVitalDialog}>
            <DialogTrigger asChild>
              <Button variant="outline" className="gap-2 rounded-xl">
                <HeartPulse className="h-4 w-4" />
                {t("patients.add_measurement", "Ajouter une mesure")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{t("patients.record_vitals_title", "Enregistrer de nouvelles constantes")}</DialogTitle>
                <DialogDescription>
                  {t("patients.record_vitals_desc", "Ajoutez les mesures prises lors du soin à domicile pour ce patient.")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("chronic.blood_pressure", "Tension artérielle")} (ex: 12/8 ou 130/85)</label>
                  <input
                    type="text"
                    value={vitalBp}
                    onChange={(e) => setVitalBp(e.target.value)}
                    placeholder="12/8"
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("chronic.pulse", "Pouls")} (bpm)</label>
                  <input
                    type="number"
                    value={vitalPulse}
                    onChange={(e) => setVitalPulse(e.target.value)}
                    placeholder="72"
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm"
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => setOpenVitalDialog(false)}>{t("common.cancel", "Annuler")}</Button>
                <Button onClick={handleAddVital} disabled={isAddingVital}>
                  {isAddingVital ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  {t("common.save", "Enregistrer")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Dialog open={openDocDialog} onOpenChange={setOpenDocDialog}>
            <DialogTrigger asChild>
              <Button className="gap-2 rounded-xl">
                <FileText className="h-4 w-4" />
                {t("patients.add_document", "Ajouter un document")}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[400px]">
              <DialogHeader>
                <DialogTitle>{t("patients.reference_document_title", "Référencer un document médical")}</DialogTitle>
                <DialogDescription>
                  {t("patients.reference_document_desc", "Ajoutez les informations relatives à une prescription ou un examen.")}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3 py-2">
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("patient_details.document_name", "Nom ou intitulé du document *")}</label>
                  <input
                    type="text"
                    value={docName}
                    onChange={(e) => setDocName(e.target.value)}
                    placeholder="Ex: Analyse_Glycemie_2026.pdf"
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("patient_details.document_category", "Catégorie")}</label>
                  <select
                    value={docCategory}
                    onChange={(e) => setDocCategory(e.target.value)}
                    className="w-full h-9 px-3 rounded-lg border border-border text-sm bg-background"
                  >
                    <option value="Ordonnance">{t("patient_details.doc_cat_prescription", "Ordonnance")}</option>
                    <option value="Laboratoire">{t("patient_details.doc_cat_lab", "Laboratoire / Prise de sang")}</option>
                    <option value="Imagerie">{t("patient_details.doc_cat_imaging", "Imagerie / Radiologie")}</option>
                    <option value="Compte-rendu">{t("patient_details.doc_cat_report", "Compte-rendu médical")}</option>
                    <option value="Autre">{t("patient_details.doc_cat_other", "Autre")}</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">{t("patient_details.document_file", "Fichier joint (PDF, document, image)")}</label>
                  <input
                    type="file"
                    onChange={(e) => {
                      const file = e.target.files?.[0] || null;
                      setDocFile(file);
                      if (file && !docName.trim()) {
                        setDocName(file.name);
                      }
                    }}
                    className="w-full text-xs file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:text-xs file:bg-primary/10 file:text-primary hover:file:bg-primary/20 file:cursor-pointer"
                  />
                  {docFile && (
                    <p className="text-[11px] text-emerald-600 font-medium">
                      ✓ Fichier prêt à téléverser : {docFile.name} ({(docFile.size / 1024).toFixed(1)} Ko)
                    </p>
                  )}
                </div>
              </div>
              <DialogFooter>
                <Button variant="ghost" onClick={() => { setOpenDocDialog(false); setDocFile(null); }}>{t("common.cancel", "Annuler")}</Button>
                <Button onClick={handleAddDoc} disabled={isAddingDoc || !docName.trim()}>
                  {isAddingDoc ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
                  {t("common.save", "Ajouter au dossier")}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button
            variant="outline"
            onClick={() => setOpenRelayDialog(true)}
            className="gap-2 rounded-xl text-teal-700 border-teal-200 hover:bg-teal-50"
          >
            <Share2 className="h-4 w-4" />
            {t("patients.relay_advice", "Avis Relay")}
          </Button>

          <Button
            variant="outline"
            onClick={() => setOpenHomeLabDialog(true)}
            className="gap-2 rounded-xl text-emerald-700 border-emerald-200 hover:bg-emerald-50"
          >
            <FlaskConical className="h-4 w-4" />
            {t("patients.homelab", "HomeLab")}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Colonne de gauche: Infos générales */}
        <div className="space-y-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <User className="h-5 w-5 text-primary" />
                {t("patients.patient_info_title", "Informations du patient")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t("common.address", "Adresse")}</p>
                  <p className="text-sm text-muted-foreground">{patientData.address || "Nouakchott"}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t("common.phone", "Téléphone")}</p>
                  <p className="text-sm text-muted-foreground">{patientData.phone || t("patients.not_provided", "Non renseigné")}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t("common.email", "Email")}</p>
                  <p className="text-sm text-muted-foreground">{patientData.email || t("patients.not_provided", "Non renseigné")}</p>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium">{t("patients.known_allergies", "Allergies connues")}</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patientData.allergies && patientData.allergies.length > 0 ? (
                      patientData.allergies.map((a: string) => (
                        <Badge key={a} variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-xs">
                          {a}
                        </Badge>
                      ))
                    ) : (
                      <span className="text-xs text-muted-foreground italic">{t("patients.no_allergies", "Aucune allergie signalée")}</span>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                {t("patients.latest_vitals", "Dernières Constantes")}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {latestVital ? (
                <>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2">
                      <HeartPulse className="h-4 w-4 text-rose-500" />
                      <span className="text-sm font-medium">{t("patients.bp_label", "Tension")}</span>
                    </div>
                    <span className="text-sm font-semibold">{latestVital.bp}</span>
                  </div>
                  <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-amber-500" />
                      <span className="text-sm font-medium">{t("patients.pulse_label", "Pouls")}</span>
                    </div>
                    <span className="text-sm font-semibold">{latestVital.pulse} bpm</span>
                  </div>
                  <p className="text-xs text-muted-foreground text-center mt-2">{t("patients.measured_on", "Mesuré le ")}{latestVital.date}</p>
                </>
              ) : (
                <div className="text-center py-6 text-xs text-muted-foreground italic">
                  {t("patients.no_vitals_recent", "Aucune constante enregistrée récemment.")}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne de droite: Historique et Documents */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                {t("patients.history_consultations", "Historique des consultations")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {patientData.history && patientData.history.length > 0 ? (
                <div className="divide-y divide-border/40">
                  {patientData.history.map((consultation: any) => (
                    <div key={consultation.id} className="p-4 sm:p-6 hover:bg-muted/20 transition-colors">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                        <div className="flex items-center gap-2">
                          <Stethoscope className="h-4 w-4 text-primary" />
                          <h4 className="font-semibold">{consultation.type}</h4>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-muted-foreground flex items-center gap-1">
                            <Calendar className="h-3.5 w-3.5" />
                            {consultation.date} {consultation.time}
                          </span>
                          <Badge variant="secondary" className="text-xs bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                            {t("status.termine", "Terminé")}
                          </Badge>
                        </div>
                      </div>
                      <div className="pl-6 border-l-2 border-primary/20 ml-2 mt-2 space-y-1">
                        <p className="text-xs font-medium text-primary">{t("patients.clinical_report_label", "Compte-rendu clinique :")}</p>
                        <p className="text-sm text-foreground/90 whitespace-pre-wrap">
                          {consultation.report}
                        </p>
                        {consultation.notes && (
                          <p className="text-xs text-muted-foreground italic mt-1">
                            {t("patients.initial_reason_label", "Motif initial : ")}"{consultation.notes}"
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {t("patients.no_consultation_history", "Aucune consultation terminée dans l'historique de ce patient.")}
                </div>
              )}
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                {t("patients.documents_and_exams", "Documents et Examens")}
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              {patientData.documents && patientData.documents.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-4">
                  {patientData.documents.map((doc: any) => (
                    <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 transition-colors group">
                      <div className="h-10 w-10 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                        <FileText className="h-5 w-5" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium truncate" title={doc.name}>{doc.name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                          <span className="truncate">{doc.type}</span>
                          <span>•</span>
                          <span className="shrink-0">{doc.date}</span>
                        </div>
                        {doc.storageUrl && (
                          <a
                            href={doc.storageUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 text-xs text-primary hover:underline mt-1 font-medium"
                          >
                            <ExternalLink className="h-3 w-3" />
                            {t("patients.consult_document", "Consulter le document")}
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-xs text-muted-foreground border border-dashed rounded-xl border-border/40">
                  {t("patients.no_documents", "Aucun document ou examen répertorié.")}
                </div>
              )}
            </CardContent>
          </Card>

          {/* MauriCare Relay - Coordination de soins pour ce patient (Module 6) */}
          <PatientRelayTimelineCard patientId={patientId} />

          {/* MauriCare HomeLab - Analyses & bilans pour ce patient (Module 7) */}
          <PatientHomeLabCard patientId={patientId} userRole="professionnel" />

          {/* MauriCare Chronic - Suivi longitudinal des constantes (Module 8) */}
          <PatientChronicTimelineCard patientId={patientId} userRole="professionnel" />
        </div>
      </div>

      <CreateRelayModal
        isOpen={openRelayDialog}
        onClose={() => setOpenRelayDialog(false)}
        initialPatientId={patientId}
      />

      <CreateHomeLabRequestModal
        isOpen={openHomeLabDialog}
        onClose={() => setOpenHomeLabDialog(false)}
        initialBeneficiaryId={patientId}
      />
    </div>
  );
}
