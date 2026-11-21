import { convexAuth } from "@convex-dev/auth/server";
import { Anonymous } from "@convex-dev/auth/providers/Anonymous";
import { Password } from "@convex-dev/auth/providers/Password";
import { emailOtp } from "./auth/emailOtp";

export const { auth, signIn, signOut, store, isAuthenticated } = convexAuth({
  providers: [
    Password({
      id: "password",
      validatePasswordRequirements(password: string) {
        if (!password || password.length < 8) {
          throw new Error("Le mot de passe doit comporter au moins 8 caractères.");
        }
        if (!/[A-Za-z]/.test(password) || !/[0-9]/.test(password)) {
          throw new Error("Le mot de passe doit comporter des lettres et au moins un chiffre.");
        }
      },
      profile(params: any) {
        const email = (params.email as string).toLowerCase().trim();
        const role = params.role || "patient";
        const firstName = params.firstName || "";
        const lastName = params.lastName || "";
        const fullName = `${firstName} ${lastName}`.trim() || params.name || email.split("@")[0];

        // Security check: Never allow self-registration as ADMIN
        if (role === "admin") {
          throw new Error("Inscription administrateur interdite.");
        }

        return {
          email,
          role,
          name: fullName,
          firstName,
          lastName,
          phone: params.phone,
          city: params.city,
          address: params.address,
          gender: params.gender,
          birthDate: params.birthDate,
          emailVerified: false,
          profileCompleted: false,
        };
      },
    }),
    emailOtp,
    Anonymous,
  ],
});
