import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import logo from "@/assets/logo.svg";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ArrowRight,
  CalendarCheck,
  Heart,
  MapPin,
  MessageCircle,
  Search,
  Shield,
  Star,
  Stethoscope,
  UserCheck,
  Users,
  Clock,
  CheckCircle2,
  Phone,
  Ambulance,
} from "lucide-react";
import { Link } from "react-router";

const fadeUp = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.6 },
};

const stagger = {
  initial: { opacity: 0, y: 24 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: "-80px" },
  transition: { duration: 0.5, staggerChildren: 0.1 },
};

export default function Landing() {
  return (
    <div className="min-h-screen">
      {/* ========== HERO ========== */}
      <section className="relative overflow-hidden">
        {/* Background decoration */}
        <div className="absolute inset-0 -z-10">
          <div className="absolute top-[-20%] right-[-10%] h-[600px] w-[600px] rounded-full bg-primary/5 blur-3xl" />
          <div className="absolute bottom-[-10%] left-[-5%] h-[400px] w-[400px] rounded-full bg-primary/3 blur-3xl" />
        </div>

        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 pt-20 pb-24 md:pt-28 md:pb-32">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
            className="text-center"
          >
            <Badge variant="secondary" className="mb-6 px-4 py-1.5 text-xs font-medium tracking-wide uppercase">
              🏥 Plateforme de soins à domicile en Mauritanie
            </Badge>
            <h1 className="text-4xl sm:text-5xl md:text-6xl lg:text-7xl font-bold tracking-tight text-foreground leading-[1.1]">
              Des soins de qualité,{" "}
              <span className="text-primary">à votre porte</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg sm:text-xl text-muted-foreground leading-relaxed">
              MauriCare connecte les patients en Mauritanie avec des professionnels
              de santé qualifiés pour des soins à domicile fiables, accessibles et
              humains.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/auth">
                <Button size="lg" className="h-12 px-8 text-base gap-2 rounded-xl shadow-lg shadow-primary/20">
                  Je cherche un soignant
                  <Search className="h-4 w-4" />
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2 rounded-xl border-primary/20">
                  Je propose mes services
                  <Stethoscope className="h-4 w-4" />
                </Button>
              </Link>
            </div>
            <div className="mt-10 flex items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Soignants vérifiés</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Paiement sécurisé</span>
              </div>
              <div className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-primary" />
                <span>Disponible 7j/7</span>
              </div>
            </div>
          </motion.div>

          {/* Stats strip */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 rounded-2xl border border-border/50 bg-card/60 backdrop-blur-sm p-6 sm:p-8 shadow-sm"
          >
            {[
              { value: "150+", label: "Professionnels inscrits" },
              { value: "500+", label: "Patients accompagnés" },
              { value: "12", label: "Villes couvertes" },
              { value: "98%", label: "Satisfaction" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <div className="text-2xl sm:text-3xl font-bold text-primary">{stat.value}</div>
                <div className="mt-1 text-xs sm:text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ========== FONCTIONNALITÉS ========== */}
      <section id="fonctionnalites" className="relative py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium">
              Fonctionnalités
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Tout ce dont vous avez besoin
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Une plateforme complète pour faciliter la mise en relation et le suivi des soins à domicile.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Search,
                title: "Recherche intelligente",
                desc: "Trouvez le professionnel idéal près de chez vous par spécialité, disponibilité et tarifs.",
              },
              {
                icon: CalendarCheck,
                title: "Réservation simplifiée",
                desc: "Planifiez vos séances de soins en quelques clics, sans paperasse ni files d'attente.",
              },
              {
                icon: MessageCircle,
                title: "Messagerie intégrée",
                desc: "Échangez directement avec les soignants pour discuter des besoins spécifiques du patient.",
              },
              {
                icon: Shield,
                title: "Profil vérifié",
                desc: "Chaque professionnel est authentifié avec diplômes et certifications vérifiés.",
              },
              {
                icon: MapPin,
                title: "Géolocalisation",
                desc: "Visualisez les soignants disponibles dans votre région et estimez les temps de trajet.",
              },
              {
                icon: Star,
                title: "Évaluations transparentes",
                desc: "Consultez les avis et notations des autres patients pour choisir en toute confiance.",
              },
            ].map((feature, i) => (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="group h-full border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                  <CardHeader>
                    <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center mb-2 group-hover:bg-primary/15 transition-colors">
                      <feature.icon className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{feature.title}</CardTitle>
                    <CardDescription className="text-sm leading-relaxed">
                      {feature.desc}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== COMMENT ÇA MARCHE ========== */}
      <section id="comment-ca-marche" className="relative py-20 md:py-28 bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium">
              Guide
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Comment ça marche
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Que vous soyez patient ou professionnel de santé, voici comment MauriCare simplifie votre quotidien.
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 gap-12 lg:gap-16">
            {/* Patient flow */}
            <motion.div
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <Users className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Pour les patients</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: "1", title: "Créez votre profil", desc: "Inscrivez-vous et renseignez vos besoins de soins." },
                  { step: "2", title: "Recherchez un soignant", desc: "Parcourez les profils vérifiés près de chez vous." },
                  { step: "3", title: "Réservez une séance", desc: "Choisissez la date et l'horaire qui vous conviennent." },
                  { step: "4", title: "Recevez des soins à domicile", desc: "Le professionnel se déplace chez vous en toute sérénité." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary text-primary-foreground text-sm font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>

            {/* Provider flow */}
            <motion.div
              initial={{ opacity: 0, x: 20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true, margin: "-80px" }}
              transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="flex items-center gap-3 mb-8">
                <div className="flex items-center justify-center w-10 h-10 rounded-xl bg-primary/10">
                  <Stethoscope className="h-5 w-5 text-primary" />
                </div>
                <h3 className="text-xl font-semibold">Pour les professionnels</h3>
              </div>
              <div className="space-y-6">
                {[
                  { step: "1", title: "Inscrivez-vous", desc: "Créez votre profil avec vos diplômes et certifications." },
                  { step: "2", title: "Définissez vos disponibilités", desc: "Indiquez vos créneaux et votre zone d'intervention." },
                  { step: "3", title: "Recevez des demandes", desc: "Acceptez les patients qui correspondent à votre profil." },
                  { step: "4", title: "Soignez et gagnez", desc: "Prodiguez des soins et recevez votre rémunération." },
                ].map((item) => (
                  <div key={item.step} className="flex gap-4">
                    <div className="flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-full bg-primary/15 text-primary text-sm font-bold">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="font-medium text-foreground">{item.title}</h4>
                      <p className="text-sm text-muted-foreground mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          </div>
        </div>
      </section>

      {/* ========== PROFESSIONNELS DISPONIBLES ========== */}
      <section className="relative py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium">
              Professionnels
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Trouvez le bon professionnel
            </h2>
            <p className="mt-4 text-lg text-muted-foreground max-w-2xl mx-auto">
              Notre plateforme regroupe une large gamme de professionnels de santé pour répondre à tous vos besoins.
            </p>
          </motion.div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              { icon: Users, title: "Infirmiers", desc: "Soins infirmiers, pansements, injections", color: "text-blue-500" },
              { icon: Heart, title: "Aides-soignants", desc: "Assistance quotidienne, hygiène, confort", color: "text-rose-500" },
              { icon: Stethoscope, title: "Médecins", desc: "Consultations, suivis médicaux", color: "text-emerald-500" },
              { icon: Ambulance, title: "Kinésithérapeutes", desc: "Rééducation, massages thérapeutiques", color: "text-violet-500" },
            ].map((prof) => (
              <motion.div
                key={prof.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="h-full border-border/50 bg-card/60 backdrop-blur-sm hover:border-primary/20 hover:shadow-lg transition-all duration-300 text-center">
                  <CardHeader>
                    <div className="mx-auto flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/5 mb-3">
                      <prof.icon className={`h-7 w-7 ${prof.color} opacity-80`} />
                    </div>
                    <CardTitle className="text-lg">{prof.title}</CardTitle>
                    <CardDescription className="text-sm">{prof.desc}</CardDescription>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== TÉMOIGNAGES ========== */}
      <section className="relative py-20 md:py-28 bg-muted/40">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div {...fadeUp} className="text-center mb-16">
            <Badge variant="secondary" className="mb-4 px-3 py-1 text-xs font-medium">
              Témoignages
            </Badge>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight">
              Ce qu&rsquo;ils disent de nous
            </h2>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                name: "Aïcha M.",
                role: "Patiente, Nouakchott",
                text: "Grâce à MauriCare, j'ai trouvé une infirmière formidable pour ma mère. Les soins à domicile ont changé sa qualité de vie.",
                rating: 5,
              },
              {
                name: "Dr. Sidi O.",
                role: "Médecin généraliste",
                text: "MauriCare me permet d'atteindre des patients qui ne peuvent pas se déplacer. La plateforme est intuitive et fiable.",
                rating: 5,
              },
              {
                name: "Fatimata D.",
                role: "Infirmière, Nouadhibou",
                text: "Je peux enfin exercer mon métier avec flexibilité tout en étant payée équitablement. Une révolution pour les soignants en Mauritanie.",
                rating: 5,
              },
            ].map((testimonial, i) => (
              <motion.div
                key={testimonial.name}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.5, delay: i * 0.1, ease: [0.22, 1, 0.36, 1] }}
              >
                <Card className="h-full border-border/50 bg-card/60 backdrop-blur-sm">
                  <CardHeader>
                    <div className="flex gap-0.5 mb-3">
                      {Array.from({ length: testimonial.rating }).map((_, j) => (
                        <Star key={j} className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                      ))}
                    </div>
                    <CardDescription className="text-sm leading-relaxed text-foreground/80 italic">
                      &ldquo;{testimonial.text}&rdquo;
                    </CardDescription>
                    <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border/40">
                      <div className="h-10 w-10 rounded-full bg-primary/10 ring-2 ring-border/30 flex items-center justify-center text-xs font-medium text-primary shrink-0">
                      {testimonial.name.split(" ").map(n => n[0]).join("")}
                    </div>
                      <div>
                        <div className="text-sm font-medium">{testimonial.name}</div>
                        <div className="text-xs text-muted-foreground">{testimonial.role}</div>
                      </div>
                    </div>
                  </CardHeader>
                </Card>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="relative py-20 md:py-28">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className="relative overflow-hidden rounded-2xl bg-primary/5 border border-primary/10 p-8 sm:p-12 lg:p-16 text-center"
          >
            <div className="absolute top-[-20%] right-[-10%] h-[300px] w-[300px] rounded-full bg-primary/10 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[-10%] h-[300px] w-[300px] rounded-full bg-primary/5 blur-3xl" />
            <div className="relative">
              <Heart className="h-10 w-10 text-primary mx-auto mb-6" />
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
                Prêt à rejoindre MauriCare ?
              </h2>
              <p className="text-lg text-muted-foreground max-w-xl mx-auto mb-8">
                Que vous ayez besoin de soins ou que vous souhaitiez offrir vos services,
                rejoignez la première plateforme de soins à domicile en Mauritanie.
              </p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link to="/auth">
                  <Button size="lg" className="h-12 px-8 text-base gap-2 rounded-xl shadow-lg shadow-primary/20">
                    Commencer maintenant
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/auth">
                  <Button size="lg" variant="outline" className="h-12 px-8 text-base gap-2 rounded-xl border-primary/20">
                    <Phone className="h-4 w-4" />
                    Contactez-nous
                  </Button>
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ========== FOOTER ========== */}
      <footer className="border-t border-border/40 bg-background">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8 py-12">
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-8">
            <div>
              <div className="flex items-center gap-2 mb-4">
                <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10">
                  <img src={logo} alt="MauriCare" className="w-5 h-5" />
                </div>
                <span className="font-semibold">Mauri<span className="text-primary">Care</span></span>
              </div>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Connecter les patients et les professionnels de santé en Mauritanie pour des soins à domicile accessibles à tous.
              </p>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Plateforme</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><Link to="/#fonctionnalites" className="hover:text-foreground transition-colors">Fonctionnalités</Link></li>
                <li><Link to="/#comment-ca-marche" className="hover:text-foreground transition-colors">Comment ça marche</Link></li>
                <li><Link to="/auth" className="hover:text-foreground transition-colors">S&rsquo;inscrire</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Professionnels</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li><span className="hover:text-foreground transition-colors cursor-default">Infirmiers</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-default">Aides-soignants</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-default">Médecins</span></li>
                <li><span className="hover:text-foreground transition-colors cursor-default">Kinésithérapeutes</span></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-sm mb-4">Contact</h4>
              <ul className="space-y-2 text-sm text-muted-foreground">
                <li className="flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5" />
                  Nouakchott, Mauritanie
                </li>
                <li className="flex items-center gap-2">
                  <MessageCircle className="h-3.5 w-3.5" />
                  contact@mauricare.mr
                </li>
                <li className="flex items-center gap-2">
                  <Clock className="h-3.5 w-3.5" />
                  7j/7 — 8h à 20h
                </li>
              </ul>
            </div>
          </div>
          <div className="mt-12 pt-8 border-t border-border/40 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <p>&copy; {new Date().getFullYear()} MauriCare. Tous droits réservés.</p>
            <p className="text-xs">
              Fait avec <Heart className="h-3 w-3 inline text-primary" /> pour la Mauritanie
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
