import { useParams, useNavigate } from "react-router";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, Star, MapPin, Calendar, Clock, CheckCircle2, Navigation, MessageCircle } from "lucide-react";

export default function ProviderDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  // Simulation: On utilise des données statiques pour le MVP
  const provider = {
    id: id,
    name: "Dr. Camara",
    specialty: "Médecin généraliste",
    rating: 4.9,
    reviews: 128,
    distance: "1.2 km",
    price: "15 000 MRU",
    image: "https://i.pravatar.cc/150?img=11",
    bio: "Le Dr. Camara est un médecin généraliste expérimenté, dévoué à offrir des soins de qualité avec une approche humaine et personnalisée. Spécialisé dans le suivi des maladies chroniques et la médecine préventive.",
    education: [
      "Diplôme d'État de Docteur en Médecine - Faculté de Médecine",
      "DIU Médecine générale"
    ],
    availability: "Disponible aujourd'hui",
    phone: "+222 11 22 33 44",
  };

  const mockReviews = [
    { id: 1, author: "Ahmed M.", rating: 5, date: "Il y a 2 jours", text: "Très professionnel et ponctuel. Les soins ont été faits avec beaucoup de douceur. Je recommande vivement !" },
    { id: 2, author: "Fatima D.", rating: 4, date: "Semaine dernière", text: "Bon contact, a pris le temps de m'expliquer le traitement." },
    { id: 3, author: "Oumar S.", rating: 5, date: "Il y a 1 mois", text: "Excellente prestation, très à l'écoute du patient." },
  ];

  return (
    <div className="min-h-screen bg-background pb-24">
      {/* Header / Bannière */}
      <div className="relative h-48 bg-gradient-to-br from-emerald-600 to-emerald-800 flex items-center p-6">
        <Button 
          variant="ghost" 
          size="icon" 
          className="absolute top-4 left-4 text-white hover:bg-white/20 hover:text-white rounded-full z-10"
          onClick={() => navigate("/dashboard")}
        >
          <ArrowLeft className="h-6 w-6" />
        </Button>
        <div className="absolute inset-0 bg-black/10" />
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 -mt-16 relative z-10">
        <div className="flex flex-col md:flex-row gap-6">
          {/* Left Column (Info Principale) */}
          <div className="flex-1 space-y-6">
            {/* Profil Card */}
            <Card className="border-border/40 shadow-xl shadow-primary/5 bg-card/95 backdrop-blur-xl">
              <CardContent className="p-6">
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
                  <div className="h-32 w-32 rounded-full border-4 border-background shadow-lg overflow-hidden shrink-0 bg-white">
                    <img src={provider.image} alt={provider.name} className="h-full w-full object-cover" />
                  </div>
                  <div className="text-center sm:text-left flex-1 mt-2 sm:mt-0">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                      <h1 className="text-2xl font-bold">{provider.name}</h1>
                      <Badge variant="secondary" className="w-fit mx-auto sm:mx-0 bg-emerald-500/10 text-emerald-600 hover:bg-emerald-500/20">
                        {provider.price}
                      </Badge>
                    </div>
                    <p className="text-primary font-medium mb-3">{provider.specialty}</p>
                    
                    <div className="flex flex-wrap items-center justify-center sm:justify-start gap-4 text-sm text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
                        <span className="font-medium text-foreground">{provider.rating}</span>
                        <span>({provider.reviews} avis)</span>
                      </div>
                      <div className="flex items-center gap-1">
                        <MapPin className="h-4 w-4 text-primary" />
                        <span>{provider.distance}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <Separator className="my-6" />

                <div>
                  <h3 className="font-semibold mb-2">À propos</h3>
                  <p className="text-sm text-muted-foreground leading-relaxed">
                    {provider.bio}
                  </p>
                </div>
              </CardContent>
            </Card>

            {/* Avis Card */}
            <Card className="border-border/40 shadow-md">
              <CardContent className="p-6">
                <h3 className="font-semibold mb-4">Derniers avis</h3>
                <div className="space-y-4">
                  {mockReviews.map((review) => (
                    <div key={review.id} className="bg-muted/30 p-4 rounded-xl">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <p className="text-sm font-semibold">{review.author}</p>
                          <div className="flex items-center gap-1 mt-0.5">
                            {[...Array(5)].map((_, i) => (
                              <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-yellow-400 text-yellow-400" : "fill-muted text-muted"}`} />
                            ))}
                          </div>
                        </div>
                        <span className="text-[10px] text-muted-foreground">{review.date}</span>
                      </div>
                      <p className="text-sm text-muted-foreground">{review.text}</p>
                    </div>
                  ))}
                </div>
                <Button variant="outline" className="w-full mt-4">
                  Voir tous les avis
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Right Column (Actions & Réservation) */}
          <div className="w-full md:w-80 space-y-6">
            <Card className="border-border/40 shadow-xl shadow-primary/5 bg-card sticky top-6">
              <CardContent className="p-6 space-y-6">
                <div>
                  <h3 className="font-semibold mb-4">Prendre rendez-vous</h3>
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100">
                      <CheckCircle2 className="h-5 w-5" />
                      <div>
                        <p className="text-sm font-medium">Nouveau patient accepté</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 p-3 rounded-lg bg-muted/50 border border-border/50">
                      <Calendar className="h-5 w-5 text-primary" />
                      <div>
                        <p className="text-xs text-muted-foreground">Prochaine disponibilité</p>
                        <p className="text-sm font-medium">{provider.availability}</p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  <Button className="w-full gap-2 py-6 rounded-xl shadow-lg shadow-primary/20 hover:shadow-primary/30 transition-all">
                    <Calendar className="h-5 w-5" />
                    Réserver un créneau
                  </Button>
                  <div className="flex gap-2">
                    <Button variant="outline" className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5">
                      <MessageCircle className="h-4 w-4" />
                      Message
                    </Button>
                    <Button variant="outline" className="flex-1 gap-2 border-primary/20 text-primary hover:bg-primary/5">
                      <Navigation className="h-4 w-4" />
                      Itinéraire
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
