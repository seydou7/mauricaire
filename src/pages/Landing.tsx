import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  ArrowLeft,
  CalendarCheck,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Stethoscope,
  Users,
  CheckCircle2,
  Phone,
  Activity,
  UserPlus,
  FileText,
  CalendarDays
} from "lucide-react";
import { Link } from "react-router";
import { useTranslation } from "react-i18next";

export default function Landing() {
  const { t, i18n } = useTranslation();
  const isRtl = i18n.language === "ar";
  const ArrowIcon = isRtl ? ArrowLeft : ArrowRight;

  return (
    <div
      dir={isRtl ? "rtl" : "ltr"}
      className="min-h-screen bg-background selection:bg-primary/20"
    >
      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden pt-20 pb-20 md:pt-32 md:pb-32">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-10%] right-[-5%] h-[600px] w-[600px] rounded-full bg-primary/10 blur-[120px]" />
          <div className="absolute bottom-[-20%] left-[-10%] h-[500px] w-[500px] rounded-full bg-emerald-500/10 blur-[100px]" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center max-w-4xl mx-auto">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.5 }}
            >
              <Badge variant="secondary" className="mb-8 px-4 py-1.5 text-sm font-medium tracking-wide bg-primary/10 text-primary border-primary/20">
                {t("landing.hero_badge", "🚀 La plateforme n°1 de e-santé en Mauritanie")}
              </Badge>
            </motion.div>
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              className="text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-foreground leading-[1.15]"
            >
              {t("landing.hero_title_prefix", "Votre santé n'a jamais été aussi ")}
              <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-emerald-500">
                {t("landing.hero_title_highlight", "accessible")}
              </span>
            </motion.h1>
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.2 }}
              className="mt-8 text-xl md:text-2xl text-muted-foreground leading-relaxed font-light"
            >
              {t("landing.hero_subtitle", "Trouvez le bon médecin en quelques clics, réservez vos consultations sans attendre, et gardez votre dossier médical toujours à portée de main avec MauriCare.")}
            </motion.p>
            <motion.div 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.3 }}
              className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-6"
            >
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold gap-2 rounded-2xl shadow-xl shadow-primary/25 bg-primary hover:bg-primary/90 text-primary-foreground hover:scale-105 transition-all">
                  {t("landing.hero_cta_patient", "Créer mon compte patient")}
                  <ArrowIcon className="h-5 w-5" />
                </Button>
              </Link>
              <Link to="/auth" className="w-full sm:w-auto">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-semibold gap-2 rounded-2xl border-2 border-primary/20 hover:bg-primary/5 hover:border-primary/40 transition-all">
                  {t("landing.hero_cta_pro", "Je suis un professionnel")}
                  <Stethoscope className="h-5 w-5" />
                </Button>
              </Link>
            </motion.div>
            
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 1, delay: 0.6 }}
              className="mt-12 flex flex-wrap items-center justify-center gap-6 text-sm font-medium text-muted-foreground"
            >
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                {t("landing.trust_free", "100% Gratuit pour les patients")}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                {t("landing.trust_secure", "Données hautement sécurisées")}
              </div>
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center"><CheckCircle2 className="h-4 w-4 text-emerald-600" /></div>
                {t("landing.trust_247", "Prise de RDV 24/7")}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== POURQUOI CHOISIR MAURICARE ? ========== */}
      <section className="py-20 bg-muted/30 border-y border-border/50">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">
              {t("landing.why_title", "Fini les files d'attente interminables")}
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              {t("landing.why_subtitle", "MauriCare digitalise et simplifie tout votre parcours de soins, de la recherche du médecin jusqu'au suivi après la consultation.")}
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <Card className="bg-card border-none shadow-lg shadow-primary/5 hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-blue-500/10 flex items-center justify-center mb-4">
                  <Search className="h-7 w-7 text-blue-500" />
                </div>
                <CardTitle className="text-xl mb-2">
                  {t("landing.feature_search_title", "Recherche intelligente")}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("landing.feature_search_desc", "Trouvez le praticien qu'il vous faut (Médecin, Infirmier, Aide-soignant) près de chez vous. Consultez ses disponibilités et avis en temps réel.")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card border-none shadow-lg shadow-primary/5 hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-4">
                  <CalendarDays className="h-7 w-7 text-emerald-500" />
                </div>
                <CardTitle className="text-xl mb-2">
                  {t("landing.feature_booking_title", "Rendez-vous en ligne")}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("landing.feature_booking_desc", "Fini les appels qui n'aboutissent pas. Choisissez un créneau qui vous convient et réservez votre consultation 24h/24 et 7j/7 depuis votre téléphone.")}
                </CardDescription>
              </CardHeader>
            </Card>

            <Card className="bg-card border-none shadow-lg shadow-primary/5 hover:-translate-y-1 transition-transform">
              <CardHeader>
                <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center mb-4">
                  <FileText className="h-7 w-7 text-purple-500" />
                </div>
                <CardTitle className="text-xl mb-2">
                  {t("landing.feature_record_title", "Votre dossier médical digital")}
                </CardTitle>
                <CardDescription className="text-base">
                  {t("landing.feature_record_desc", "Centralisez vos ordonnances, résultats d'analyses et historiques médicaux dans un espace sécurisé partagé avec vos médecins.")}
                </CardDescription>
              </CardHeader>
            </Card>
          </div>
        </div>
      </section>

      {/* ========== FONCTIONNALITÉS EN IMAGES ========== */}
      <section id="fonctionnalites" className="relative py-24 overflow-hidden">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="space-y-32">
            
            {/* Feature 1 : Recherche */}
            <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
              <motion.div 
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-6"
              >
                <Badge variant="outline" className="border-primary/30 text-primary bg-primary/5 text-sm px-3 py-1">
                  {t("landing.section_patients_badge", "Pour les Patients")}
                </Badge>
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight">
                  {t("landing.section_patients_title", "Le plus grand réseau de santé de Mauritanie")}
                </h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.section_patients_desc", "Accédez à un annuaire complet de professionnels de la santé. Vérifiez leurs spécialités, leurs lieux d'exercice, et réservez instantanément sans aucun frais.")}
                </p>
                <ul className="space-y-4 mt-8">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-primary/20 p-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
                    <span className="text-lg">{t("landing.section_patients_bullet_1", "Recherche filtrée par ville et spécialité")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-primary/20 p-1 rounded-full"><CheckCircle2 className="w-4 h-4 text-primary" /></div>
                    <span className="text-lg">{t("landing.section_patients_bullet_2", "Accès direct aux plannings des praticiens")}</span>
                  </li>
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 relative"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-primary/20 to-emerald-500/20 blur-[80px] -z-10 rounded-full" />
                <img
                  src="/src/assets/images/search.png"
                  alt={t("landing.img_alt_search", "Recherche Médecin")}
                  className="rounded-3xl shadow-2xl border border-border/50 hover:scale-[1.02] transition-transform duration-500"
                />
              </motion.div>
            </div>

            {/* Feature 2 : Dashboard Patient */}
            <div className="flex flex-col md:flex-row-reverse items-center gap-12 lg:gap-20">
              <motion.div 
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-6"
              >
                <Badge variant="outline" className="border-blue-500/30 text-blue-600 bg-blue-500/5 text-sm px-3 py-1">
                  {t("landing.section_dashboard_badge", "Tableau de bord")}
                </Badge>
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight">
                  {t("landing.section_dashboard_title", "Prenez le contrôle de votre santé")}
                </h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.section_dashboard_desc", "Votre espace personnel vous permet de suivre votre santé au jour le jour. Ne perdez plus vos ordonnances et gardez une trace de toutes vos visites.")}
                </p>
                <ul className="space-y-4 mt-8">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-blue-500/20 p-1 rounded-full"><Activity className="w-4 h-4 text-blue-600" /></div>
                    <span className="text-lg">{t("landing.section_dashboard_bullet_1", "Suivi des constantes (Tension, rythme cardiaque)")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-blue-500/20 p-1 rounded-full"><FileText className="w-4 h-4 text-blue-600" /></div>
                    <span className="text-lg">{t("landing.section_dashboard_bullet_2", "Centralisation de vos documents médicaux")}</span>
                  </li>
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 relative"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-blue-500/20 to-indigo-500/20 blur-[80px] -z-10 rounded-full" />
                <img
                  src="/src/assets/images/patient.png"
                  alt={t("landing.img_alt_patient", "Dashboard Patient")}
                  className="rounded-3xl shadow-2xl border border-border/50 hover:scale-[1.02] transition-transform duration-500"
                />
              </motion.div>
            </div>

            {/* Feature 3 : Pour les Pros */}
            <div className="flex flex-col md:flex-row items-center gap-12 lg:gap-20">
              <motion.div 
                initial={{ opacity: 0, x: -40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 space-y-6"
              >
                <Badge variant="outline" className="border-teal-500/30 text-teal-600 bg-teal-500/5 text-sm px-3 py-1">
                  {t("landing.section_pro_badge", "Pour les Professionnels")}
                </Badge>
                <h3 className="text-3xl sm:text-4xl font-bold leading-tight">
                  {t("landing.section_pro_title", "Digitalisez votre pratique médicale")}
                </h3>
                <p className="text-xl text-muted-foreground leading-relaxed">
                  {t("landing.section_pro_desc", "Que vous soyez médecin, infirmier ou aide-soignant, MauriCare vous offre les outils pour gérer votre cabinet virtuel, accepter des consultations et suivre vos patients efficacement.")}
                </p>
                <ul className="space-y-4 mt-8">
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-teal-500/20 p-1 rounded-full"><Users className="w-4 h-4 text-teal-600" /></div>
                    <span className="text-lg">{t("landing.section_pro_bullet_1", "Gagnez en visibilité auprès de milliers de patients")}</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <div className="mt-1 bg-teal-500/20 p-1 rounded-full"><CalendarCheck className="w-4 h-4 text-teal-600" /></div>
                    <span className="text-lg">{t("landing.section_pro_bullet_2", "Gérez facilement vos plannings et rendez-vous")}</span>
                  </li>
                </ul>
              </motion.div>
              <motion.div 
                initial={{ opacity: 0, x: 40 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true, margin: "-100px" }}
                className="flex-1 relative"
              >
                <div className="absolute inset-0 bg-gradient-to-tr from-teal-500/20 to-emerald-500/20 blur-[80px] -z-10 rounded-full" />
                <img
                  src="/src/assets/images/pro.png"
                  alt={t("landing.img_alt_pro", "Dashboard Professionnel")}
                  className="rounded-3xl shadow-2xl border border-border/50 hover:scale-[1.02] transition-transform duration-500"
                />
              </motion.div>
            </div>

          </div>
        </div>
      </section>

      {/* ========== COMMENT ÇA MARCHE ========== */}
      <section id="comment-ca-marche" className="py-24 bg-primary/5">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-16">
            {t("landing.how_it_works_title", "Comment ça marche ?")}
          </h2>
          
          <div className="grid md:grid-cols-3 gap-12 relative">
            <div className="hidden md:block absolute top-12 left-[15%] right-[15%] h-0.5 bg-gradient-to-r from-transparent via-primary/30 to-transparent -z-10" />
            
            <div className="relative">
              <div className="mx-auto w-24 h-24 bg-background rounded-full border-4 border-primary/20 flex items-center justify-center mb-6 shadow-xl text-3xl font-bold text-primary">
                1
              </div>
              <h3 className="text-xl font-bold mb-3">{t("landing.step_1_title", "Créez votre profil")}</h3>
              <p className="text-muted-foreground px-4">
                {t("landing.step_1_desc", "Inscription rapide et 100% sécurisée. Renseignez vos informations de base en quelques secondes.")}
              </p>
            </div>
            
            <div className="relative">
              <div className="mx-auto w-24 h-24 bg-background rounded-full border-4 border-primary/20 flex items-center justify-center mb-6 shadow-xl text-3xl font-bold text-primary">
                2
              </div>
              <h3 className="text-xl font-bold mb-3">{t("landing.step_2_title", "Trouvez un spécialiste")}</h3>
              <p className="text-muted-foreground px-4">
                {t("landing.step_2_desc", "Recherchez le praticien qu'il vous faut par ville ou spécialité et consultez ses disponibilités.")}
              </p>
            </div>
            
            <div className="relative">
              <div className="mx-auto w-24 h-24 bg-primary rounded-full border-4 border-primary/20 flex items-center justify-center mb-6 shadow-xl text-3xl font-bold text-primary-foreground">
                3
              </div>
              <h3 className="text-xl font-bold mb-3">{t("landing.step_3_title", "Réservez votre RDV")}</h3>
              <p className="text-muted-foreground px-4">
                {t("landing.step_3_desc", "Confirmez votre rendez-vous d'un clic. Le médecin est notifié et vous recevez un rappel.")}
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ========== CTA FINAL ========== */}
      <section className="py-24">
        <div className="mx-auto max-w-5xl px-4 sm:px-6 lg:px-8">
          <div className="relative overflow-hidden rounded-3xl bg-primary px-6 py-16 sm:p-20 text-center shadow-2xl">
            <div className="absolute top-0 right-0 -mr-20 -mt-20 w-72 h-72 rounded-full bg-white opacity-10 blur-3xl" />
            <div className="absolute bottom-0 left-0 -ml-20 -mb-20 w-72 h-72 rounded-full bg-white opacity-10 blur-3xl" />
            
            <h2 className="relative z-10 text-3xl sm:text-5xl font-bold tracking-tight text-white mb-6">
              {t("landing.final_cta_title", "Rejoignez la plateforme santé de référence")}
            </h2>
            <p className="relative z-10 text-lg sm:text-xl text-primary-foreground/90 max-w-2xl mx-auto mb-10">
              {t("landing.final_cta_desc", "Que vous soyez un patient soucieux de sa santé ou un professionnel (médecin, infirmier, aide-soignant) souhaitant digitaliser son activité, MauriCare est fait pour vous.")}
            </p>
            
            <div className="relative z-10 flex flex-col sm:flex-row justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="w-full sm:w-auto h-14 px-8 text-lg font-bold bg-white text-primary hover:bg-gray-100 rounded-2xl shadow-xl transition-transform hover:scale-105">
                  <UserPlus className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
                  {t("landing.final_cta_patient", "Je suis un patient")}
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="w-full sm:w-auto h-14 px-8 text-lg font-bold text-white border-white/30 hover:bg-white/10 rounded-2xl shadow-xl transition-transform hover:scale-105">
                  <Stethoscope className="mr-2 h-5 w-5 rtl:ml-2 rtl:mr-0" />
                  {t("landing.final_cta_pro", "Je suis un professionnel")}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/40 bg-background pt-16 pb-8">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-12 mb-12">
            <div className="col-span-1 md:col-span-2">
              <div className="flex items-center gap-2 mb-6">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10 border border-primary/20">
                  <img src={logo} alt="MauriCare" className="w-6 h-6" />
                </div>
                <span className="font-bold text-2xl tracking-tight">Mauri<span className="text-primary">Care</span></span>
              </div>
              <p className="text-muted-foreground text-sm max-w-sm leading-relaxed">
                {t("landing.footer_tagline", "La première plateforme e-santé en Mauritanie conçue pour rapprocher les patients de leurs professionnels de santé. Simple, rapide et sécurisé.")}
              </p>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4 uppercase text-xs tracking-wider">
                {t("landing.footer_quick_links", "Liens Rapides")}
              </h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li><Link to="/#fonctionnalites" className="hover:text-primary transition-colors">{t("landing.footer_features", "Fonctionnalités")}</Link></li>
                <li><Link to="/#comment-ca-marche" className="hover:text-primary transition-colors">{t("landing.footer_how_it_works", "Comment ça marche ?")}</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">{t("landing.footer_signup_patient", "Inscription Patient")}</Link></li>
                <li><Link to="/auth" className="hover:text-primary transition-colors">{t("landing.footer_signup_pro", "Inscription Pro")}</Link></li>
              </ul>
            </div>
            
            <div>
              <h4 className="font-semibold text-foreground mb-4 uppercase text-xs tracking-wider">
                {t("landing.footer_contact_support", "Contact & Support")}
              </h4>
              <ul className="space-y-3 text-sm text-muted-foreground">
                <li className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-primary shrink-0" />
                  <span>{t("landing.footer_address", "Nouakchott, Mauritanie")}</span>
                </li>
                <li className="flex items-center gap-3">
                  <MessageCircle className="h-4 w-4 text-primary shrink-0" />
                  <span dir="ltr">support@mauricare.mr</span>
                </li>
                <li className="flex items-center gap-3">
                  <Phone className="h-4 w-4 text-primary shrink-0" />
                  <span dir="ltr">+222 45 00 00 00</span>
                </li>
              </ul>
            </div>
          </div>
          
          <div className="pt-8 border-t border-border/40 flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} {t("app.title", "MauriCare")}. {t("landing.footer_all_rights", "Tous droits réservés.")}</p>
            <p className="flex items-center gap-1">
              {t("landing.footer_made_with", "Fait avec")} <Heart className="h-4 w-4 text-rose-500 fill-rose-500 mx-1" /> {t("landing.footer_for_mauritania", "pour la Mauritanie")}
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
