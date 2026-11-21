import { Toaster } from "@/components/ui/sonner";
import { InstrumentationProvider } from "@/instrumentation.tsx";
import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient } from "convex/react";
import { StrictMode, useEffect, lazy, Suspense } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Route, Routes, useLocation, useMatches } from "react-router";
import "./index.css";
import "./types/global.d.ts";
import { Navbar } from "@/components/Navbar";
import "./i18n";

// Lazy load route components for better code splitting
const Landing = lazy(() => import("./pages/Landing.tsx"));
const AuthPage = lazy(() => import("./pages/Auth.tsx"));
const Dashboard = lazy(() => import("./pages/Dashboard.tsx"));
const ProviderDetails = lazy(() => import("./pages/ProviderDetails.tsx"));
const AdminPage = lazy(() => import("./pages/Admin.tsx"));
const AcceptInvitation = lazy(() => import("./pages/AcceptInvitation.tsx"));
const NotFound = lazy(() => import("./pages/NotFound.tsx"));

// Simple loading fallback for route transitions
function RouteLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">Chargement...</div>
    </div>
  );
}

const convexUrl = import.meta.env.VITE_CONVEX_URL || "https://colorless-kookabura-292.convex.cloud";
const convex = new ConvexReactClient(convexUrl);

function RouteSyncer() {
  const location = useLocation();
  useEffect(() => {
    window.parent.postMessage(
      { type: "iframe-route-change", path: location.pathname },
      "*",
    );
  }, [location.pathname]);

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.data?.type === "navigate") {
        if (event.data.direction === "back") window.history.back();
        if (event.data.direction === "forward") window.history.forward();
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <InstrumentationProvider>
      <ConvexAuthProvider client={convex}>
        <BrowserRouter>
          <RouteSyncer />
          <Routes>
            <Route path="/dashboard" element={
              <Suspense fallback={<RouteLoading />}>
                <Dashboard />
              </Suspense>
            } />
            <Route path="/provider/:id" element={
              <Suspense fallback={<RouteLoading />}>
                <ProviderDetails />
              </Suspense>
            } />
            <Route path="/admin" element={
              <Suspense fallback={<RouteLoading />}>
                <AdminPage />
              </Suspense>
            } />
            <Route path="/circle/invite/:token" element={
              <Suspense fallback={<RouteLoading />}>
                <AcceptInvitation />
              </Suspense>
            } />
            <Route path="*" element={
              <>
                <Navbar />
                <Suspense fallback={<RouteLoading />}>
                  <Routes>
                    <Route path="/" element={<Landing />} />
                    <Route path="/auth" element={<AuthPage />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </>
            } />
          </Routes>
        </BrowserRouter>
        <Toaster />
      </ConvexAuthProvider>
    </InstrumentationProvider>
  </StrictMode>,
);
