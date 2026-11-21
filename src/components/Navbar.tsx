import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import logo from "@/assets/logo.svg";
import { Heart, LogOut, Menu, Shield, User, X } from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { LanguageSwitcher } from "./LanguageSwitcher";

export function Navbar() {
  const { t } = useTranslation();
  const { isAuthenticated, signOut, user, role, isAdmin } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    try {
      await signOut();
      navigate("/");
    } catch (error) {
      console.error("Erreur de déconnexion:", error);
    }
  };

  return (
    <nav className="sticky top-0 z-50 w-full border-b border-border/40 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Logo */}
        <Link to="/" className="flex items-center gap-3 group">
          <div className="relative flex items-center justify-center w-9 h-9 rounded-xl bg-primary/10 group-hover:bg-primary/15 transition-colors">
            <img src={logo} alt="MauriCare" className="w-6 h-6" />
          </div>
          <span className="text-lg font-semibold tracking-tight text-foreground">
            Mauri<span className="text-primary">Care</span>
          </span>
        </Link>

        {/* Desktop nav links */}
        <div className="hidden md:flex items-center gap-8">
          <Link
            to="/"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.home", "Accueil")}
          </Link>
          <Link
            to="/#fonctionnalites"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.features", "Fonctionnalités")}
          </Link>
          <Link
            to="/#comment-ca-marche"
            className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors"
          >
            {t("nav.how_it_works", "Comment ça marche")}
          </Link>
          {isAuthenticated && !isAdmin && (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-primary hover:text-primary/80 transition-colors"
            >
              {t("nav.dashboard", "Tableau de bord")}
            </Link>
          )}
          {isAuthenticated && isAdmin && (
            <Link
              to="/admin"
              className="text-sm font-medium text-amber-600 dark:text-amber-400 hover:opacity-80 transition-colors flex items-center gap-1"
            >
              <Shield className="h-3.5 w-3.5" />
              {t("nav.admin", "Administration")}
            </Link>
          )}
        </div>

        {/* Auth buttons & Lang */}
        <div className="hidden md:flex items-center gap-3">
          <LanguageSwitcher />
          {isAuthenticated ? (
            <div className="flex items-center gap-3">
              <Link to={isAdmin ? "/admin" : "/dashboard"}>
                <Button variant="ghost" size="sm" className="gap-2">
                  <User className="h-4 w-4" />
                  <span className="truncate max-w-[120px]">
                    {user?.name || (isAdmin ? t("nav.admin", "Administration") : t("nav.my_account", "Mon compte"))}
                  </span>
                </Button>
              </Link>
              <Button
                variant="outline"
                size="sm"
                onClick={handleSignOut}
                className="gap-2"
              >
                <LogOut className="h-4 w-4" />
                {t("nav.logout", "Déconnexion")}
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link to="/auth">
                <Button variant="ghost" size="sm">
                  {t("nav.login", "Se connecter")}
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="sm" className="gap-2">
                  <Heart className="h-4 w-4" />
                  {t("nav.register", "S'inscrire")}
                </Button>
              </Link>
            </div>
          )}
        </div>

        {/* Mobile menu button */}
        <button
          onClick={() => setMobileOpen(!mobileOpen)}
          className="md:hidden p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
          aria-label="Menu"
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      {/* Mobile menu */}
      {mobileOpen && (
        <div className="md:hidden border-t border-border/40 bg-background animate-slide-down">
          <div className="flex flex-col gap-1 px-4 py-4">
            <Link
              to="/"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {t("nav.home", "Accueil")}
            </Link>
            <Link
              to="/#fonctionnalites"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {t("nav.features", "Fonctionnalités")}
            </Link>
            <Link
              to="/#comment-ca-marche"
              onClick={() => setMobileOpen(false)}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-accent transition-colors"
            >
              {t("nav.how_it_works", "Comment ça marche")}
            </Link>
            <div className="border-t border-border/40 my-2" />
            <div className="px-3 py-2.5">
              <LanguageSwitcher />
            </div>
            {isAuthenticated ? (
              <>
                {!isAdmin ? (
                  <Link
                    to="/dashboard"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-primary hover:bg-accent transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    {t("nav.dashboard", "Tableau de bord")}
                  </Link>
                ) : (
                  <Link
                    to="/admin"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-amber-600 dark:text-amber-400 hover:bg-accent transition-colors"
                  >
                    <Shield className="h-4 w-4" />
                    {t("nav.admin", "Administration")}
                  </Link>
                )}
                <button
                  onClick={() => {
                    setMobileOpen(false);
                    handleSignOut();
                  }}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4" />
                  {t("nav.logout", "Déconnexion")}
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-foreground hover:bg-accent transition-colors"
                >
                  {t("nav.login", "Se connecter")}
                </Link>
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors"
                >
                  <Heart className="h-4 w-4" />
                  {t("nav.register", "S'inscrire")}
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
