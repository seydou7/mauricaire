import { useConvexAuth, useQuery } from "convex/react";
import { useAuthActions } from "@convex-dev/auth/react";
import { api } from "@/convex/_generated/api";

export type UserRole = "patient" | "professionnel" | "admin";

export function useAuth() {
  const { isAuthenticated, isLoading: convexAuthLoading } = useConvexAuth();
  const { signIn, signOut } = useAuthActions();
  const user = useQuery(api.users.currentUser);

  // Distinct loading states to prevent race conditions during auth hydration
  const isAuthLoading = convexAuthLoading;
  const isUserLoading = isAuthenticated && user === undefined;
  const isLoading = isAuthLoading || isUserLoading;

  const resolvedUser = isAuthenticated && user ? user : null;
  const role: UserRole | null = (resolvedUser?.role as UserRole) ?? null;
  const isAdmin = role === "admin";

  return {
    isLoading,
    isAuthLoading,
    isUserLoading,
    isAuthenticated,
    user: resolvedUser,
    role,
    isAdmin,
    signIn,
    signOut,
  };
}
