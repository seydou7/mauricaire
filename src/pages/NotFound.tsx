import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Home, Search } from "lucide-react";
import { Link } from "react-router";

export default function NotFound() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
      className="min-h-[calc(100vh-4rem)] flex flex-col"
    >
      <div className="flex-1 flex flex-col items-center justify-center px-4">
        <div className="max-w-md mx-auto text-center">
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="text-8xl font-bold text-primary/20 select-none">404</div>
          </motion.div>
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          >
            <h1 className="text-2xl font-bold mt-4 mb-2">
              Page non trouvée
            </h1>
            <p className="text-muted-foreground mb-8 leading-relaxed">
              Désolés, cette page n&rsquo;existe pas ou a été déplacée.
              Revenez à l&rsquo;accueil pour continuer votre parcours sur MauriCare.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link to="/">
                <Button size="lg" className="rounded-xl gap-2">
                  <Home className="h-4 w-4" />
                  Retour à l&rsquo;accueil
                </Button>
              </Link>
              <Link to="/auth">
                <Button size="lg" variant="outline" className="rounded-xl gap-2">
                  <Search className="h-4 w-4" />
                  Se connecter
                </Button>
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    </motion.div>
  );
}
