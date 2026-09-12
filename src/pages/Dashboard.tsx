import { useAuth } from "@/hooks/use-auth";
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
} from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router";
import { useState } from "react";
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
import { ProviderAvailability } from "@/components/ProviderAvailability";
import { NewMessageModal } from "@/components/NewMessageModal";
import { ReviewModal } from "@/components/ReviewModal";
import { AppointmentDetailsModal } from "@/components/AppointmentDetailsModal";

// ===================== TYPES =====================
type UserRole = "patient" | "professionnel";
type DashboardSection = "apercu" | "planning" | "reseau" | "messages" | "profil" | "demandes" | "patient-details";

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
function getNavItems(role: UserRole): { id: DashboardSection; label: string; icon: React.ElementType }[] {
  const base = [
    { id: "apercu" as const, label: "Vue d'ensemble", icon: ChartBar },
    { id: "planning" as const, label: "Planning", icon: CalendarDays },
    { id: "messages" as const, label: "Messages", icon: MessageSquare },
    { id: "profil" as const, label: "Mon profil", icon: User },
  ];

  if (role === "patient") {
    return [
      ...base.slice(0, 2),
      { id: "reseau" as const, label: "Mes soignants", icon: Stethoscope },
      ...base.slice(2),
    ];
  }

  return [
    ...base.slice(0, 2),
    { id: "demandes" as const, label: "Mes demandes", icon: FileText },
    { id: "reseau" as const, label: "Mes patients", icon: Users },
    ...base.slice(2),
  ];
}

// ===================== SIDEBAR CONTENT =====================
function SidebarContent({
  initials,
  user,
  role,
  activeSection,
  onNavigate,
  onSignOut,
  onCloseMobile,
}: {
  initials: string;
  user: any;
  role: UserRole;
  activeSection: DashboardSection;
  onNavigate: (id: DashboardSection) => void;
  onSignOut: () => void;
  onCloseMobile: () => void;
}) {
  const navItems = getNavItems(role);
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
                  ? "bg-gradient-to-r from-primary/15 to-transparent text-primary shadow-[inset_2px_0_0_0_var(--theme-primary)]"
                  : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
              }`}
            >
              <Icon className="h-4 w-4 shrink-0" />
              {item.label}
              {item.id === "messages" && (
                <span className="ml-auto h-5 min-w-5 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center px-1">
                  3
                </span>
              )}
              {item.id === "planning" && (
                <span className="ml-auto h-5 min-w-5 rounded-full bg-primary/10 text-primary text-[10px] font-medium flex items-center justify-center px-1">
                  2
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Sidebar footer */}
      <div className="px-3 py-4 border-t border-border/30">
        <div className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-muted/40">
          <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-semibold text-primary shrink-0">
            {initials}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-xs font-medium text-foreground truncate">
              {role === "professionnel" && user?.name === "Patient Test" ? "Praticien" : user?.name || "Utilisateur"}
            </p>
            <p className="text-[10px] text-muted-foreground">{role === "patient" ? "Patient" : "Aide-soignant"} • Nouakchott</p>
          </div>
        </div>
        <button
          onClick={onSignOut}
          className="w-full flex items-center gap-2 px-3 py-2 mt-1 rounded-lg text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/5 transition-colors"
        >
          <LogOut className="h-3.5 w-3.5" />
          Déconnexion
        </button>
      </div>
    </div>
  );
}

// ===================== MAIN COMPONENT =====================
export default function Dashboard() {
  const { isLoading, isAuthenticated, user, signOut } = useAuth();
  const navigate = useNavigate();
  const [role, setRole] = useState<UserRole>(() => {
    return (localStorage.getItem("userRole") as UserRole) || "patient";
  });
  const [activeSection, setActiveSection] = useState<DashboardSection>("apercu");
  const [selectedPatientId, setSelectedPatientId] = useState<string | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

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

  // ---- Loading state ----
  if (isLoading) {
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
            <p className="text-sm font-medium text-foreground">Chargement du tableau de bord...</p>
            <p className="text-xs text-muted-foreground">Préparation de vos données</p>
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
              <CardTitle className="text-2xl">Accès restreint</CardTitle>
              <CardDescription className="text-sm mt-2">
                Connectez-vous ou créez un compte pour accéder à votre tableau de bord MauriCare.
              </CardDescription>
            </CardHeader>
            <CardContent className="pb-6 space-y-3">
              <Link to="/auth">
                <Button size="lg" className="w-full rounded-xl gap-2 h-12 text-base shadow-lg shadow-primary/20">
                  Se connecter
                  <ArrowUpRight className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/">
                <Button variant="ghost" size="sm" className="w-full rounded-xl text-muted-foreground">
                  Retour à l'accueil
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
    activeSection,
    onNavigate: setActiveSection,
    onSignOut: handleSignOut,
    onCloseMobile: () => setSidebarOpen(false),
  };

  return (
    <div className="flex min-h-screen bg-gradient-to-br from-background via-background to-primary/[0.02]">
      {/* ==================== DESKTOP SIDEBAR ==================== */}
      <aside className="hidden lg:flex lg:flex-col lg:w-64 lg:shrink-0 bg-card border-r border-border/40">
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
        className={`fixed inset-y-0 left-0 z-50 w-64 bg-card border-r border-border/40 flex flex-col transition-transform duration-300 ease-in-out lg:hidden ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <SidebarContent {...sidebarProps} />
      </aside>

      {/* ==================== MAIN CONTENT ==================== */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Top bar */}
        <header className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/5 shadow-sm shadow-primary/[0.02]">
          <div className="flex items-center justify-between h-14 px-4 sm:px-6 lg:px-8">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 rounded-lg hover:bg-accent transition-colors -ml-2"
              >
                <Menu className="h-5 w-5 text-muted-foreground" />
              </button>
              <div>
                <h2 className="text-sm font-semibold text-foreground">
                  {getNavItems(role).find((n) => n.id === activeSection)?.label}
                </h2>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Role toggle removed */}
              <button className="relative p-2 rounded-full hover:bg-primary/5 transition-colors">
                <BellIcon />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-destructive ring-2 ring-background" />
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-full hover:bg-primary/5 transition-colors border border-transparent hover:border-primary/10 outline-none">
                    <div className="h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-semibold text-primary">
                      {initials}
                    </div>
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Mon compte</DropdownMenuLabel>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => setActiveSection("profil")} className="cursor-pointer">
                    <User className="mr-2 h-4 w-4" />
                    Mon Profil
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleSignOut} className="text-destructive focus:bg-destructive/10 focus:text-destructive cursor-pointer">
                    <LogOut className="mr-2 h-4 w-4" />
                    Déconnexion
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 p-4 sm:p-6 lg:p-8 overflow-x-hidden">
          <AnimatePresence mode="wait">
            <motion.div
              key={`${role}-${activeSection}`}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
            >
              {activeSection === "apercu" && <Apercu role={role} user={user} initials={initials} onNavigate={setActiveSection} />}
              {activeSection === "planning" && <Planning role={role} user={user} />}
              {activeSection === "demandes" && <DemandesSection />}
              {activeSection === "reseau" && <ReseauSection role={role} user={user} onNavigateToPatient={(id) => { setSelectedPatientId(id); setActiveSection("patient-details"); }} />}
              {activeSection === "patient-details" && selectedPatientId && <PatientDetailsSection patientId={selectedPatientId} onBack={() => setActiveSection("reseau")} />}
              {activeSection === "messages" && <MessagesSection role={role} user={user} />}
              {activeSection === "profil" && <ProfilSection role={role} user={user} initials={initials} signOut={handleSignOut} />}
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
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
function Apercu({ role, user, initials, onNavigate }: { role: UserRole; user: any; initials: string; onNavigate: (id: DashboardSection) => void }) {
  if (role === "patient") return <ApercuPatient user={user} initials={initials} />;
  return <ApercuProfessionnel user={user} initials={initials} onNavigate={onNavigate} />;
}

function ApercuPatient({ user, initials }: { user: any; initials: string }) {
  const navigate = useNavigate();
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const stats: StatCard[] = [
    { value: "5", label: "Soignants actifs", icon: Stethoscope, trend: "+2", trendUp: true },
    { value: "8", label: "Consultations ce mois", icon: CalendarCheck, trend: "+3", trendUp: true },
    { value: "4.9", label: "Note de mes soignants", icon: Star, trend: "+0.1", trendUp: true },
    { value: "2", label: "Prochains rdv", icon: Calendar, trend: "cette semaine", trendUp: true },
  ];

  const myProviders = [
    { name: "Dr. Camara", specialty: "Médecin généraliste", rating: 4.9, consultations: 12, image: "https://i.pravatar.cc/150?img=11", nextVisit: "Mer. 16 juil.", reviews: 128, distance: "1.2 km", price: "15 000 MRU" },
    { name: "Fatima O.", specialty: "Infirmière", rating: 4.8, consultations: 8, image: "https://i.pravatar.cc/150?img=5", nextVisit: "Lun. 14 juil.", reviews: 94, distance: "2.5 km", price: "8 000 MRU" },
    { name: "Mariam D.", specialty: "Kinésithérapeute", rating: 4.7, consultations: 6, image: "https://i.pravatar.cc/150?img=9", nextVisit: "Ven. 18 juil.", reviews: 67, distance: "3.0 km", price: "12 000 MRU" },
  ];

  const appointments = [
    { id: 1, name: "Fatima O.", type: "Infirmière", date: "Lun. 14 juil.", time: "09:00", status: "confirme" as const },
    { id: 2, name: "Dr. Ahmed S.", type: "Médecin", date: "Mer. 16 juil.", time: "14:30", status: "en_attente" as const },
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
                Bonjour, {user?.name?.split(" ")[0] || "Cher Patient"}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {today.charAt(0).toUpperCase() + today.slice(1)} • Nous sommes là pour prendre soin de vous
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <BookingStepper>
              <Button size="sm" className="rounded-xl gap-1.5 shadow-lg shadow-primary/20 bg-primary hover:bg-primary/90 text-primary-foreground">
                <CalendarCheck className="h-4 w-4" />
                Nouveau rendez-vous
              </Button>
            </BookingStepper>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5 border-primary/20 hover:bg-primary/5">
              <Search className="h-4 w-4" />
              Trouver un soignant
            </Button>
          </div>
        </div>
      </motion.div>

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
                  Mes soignants
                </CardTitle>
                <CardDescription>Professionnels qui vous suivent</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg">
                Voir tout <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {myProviders.map((prov, i) => (
                  <motion.div
                    key={prov.name}
                    onClick={() => navigate('/provider/1')}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-primary/[0.02] border border-border/40 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group cursor-pointer"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary overflow-hidden">
                        {prov.image.startsWith('http') ? (
                          <img src={prov.image} alt={prov.name} className="h-full w-full object-cover" />
                        ) : (
                          prov.image
                        )}
                      </div>
                      <div>
                        <p className="text-sm font-medium">{prov.name}</p>
                        <p className="text-xs text-muted-foreground">{prov.specialty} • {prov.consultations} consultations</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="flex items-center gap-1 justify-end">
                        <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                        <span className="text-xs font-medium">{prov.rating}</span>
                      </div>
                      <p className="text-[10px] text-muted-foreground">Prochain: {prov.nextVisit}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
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
                  Mes prochains rendez-vous
                </CardTitle>
                <CardDescription>Consultations à venir</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg">
                Voir tout <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appointments.map((appt, i) => (
                  <AppointmentDetailsModal key={appt.id} appointment={appt} role="patient">
                    <motion.div
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.06 }}
                      className="flex items-center justify-between p-3 rounded-2xl bg-card hover:bg-primary/[0.02] border border-border/40 hover:border-primary/20 hover:shadow-md hover:shadow-primary/5 transition-all duration-300 group cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                          {appt.name.split(" ").map((n: string) => n[0]).join("")}
                        </div>
                        <div>
                          <p className="text-sm font-medium">{appt.name}</p>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                            <span>{appt.type}</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span>{appt.date}</span>
                            <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                            <span>{appt.time}</span>
                          </div>
                        </div>
                      </div>
                      <Badge
                        variant={appt.status === "confirme" ? "default" : "secondary"}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {appt.status === "confirme" ? "Confirmé" : "En attente"}
                      </Badge>
                    </motion.div>
                  </AppointmentDetailsModal>
                ))}
                <BookingStepper>
                  <Button variant="outline" size="sm" className="w-full mt-2 rounded-xl border-dashed border-primary/40 text-primary hover:bg-primary/5 gap-1.5">
                    <Plus className="h-3.5 w-3.5" />
                    Planifier une consultation
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
              Mon suivi santé
            </CardTitle>
            <CardDescription>Aperçu de votre dossier médical</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Syringe className="h-4 w-4" />
                  <span className="text-xs font-semibold">Vaccinations</span>
                </div>
                <p className="text-2xl font-bold">4</p>
                <p className="text-xs text-muted-foreground mt-1">À jour • Prochain: Nov. 2025</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Pill className="h-4 w-4" />
                  <span className="text-xs font-semibold">Traitements</span>
                </div>
                <p className="text-2xl font-bold">2</p>
                <p className="text-xs text-muted-foreground mt-1">Traitements en cours • 1 rappel demain</p>
              </div>
              <div className="p-4 rounded-xl bg-muted/20 border border-border/20">
                <div className="flex items-center gap-2 text-primary mb-2">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs font-semibold">Dernière visite</span>
                </div>
                <p className="text-2xl font-bold">05/07</p>
                <p className="text-xs text-muted-foreground mt-1">Chez Dr. Camara • Il y a 3 jours</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

function ApercuProfessionnel({ user, initials, onNavigate }: { user: any; initials: string; onNavigate: (id: DashboardSection) => void }) {
  const navigate = useNavigate();
  const { pendingDemandes } = useAppointments();
  const today = new Date().toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  const stats: StatCard[] = [
    { value: "12", label: "Consultations ce mois", icon: Activity, trend: "+15%", trendUp: true },
    { value: "5", label: "Patients actifs", icon: Users, trend: "+2", trendUp: true },
    { value: "4.9", label: "Note moyenne", icon: Star, trend: "+0.2", trendUp: true },
    { value: "450 000", label: "Revenus (MRU)", icon: DollarSign, trend: "+25%", trendUp: true },
  ];

  const myPatients = [
    { name: "Aïcha M.", age: 72, condition: "Diabète", nextVisit: "12/07", image: "AM" },
    { name: "Mohamed L.", age: 58, condition: "Rééducation post-op", nextVisit: "10/07", image: "ML" },
    { name: "Fatimata D.", age: 65, condition: "Hypertension", nextVisit: "14/07", image: "FD" },
    { name: "Sidi O.", age: 45, condition: "Kinésithérapie lombaire", nextVisit: "09/07", image: "SO" },
  ];

  const appointments = [
    { id: 1, patient: "Aïcha M.", type: "Consultation", time: "09:00", duration: "1h", status: "confirme" as const },
    { id: 2, patient: "Mohamed L.", type: "Séance rééducation", time: "11:00", duration: "45min", status: "confirme" as const },
    { id: 3, patient: "Fatimata D.", type: "Consultation", time: "14:30", duration: "30min", status: "en_attente" as const },
  ];

  const recentActivity = [
    { id: 1, text: "Aïcha M. a confirmé son rdv de demain", time: "Il y a 1h", type: "check" as const },
    { id: 2, text: "Nouveau message de Mohamed L.", time: "Il y a 3h", type: "message" as const },
    { id: 3, text: "Paiement reçu - Consultation Fatimata D.", time: "Il y a 5h", type: "payment" as const },
    { id: 4, text: "Rappel : visite à domicile Sidi O. à 14h", time: "Il y a 7h", type: "alert" as const },
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
                Bonjour, {user?.name === "Patient Test" ? "Praticien" : (user?.name?.split(" ")[0] || "Cher Praticien")}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {today.charAt(0).toUpperCase() + today.slice(1)} • 3 consultations aujourd'hui
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
              Mes demandes
            </Button>
            <Button size="sm" variant="outline" className="rounded-xl gap-1.5">
              <Users className="h-4 w-4" />
              Mes patients
            </Button>
          </div>
        </div>
      </motion.div>

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
                    <span className="text-muted-foreground">vs mois dernier</span>
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
                  Consultations du jour
                </CardTitle>
                <CardDescription>Aujourd'hui • 3 rendez-vous</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg">
                Voir tout <ChevronRight className="h-3 w-3 ml-1" />
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {appointments.map((appt, i) => (
                  <AppointmentDetailsModal key={appt.id} appointment={appt} role="professionnel">
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
                          <p className="text-sm font-medium">{appt.patient}</p>
                          <p className="text-xs text-muted-foreground">{appt.type}</p>
                        </div>
                      </div>
                      <Badge
                        variant={appt.status === "confirme" ? "default" : "secondary"}
                        className="text-[10px] px-2 py-0.5"
                      >
                        {appt.status === "confirme" ? "Confirmé" : "À confirmer"}
                      </Badge>
                    </motion.div>
                  </AppointmentDetailsModal>
                ))}
                <Button variant="outline" size="sm" className="w-full mt-2 rounded-xl border-dashed border-border/50 gap-1.5">
                  <Plus className="h-3.5 w-3.5" />
                  Ajouter un créneau
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
                  Activité récente
                </CardTitle>
                <CardDescription>Les derniers événements</CardDescription>
              </div>
              <Button variant="ghost" size="sm" className="text-xs rounded-lg">
                <Filter className="h-3 w-3 mr-1" />
                Filtres
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-0">
                {recentActivity.map((act, i) => (
                  <motion.div
                    key={act.id}
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex items-start gap-3 py-3 px-2 rounded-xl hover:bg-muted/30 transition-colors border-b border-border/20 last:border-0"
                  >
                    <div className={`h-8 w-8 rounded-full flex items-center justify-center shrink-0 ${
                      act.type === "check" ? "bg-emerald-100 text-emerald-600" :
                      act.type === "message" ? "bg-blue-100 text-blue-600" :
                      act.type === "alert" ? "bg-amber-100 text-amber-600" :
                      "bg-primary/10 text-primary"
                    }`}>
                      {act.type === "check" ? <CheckCircle2 className="h-3.5 w-3.5" /> :
                       act.type === "message" ? <MessageCircle className="h-3.5 w-3.5" /> :
                       act.type === "alert" ? <AlertCircle className="h-3.5 w-3.5" /> :
                       <CreditCard className="h-3.5 w-3.5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm">{act.text}</p>
                      <p className="text-xs text-muted-foreground mt-0.5">{act.time}</p>
                    </div>
                  </motion.div>
                ))}
              </div>
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
                Mes patients
              </CardTitle>
              <CardDescription>Patients sous votre suivi</CardDescription>
            </div>
            <Button variant="ghost" size="sm" className="text-xs rounded-lg">
              Voir tout <ChevronRight className="h-3 w-3 ml-1" />
            </Button>
          </CardHeader>
          <CardContent>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
              {myPatients.map((pat, i) => (
                <motion.div
                  key={pat.name}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  onClick={() => navigate(`/patient/1`)}
                  className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/20 transition-all cursor-pointer group"
                >
                  <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                    {pat.image}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{pat.name}</p>
                    <p className="text-xs text-muted-foreground">{pat.age} ans • {pat.condition}</p>
                    <p className="text-[10px] text-primary font-medium mt-0.5">Prochain: {pat.nextVisit}</p>
                  </div>
                </motion.div>
              ))}
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

// ===================== PLANNING =====================
function Planning({ role, user }: { role: UserRole; user: any }) {
  const navigate = useNavigate();
  const weekDays = ["Lun", "Mar", "Mer", "Jeu", "Ven", "Sam", "Dim"];
  const { appointments: proAppointments } = useAppointments();

  const patientAppointments = [
    { day: "Lun 14", time: "09:00", name: "Fatima O.", type: "Infirmière", duration: "1h", status: "Terminé" },
    { day: "Mar 15", time: "11:00", name: "Moussa K.", type: "Aide-soignant", duration: "45min", status: "Terminé" },
    { day: "Mer 16", time: "14:30", name: "Dr. Ahmed S.", type: "Médecin", duration: "30min", status: "À venir" },
    { day: "Ven 18", time: "10:00", name: "Mariam D.", type: "Kinésithérapeute", duration: "1h", status: "À venir" },
    { day: "Sam 19", time: "08:30", name: "Dr. Camara", type: "Médecin", duration: "45min", status: "À venir" },
  ];

  const appointments = role === "patient" ? patientAppointments : proAppointments;

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Planning hebdomadaire</h2>
          <p className="text-sm text-muted-foreground">Semaine du 14 au 20 juillet 2025</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" className="rounded-lg">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="outline" size="sm" className="rounded-lg">
            <ChevronRight className="h-4 w-4" />
          </Button>
          {role === "patient" ? (
            <BookingStepper>
              <Button size="sm" className="rounded-lg gap-1.5">
                <CalendarPlus className="h-4 w-4" />
                Nouveau rdv
              </Button>
            </BookingStepper>
          ) : (
            <Button size="sm" className="rounded-lg gap-1.5">
              <CalendarPlus className="h-4 w-4" />
              Nouveau créneau
            </Button>
          )}
        </div>
      </div>

      {/* Week grid */}
      <div className="grid grid-cols-7 gap-2">
        {weekDays.map((day) => (
          <div key={day} className="text-center p-2 rounded-lg bg-muted/30 text-xs font-medium text-muted-foreground">
            {day}
          </div>
        ))}
      </div>

      {/* Appointments list */}
      <Card className="border-border/40 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">
            {role === "patient" ? "Mes rendez-vous de la semaine" : "Mes consultations de la semaine"}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-2">
            {appointments.map((appt, i) => (
              <motion.div
                key={`${appt.day}-${appt.time}`}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                onClick={role === "professionnel" ? () => navigate(`/patient/1`) : undefined}
                className={`flex items-center justify-between p-3 rounded-xl bg-muted/20 hover:bg-muted/40 border border-border/20 transition-all ${role === "professionnel" ? "cursor-pointer" : ""}`}
              >
                <div className="flex items-center gap-4">
                  <div className="text-center min-w-[60px]">
                    <p className="text-xs font-medium text-primary">{appt.day}</p>
                    <p className="text-lg font-bold">{appt.time}</p>
                  </div>
                  <div className="h-8 w-[2px] bg-primary/20 rounded-full" />
                  <div>
                    <p className="text-sm font-medium">{appt.name}</p>
                    <p className="text-xs text-muted-foreground">{appt.type} • {appt.duration}</p>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2">
                  <Badge variant="outline" className={`text-[10px] ${(appt as any).status === "Terminé" ? "bg-muted/50" : "bg-primary/10 text-primary border-primary/20"}`}>
                    {(appt as any).status || appt.duration}
                  </Badge>
                  {role === "patient" && (appt as any).status === "Terminé" && (
                    <ReviewModal providerName={appt.name}>
                      <Button variant="outline" size="sm" className="h-7 text-[10px] px-2 rounded-lg gap-1 border-yellow-400/50 hover:bg-yellow-400/10 hover:text-yellow-600 text-yellow-600 transition-colors">
                        <Star className="h-3 w-3" />
                        Laisser un avis
                      </Button>
                    </ReviewModal>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ===================== RÉSEAU SECTION =====================
function ReseauSection({ role, user, onNavigateToPatient }: { role: UserRole; user: any; onNavigateToPatient?: (id: string) => void }) {
  if (role === "patient") return <SoignantsSection />;
  return <MesPatientsSection onNavigateToPatient={onNavigateToPatient} />;
}

function SoignantsSection() {
  const navigate = useNavigate();
  const providers: ProviderInfo[] = [
    { id: 1, name: "Dr. Camara", specialty: "Médecin généraliste", rating: 4.9, reviews: 128, distance: "1.2 km", availability: "Disponible", phone: "+222 11 22 33 44", price: "15 000 MRU", image: "https://i.pravatar.cc/150?img=11" },
    { id: 2, name: "Fatima O.", specialty: "Infirmière", rating: 4.8, reviews: 94, distance: "2.5 km", availability: "Disponible", phone: "+222 22 33 44 55", price: "8 000 MRU", image: "https://i.pravatar.cc/150?img=5" },
    { id: 3, name: "Mariam D.", specialty: "Kinésithérapeute", rating: 4.7, reviews: 67, distance: "3.0 km", availability: "Complet cette semaine", phone: "+222 33 44 55 66", price: "12 000 MRU", image: "https://i.pravatar.cc/150?img=9" },
    { id: 4, name: "Dr. Ahmed S.", specialty: "Médecin généraliste", rating: 4.9, reviews: 203, distance: "0.8 km", availability: "Disponible", phone: "+222 44 55 66 77", price: "18 000 MRU", image: "https://i.pravatar.cc/150?img=12" },
    { id: 5, name: "Aminata D.", specialty: "Aide-soignante", rating: 4.6, reviews: 52, distance: "4.1 km", availability: "Disponible", phone: "+222 55 66 77 88", price: "5 000 MRU", image: "https://i.pravatar.cc/150?img=20" },
    { id: 6, name: "Dr. Souleymane B.", specialty: "Pédiatre", rating: 4.8, reviews: 156, distance: "2.0 km", availability: "Disponible", phone: "+222 66 77 88 99", price: "16 000 MRU", image: "https://i.pravatar.cc/150?img=68" },
  ];

  const [searchQuery, setSearchQuery] = useState("");
  const [filterSpecialty, setFilterSpecialty] = useState("Tous");

  const specialties = ["Tous", "Médecin généraliste", "Infirmière", "Kinésithérapeute", "Aide-soignante", "Pédiatre"];

  const filtered = providers.filter((p) => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      p.specialty.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFilter = filterSpecialty === "Tous" || p.specialty === filterSpecialty;
    return matchesSearch && matchesFilter;
  });

  const [isLocating, setIsLocating] = useState(false);
  const [locationActive, setLocationActive] = useState(false);

  const handleLocate = () => {
    if (locationActive) {
      setLocationActive(false);
      return;
    }
    setIsLocating(true);
    setTimeout(() => {
      setIsLocating(false);
      setLocationActive(true);
    }, 1500);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Professionnels de santé</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} professionnels disponibles</p>
        </div>
        <Button 
          size="sm" 
          onClick={handleLocate}
          disabled={isLocating}
          variant={locationActive ? "default" : "outline"}
          className={`rounded-lg gap-1.5 transition-all ${locationActive ? 'shadow-md shadow-primary/20' : ''}`}
        >
          <MapPin className={`h-3.5 w-3.5 ${isLocating ? 'animate-bounce' : ''}`} />
          {locationActive ? "Moins de 5 km" : "Près de chez moi"}
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Rechercher par nom, spécialité..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {specialties.map((s) => (
            <button
              key={s}
              onClick={() => setFilterSpecialty(s)}
              className={`whitespace-nowrap px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                filterSpecialty === s
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-card border border-border/30 text-muted-foreground hover:text-foreground"
              }`}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item, i) => (
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
                      {item.image.startsWith('http') ? (
                        <img src={item.image} alt={item.name} className="h-full w-full object-cover" />
                      ) : (
                        item.image
                      )}
                    </div>
                    <div>
                      <p className="text-sm font-medium hover:text-primary transition-colors">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.specialty}</p>
                    </div>
                  </div>
                  <Badge
                    variant={item.availability === "Disponible" ? "default" : "secondary"}
                    className="text-[10px]"
                  >
                    {item.availability}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                    <span>{item.rating}</span>
                  </div>
                  <span>{item.reviews} avis</span>
                  <span>{item.distance}</span>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-foreground">
                    <DollarSign className="h-3 w-3 text-muted-foreground" />
                    {item.price}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <Video className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <ProviderAvailability providerName={item.name} specialty={item.specialty} availability={item.availability}>
                  <Button className="w-full mt-3 rounded-lg h-9 text-xs gap-1.5 bg-primary/10 hover:bg-primary/20 text-primary transition-colors">
                    <CalendarPlus className="h-3.5 w-3.5" />
                    Voir les disponibilités
                  </Button>
                </ProviderAvailability>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

function MesPatientsSection({ onNavigateToPatient }: { onNavigateToPatient?: (id: string) => void }) {
  const patients: PatientInfo[] = [
    { id: 1, name: "Aïcha M.", age: 72, gender: "F", condition: "Diabète de type 2", lastVisit: "05/07/2025", nextVisit: "12/07/2025", phone: "+222 12 34 56 78", address: "Tevragh Zeina, Nouakchott" },
    { id: 2, name: "Mohamed L.", age: 58, gender: "M", condition: "Rééducation post-opératoire", lastVisit: "03/07/2025", nextVisit: "10/07/2025", phone: "+222 23 45 67 89", address: "Ksar, Nouakchott" },
    { id: 3, name: "Fatimata D.", age: 65, gender: "F", condition: "Hypertension artérielle", lastVisit: "30/06/2025", nextVisit: "14/07/2025", phone: "+222 34 56 78 90", address: "Dar Naim, Nouakchott" },
    { id: 4, name: "Sidi O.", age: 45, gender: "M", condition: "Kinésithérapie lombaire", lastVisit: "28/06/2025", nextVisit: "09/07/2025", phone: "+222 45 67 89 01", address: "Riyad, Nouakchott" },
    { id: 5, name: "Mariam T.", age: 80, gender: "F", condition: "Soins palliatifs", lastVisit: "02/07/2025", nextVisit: "09/07/2025", phone: "+222 56 78 90 12", address: "Sebkha, Nouakchott" },
  ];

  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState("");

  const filtered = patients.filter((p) =>
    p.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    p.condition.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Mes patients</h2>
          <p className="text-sm text-muted-foreground">{filtered.length} patients en cours de suivi</p>
        </div>
      </div>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Rechercher un patient..."
          className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all"
        />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {filtered.map((item, i) => (
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
                      {item.name.split(" ").map((n: string) => n[0]).join("")}
                    </div>
                    <div>
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.condition}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    Prochain: {item.nextVisit}
                  </Badge>
                </div>

                <div className="mt-3 flex items-center gap-3 text-xs text-muted-foreground">
                  <span>{item.age} ans</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>{item.gender === "F" ? "Femme" : "Homme"}</span>
                  <span className="h-1 w-1 rounded-full bg-muted-foreground/40" />
                  <span>Dernière visite: {item.lastVisit}</span>
                </div>

                <Separator className="my-3" />

                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <MapPin className="h-3 w-3" />
                    {item.address}
                  </div>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <Phone className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon-sm" className="h-7 w-7 rounded-lg">
                      <MessageCircle className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                <div className="flex gap-2 mt-3">
                  <Button size="sm" className="flex-1 rounded-lg h-8 text-xs gap-1" variant="outline">
                    <History className="h-3 w-3" />
                    Historique
                  </Button>
                  <Button size="sm" className="flex-1 rounded-lg h-8 text-xs" onClick={(e) => { e.stopPropagation(); onNavigateToPatient?.(item.id.toString()); }}>
                    Voir dossier
                  </Button>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

// ===================== MESSAGES SECTION =====================
function MessagesSection({ role, user }: { role: UserRole; user: any }) {
  const patientConversations: Message[] = [
    { id: 1, from: "Aminata D.", avatar: "AD", text: "Merci pour la visite d'hier ! Ma mère va déjà beaucoup mieux.", time: "Il y a 2h", unread: true },
    { id: 2, from: "Dr. Camara", avatar: "DC", text: "Confirmation pour vendredi à 14h30. Je vous confirme ma disponibilité.", time: "Il y a 5h", unread: true },
    { id: 3, from: "Fatima O.", avatar: "FO", text: "Je serai disponible demain matin à 9h pour la consultation.", time: "Hier", unread: false },
    { id: 4, from: "Service Support", avatar: "SC", text: "Bienvenue sur MauriCare ! Votre compte a été créé avec succès ✓", time: "Hier", unread: false },
    { id: 5, from: "Mariam D.", avatar: "MD", text: "Les exercises de rééducation font leur effet !", time: "Il y a 2 jours", unread: false },
  ];

  const proConversations: Message[] = [
    { id: 1, from: "Aïcha M.", avatar: "AM", text: "Merci docteur pour la consultation d'hier. Je me sens mieux.", time: "Il y a 1h", unread: true },
    { id: 2, from: "Mohamed L.", avatar: "ML", text: "Je confirme ma séance de rééducation de demain à 11h.", time: "Il y a 3h", unread: true },
    { id: 3, from: "Fatimata D.", avatar: "FD", text: "Mon tension est stable cette semaine. Je vous tiens au courant.", time: "Hier", unread: false },
    { id: 4, from: "Dr. Camara", avatar: "DC", text: "Réunion de coordination des soins - jeudi 10h à la clinique.", time: "Hier", unread: false, attachments: 1 },
    { id: 5, from: "Sidi O.", avatar: "SO", text: "Puis-je déplacer ma séance de vendredi à samedi matin ?", time: "Il y a 2 jours", unread: false },
  ];

  const conversations = role === "patient" ? patientConversations : proConversations;

  const [selectedChat, setSelectedChat] = useState<number | null>(null);
  const selected = conversations.find((c) => c.id === selectedChat);

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Messagerie</h2>
          <p className="text-sm text-muted-foreground">{conversations.filter(c => c.unread).length} conversations non lues</p>
        </div>
        <NewMessageModal role={role}>
          <Button size="sm" className="rounded-lg gap-1.5">
            <Edit3 className="h-3.5 w-3.5" />
            {role === "patient" ? "Nouveau message" : "Contacter un patient"}
          </Button>
        </NewMessageModal>
      </div>

      <div className="grid lg:grid-cols-3 gap-0 bg-card border border-border/40 rounded-2xl overflow-hidden shadow-sm">
        {/* Conversation list */}
        <div className="lg:col-span-1 border-r border-border/30">
          <div className="p-3 border-b border-border/30">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <input
                type="text"
                placeholder="Rechercher..."
                className="w-full h-9 pl-9 pr-3 rounded-lg bg-muted/50 border border-border/30 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
              />
            </div>
          </div>
          <div className="overflow-y-auto max-h-[500px]">
            {conversations.map((conv, i) => (
              <motion.button
                key={conv.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.03 }}
                onClick={() => setSelectedChat(conv.id)}
                className={`w-full flex items-start gap-3 p-3 text-left transition-colors hover:bg-muted/30 ${
                  selectedChat === conv.id ? "bg-primary/5 border-l-2 border-primary" : "border-l-2 border-transparent"
                } ${conv.unread ? "bg-primary/[0.02]" : ""}`}
              >
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0">
                  {conv.avatar}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm ${conv.unread ? "font-semibold" : "font-medium"}`}>
                      {conv.from}
                    </span>
                    <span className="text-[10px] text-muted-foreground">{conv.time}</span>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{conv.text}</p>
                  {conv.attachments && (
                    <div className="flex items-center gap-1 mt-1">
                      <FileText className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[10px] text-muted-foreground">{conv.attachments} pièce jointe</span>
                    </div>
                  )}
                </div>
                {conv.unread && (
                  <div className="h-2 w-2 rounded-full bg-primary shrink-0 mt-1.5" />
                )}
              </motion.button>
            ))}
          </div>
        </div>

        {/* Chat area */}
        <div className="lg:col-span-2 flex flex-col">
          {selected ? (
            <>
              <div className="flex items-center gap-3 p-4 border-b border-border/30">
                <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                  {selected.avatar}
                </div>
                <div>
                  <p className="text-sm font-medium">{selected.from}</p>
                  <p className="text-xs text-muted-foreground">En ligne</p>
                </div>
                <div className="ml-auto flex gap-1">
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg">
                    <Phone className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg">
                    <Video className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon-sm" className="h-8 w-8 rounded-lg">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
              <div className="flex-1 p-4 min-h-[300px] flex items-center justify-center">
                <div className="text-center">
                  <div className="h-12 w-12 rounded-full bg-primary/5 flex items-center justify-center mx-auto mb-3">
                    <MessageCircle className="h-6 w-6 text-primary/40" />
                  </div>
                  <p className="text-sm text-muted-foreground">Sélectionnez un message pour voir la conversation</p>
                  <p className="text-xs text-muted-foreground/60 mt-1">Zone de chat sera implémentée avec la connexion backend</p>
                </div>
              </div>
              <div className="p-4 border-t border-border/30">
                <div className="flex gap-2">
                  <input
                    type="text"
                    placeholder="Écrivez votre message..."
                    className="flex-1 h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm placeholder:text-muted-foreground/60 focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                  <Button size="sm" className="rounded-xl h-10">
                    <SendIcon />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center min-h-[400px]">
              <div className="text-center">
                <div className="h-16 w-16 rounded-2xl bg-primary/5 flex items-center justify-center mx-auto mb-4">
                  <MessageCircle className="h-8 w-8 text-primary/30" />
                </div>
                <p className="text-sm text-muted-foreground">Sélectionnez une conversation</p>
                <p className="text-xs text-muted-foreground/60 mt-1">Choisissez un message dans la liste de gauche</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SendIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="22" y1="2" x2="11" y2="13" />
      <polygon points="22 2 15 22 11 13 2 9 22 2" />
    </svg>
  );
}

// ===================== PROFIL SECTION =====================
function ProfilSection({ role, user, initials, signOut }: { role: UserRole; user: any; initials: string; signOut: () => void }) {
  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h2 className="text-lg font-semibold">Mon profil</h2>
        <p className="text-sm text-muted-foreground">Gérez vos informations personnelles et vos préférences</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {/* Avatar card */}
        <Card className="border-border/40 shadow-sm md:col-span-1">
          <CardContent className="p-6 text-center">
            <div className="h-20 w-20 rounded-full bg-primary/10 ring-4 ring-primary/20 flex items-center justify-center text-2xl font-bold text-primary mx-auto">
              {initials}
            </div>
            <h3 className="text-base font-semibold mt-4">{user?.name || "Utilisateur"}</h3>
            <Badge variant="secondary" className="mt-1">{role === "patient" ? "Patient" : "Professionnel de santé"}</Badge>
            <p className="text-xs text-muted-foreground mt-1">Nouakchott, Mauritanie</p>
            <Button variant="outline" size="sm" className="w-full mt-4 rounded-xl gap-1.5">
              <CameraIcon />
              Changer la photo
            </Button>
          </CardContent>
        </Card>

        {/* Info form */}
        <Card className="border-border/40 shadow-sm md:col-span-2">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Informations personnelles
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Nom complet</label>
                <input
                  type="text"
                  defaultValue={user?.name || "Utilisateur"}
                  className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Email</label>
                <input
                  type="email"
                  defaultValue={user?.email || "utilisateur@exemple.mr"}
                  className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Téléphone</label>
                <input
                  type="tel"
                  defaultValue="+222 12 34 56 78"
                  className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Ville</label>
                <input
                  type="text"
                  defaultValue="Nouakchott"
                  className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Adresse</label>
                <input
                  type="text"
                  defaultValue="Tevragh Zeina, Nouakchott, Mauritanie"
                  className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                />
              </div>
            </div>
            {role === "professionnel" && (
              <div className="grid sm:grid-cols-2 gap-4 pt-2 border-t border-border/20">
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Spécialité</label>
                  <input
                    type="text"
                    defaultValue="Infirmier diplômé d'État"
                    className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Numéro de licence</label>
                  <input
                    type="text"
                    defaultValue="IDE-2024-0042-MR"
                    className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Années d'expérience</label>
                  <input
                    type="text"
                    defaultValue="8 ans"
                    className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1.5 block">Tarif consultation</label>
                  <input
                    type="text"
                    defaultValue="15 000 MRU"
                    className="w-full h-10 px-3 rounded-xl bg-muted/30 border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
                  />
                </div>
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <Button size="sm" className="rounded-xl gap-1.5">
                <CheckCircle2 className="h-3.5 w-3.5" />
                Enregistrer
              </Button>
              <Button variant="outline" size="sm" className="rounded-xl">
                Annuler
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Preferences & Security */}
      <div className="grid sm:grid-cols-2 gap-6">
        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <BellIcon />
              Préférences
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[
              { label: "Notifications email", desc: "Recevoir les confirmations de rendez-vous" },
              { label: "Rappels SMS", desc: "Notifications 24h avant chaque séance" },
              { label: "Newsletter", desc: "Actualités et conseils santé" },
            ].map((pref) => (
              <div key={pref.label} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">{pref.label}</p>
                  <p className="text-xs text-muted-foreground">{pref.desc}</p>
                </div>
                <div className="h-5 w-9 rounded-full bg-primary/20 relative cursor-pointer">
                  <div className="h-4 w-4 rounded-full bg-primary absolute top-0.5 right-0.5 shadow-sm" />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        <Card className="border-border/40 shadow-sm">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="h-4 w-4 text-primary" />
              Sécurité
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="p-3 rounded-xl bg-muted/30 border border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LockIcon />
                <div>
                  <p className="text-sm font-medium">Mot de passe</p>
                  <p className="text-xs text-muted-foreground">Dernière modification il y a 3 mois</p>
                </div>
              </div>
              <Button variant="ghost" size="sm" className="rounded-lg text-xs">
                Modifier
              </Button>
            </div>
            <div className="p-3 rounded-xl bg-muted/30 border border-border/20 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Mail className="h-4 w-4 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">Email vérifié</p>
                  <p className="text-xs text-muted-foreground">{user?.email || "utilisateur@exemple.mr"}</p>
                </div>
              </div>
              <Badge variant="default" className="text-[10px]">Vérifié</Badge>
            </div>
            <Button variant="outline" size="sm" className="w-full rounded-xl gap-1.5 mt-2">
              <Download className="h-3.5 w-3.5" />
              Exporter mes données
            </Button>
            <Button variant="outline" size="sm" onClick={signOut} className="w-full rounded-xl gap-1.5 text-destructive border-destructive/20 hover:bg-destructive/5">
              <LogOut className="h-3.5 w-3.5" />
              Déconnexion
            </Button>
          </CardContent>
        </Card>
      </div>
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
  const { pendingDemandes, acceptDemande, rejectDemande } = useAppointments();

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Mes demandes</h2>
          <p className="text-sm text-muted-foreground">Gérez les demandes de rendez-vous de vos patients</p>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Rechercher une demande..."
            className="w-full h-10 pl-9 pr-4 rounded-xl bg-card border border-border/40 text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 transition-all"
          />
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="px-3 py-1 bg-primary/5 text-primary border-primary/20">
            {pendingDemandes.length} en attente
          </Badge>
        </div>
      </div>

      <div className="space-y-4">
        {pendingDemandes.length === 0 ? (
          <div className="text-center py-12 border border-dashed rounded-2xl border-border/50">
            <p className="text-muted-foreground">Aucune demande en attente pour le moment.</p>
          </div>
        ) : (
          pendingDemandes.map((demande, i) => (
            <motion.div
              key={demande.id}
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
                        En attente
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
                      <div className="sm:col-span-2 flex items-start gap-2 text-muted-foreground mt-2 bg-muted/30 p-3 rounded-lg border border-border/40">
                        <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                        <p className="italic">"{demande.message}"</p>
                      </div>
                    </div>
                  </div>
                  <div className="bg-muted/10 p-6 border-t md:border-t-0 md:border-l border-border/40 flex md:flex-col items-center justify-center gap-3 min-w-[200px]">
                    <Button
                      onClick={() => acceptDemande(demande.id)}
                      className="w-full gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white"
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Accepter
                    </Button>
                    <Button
                      onClick={() => rejectDemande(demande.id)}
                      variant="outline"
                      className="w-full gap-2 rounded-xl text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
                    >
                      <XCircle className="h-4 w-4" />
                      Refuser
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
  const MOCK_PATIENTS: Record<string, any> = {
    "1": {
      id: "1",
      name: "Aïcha M.",
      age: 32,
      bloodType: "O+",
      allergies: ["Pénicilline"],
      location: "Tevragh Zeina, Nouakchott",
      phone: "+222 45 67 89 00",
      email: "aicha.m@email.com",
      lastVisit: "Il y a 2 jours",
      condition: "Suivi post-opératoire",
      medicalHistory: [
        { id: "h1", date: "15 Mai 2026", type: "Chirurgie", description: "Appendicectomie sans complications", doctor: "Dr. Fall (Chirurgien)" },
        { id: "h2", date: "10 Jan 2025", type: "Consultation", description: "Bilan annuel, tout est normal", doctor: "Dr. Sy (Généraliste)" },
      ],
      consultations: [
        { id: "c1", date: "05 Juil 2026", type: "Suivi infirmier", status: "Terminé", notes: "Pansement refait. Bonne cicatrisation." },
        { id: "c2", date: "20 Juin 2026", type: "Consultation pré-op", status: "Terminé", notes: "Validation pour chirurgie." },
      ],
      documents: [
        { id: "d1", name: "Analyse_Sang_Juin2026.pdf", type: "Laboratoire", date: "18 Juin 2026" },
        { id: "d2", name: "Compte_rendu_operatoire.pdf", type: "Chirurgie", date: "16 Mai 2026" },
      ]
    },
    "2": {
      id: "2",
      name: "Mohamed L.",
      age: 54,
      bloodType: "A-",
      allergies: ["Aucune"],
      location: "Ksar, Nouakchott",
      phone: "+222 33 44 55 66",
      email: "mohamed.l@email.com",
      lastVisit: "La semaine dernière",
      condition: "Rééducation fonctionnelle",
      medicalHistory: [
        { id: "h1", date: "10 Mar 2026", type: "Traumatisme", description: "Entorse cheville droite", doctor: "Dr. Kane (Orthopédiste)" },
      ],
      consultations: [
        { id: "c1", date: "30 Juin 2026", type: "Séance kiné", status: "Terminé", notes: "Progrès constatés sur la mobilité." },
      ],
      documents: [
        { id: "d1", name: "Radiographie_Cheville.png", type: "Imagerie", date: "10 Mar 2026" },
      ]
    }
  };

  const patient = MOCK_PATIENTS[patientId] || MOCK_PATIENTS["1"];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-12">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{patient.name}</h1>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20">
              Actif
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 flex items-center gap-2 text-sm">
            <span>{patient.age} ans</span>
            <span>•</span>
            <span>{patient.bloodType}</span>
            <span>•</span>
            <span className="truncate">{patient.condition}</span>
          </p>
        </div>
        <div className="hidden sm:flex gap-2">
          <Button variant="outline" className="gap-2 rounded-xl">
            <Calendar className="h-4 w-4" />
            Nouveau RDV
          </Button>
          <Button className="gap-2 rounded-xl">
            <FileText className="h-4 w-4" />
            Ajouter un document
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
                Informations du patient
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-start gap-3">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Adresse</p>
                  <p className="text-sm text-muted-foreground">{patient.location}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Phone className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Téléphone</p>
                  <p className="text-sm text-muted-foreground">{patient.phone}</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Mail className="h-4 w-4 text-muted-foreground mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Email</p>
                  <p className="text-sm text-muted-foreground">{patient.email}</p>
                </div>
              </div>
              <Separator className="my-2" />
              <div className="flex items-start gap-3">
                <Shield className="h-4 w-4 text-destructive mt-0.5" />
                <div>
                  <p className="text-sm font-medium">Allergies</p>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.allergies.map((a: string) => (
                      <Badge key={a} variant="outline" className="bg-destructive/5 text-destructive border-destructive/20 text-xs">
                        {a}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Dernières Constantes
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <HeartPulse className="h-4 w-4 text-rose-500" />
                  <span className="text-sm font-medium">Tension</span>
                </div>
                <span className="text-sm">12/8</span>
              </div>
              <div className="flex justify-between items-center p-2 rounded-lg bg-muted/40">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4 text-amber-500" />
                  <span className="text-sm font-medium">Pouls</span>
                </div>
                <span className="text-sm">72 bpm</span>
              </div>
              <p className="text-xs text-muted-foreground text-center mt-2">Mesuré le {patient.lastVisit}</p>
            </CardContent>
          </Card>
        </div>

        {/* Colonne de droite: Historique et Documents */}
        <div className="lg:col-span-2 space-y-6">
          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40">
              <CardTitle className="text-lg flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historique des consultations
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <div className="divide-y divide-border/40">
                {patient.consultations.map((consultation: any) => (
                  <div key={consultation.id} className="p-4 sm:p-6 hover:bg-muted/20 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <Stethoscope className="h-4 w-4 text-primary" />
                        <h4 className="font-semibold">{consultation.type}</h4>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3.5 w-3.5" />
                          {consultation.date}
                        </span>
                        <Badge variant="secondary" className="text-xs">
                          {consultation.status}
                        </Badge>
                      </div>
                    </div>
                    <p className="text-sm text-muted-foreground pl-6 border-l-2 border-primary/20 ml-2 mt-2">
                      {consultation.notes}
                    </p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/40 shadow-sm">
            <CardHeader className="pb-4 border-b border-border/40 flex flex-row items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                Documents et Examens
              </CardTitle>
            </CardHeader>
            <CardContent className="p-4 sm:p-6">
              <div className="grid sm:grid-cols-2 gap-4">
                {patient.documents.map((doc: any) => (
                  <div key={doc.id} className="flex items-start gap-3 p-3 rounded-xl border border-border/40 bg-card hover:border-primary/30 transition-colors cursor-pointer group">
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
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
