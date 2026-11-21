/* eslint-disable */
/**
 * Generated `api` utility.
 *
 * THIS CODE IS AUTOMATICALLY GENERATED.
 *
 * To regenerate, run `npx convex dev`.
 * @module
 */

import type * as accountSecurity from "../accountSecurity.js";
import type * as admin from "../admin.js";
import type * as appointments from "../appointments.js";
import type * as assistantExecutor from "../assistantExecutor.js";
import type * as assistantKnowledge from "../assistantKnowledge.js";
import type * as assistantPlanner from "../assistantPlanner.js";
import type * as assistantRegistry from "../assistantRegistry.js";
import type * as auth from "../auth.js";
import type * as auth_emailOtp from "../auth/emailOtp.js";
import type * as authOtpService from "../authOtpService.js";
import type * as availability from "../availability.js";
import type * as careRelationship from "../careRelationship.js";
import type * as chronic from "../chronic.js";
import type * as circle from "../circle.js";
import type * as emailService from "../emailService.js";
import type * as emergencyContacts from "../emergencyContacts.js";
import type * as favorites from "../favorites.js";
import type * as homeLab from "../homeLab.js";
import type * as http from "../http.js";
import type * as messages from "../messages.js";
import type * as notifications from "../notifications.js";
import type * as onboarding from "../onboarding.js";
import type * as patientRecords from "../patientRecords.js";
import type * as providerServices from "../providerServices.js";
import type * as providers from "../providers.js";
import type * as rateLimit from "../rateLimit.js";
import type * as recurringCare from "../recurringCare.js";
import type * as relay from "../relay.js";
import type * as reviews from "../reviews.js";
import type * as seed from "../seed.js";
import type * as seedClientDemo from "../seedClientDemo.js";
import type * as serviceCatalog from "../serviceCatalog.js";
import type * as test_auth_otp from "../test_auth_otp.js";
import type * as test_caregivers_and_messaging from "../test_caregivers_and_messaging.js";
import type * as test_circle from "../test_circle.js";
import type * as test_general_voice_agent from "../test_general_voice_agent.js";
import type * as test_phase2_global from "../test_phase2_global.js";
import type * as test_phase2_negative_security from "../test_phase2_negative_security.js";
import type * as test_scenario from "../test_scenario.js";
import type * as test_scenario_sprint03 from "../test_scenario_sprint03.js";
import type * as test_scenario_sprint04 from "../test_scenario_sprint04.js";
import type * as test_scenario_sprint05 from "../test_scenario_sprint05.js";
import type * as test_voice_routing from "../test_voice_routing.js";
import type * as users from "../users.js";
import type * as voiceAssistant from "../voiceAssistant.js";

import type {
  ApiFromModules,
  FilterApi,
  FunctionReference,
} from "convex/server";

declare const fullApi: ApiFromModules<{
  accountSecurity: typeof accountSecurity;
  admin: typeof admin;
  appointments: typeof appointments;
  assistantExecutor: typeof assistantExecutor;
  assistantKnowledge: typeof assistantKnowledge;
  assistantPlanner: typeof assistantPlanner;
  assistantRegistry: typeof assistantRegistry;
  auth: typeof auth;
  "auth/emailOtp": typeof auth_emailOtp;
  authOtpService: typeof authOtpService;
  availability: typeof availability;
  careRelationship: typeof careRelationship;
  chronic: typeof chronic;
  circle: typeof circle;
  emailService: typeof emailService;
  emergencyContacts: typeof emergencyContacts;
  favorites: typeof favorites;
  homeLab: typeof homeLab;
  http: typeof http;
  messages: typeof messages;
  notifications: typeof notifications;
  onboarding: typeof onboarding;
  patientRecords: typeof patientRecords;
  providerServices: typeof providerServices;
  providers: typeof providers;
  rateLimit: typeof rateLimit;
  recurringCare: typeof recurringCare;
  relay: typeof relay;
  reviews: typeof reviews;
  seed: typeof seed;
  seedClientDemo: typeof seedClientDemo;
  serviceCatalog: typeof serviceCatalog;
  test_auth_otp: typeof test_auth_otp;
  test_caregivers_and_messaging: typeof test_caregivers_and_messaging;
  test_circle: typeof test_circle;
  test_general_voice_agent: typeof test_general_voice_agent;
  test_phase2_global: typeof test_phase2_global;
  test_phase2_negative_security: typeof test_phase2_negative_security;
  test_scenario: typeof test_scenario;
  test_scenario_sprint03: typeof test_scenario_sprint03;
  test_scenario_sprint04: typeof test_scenario_sprint04;
  test_scenario_sprint05: typeof test_scenario_sprint05;
  test_voice_routing: typeof test_voice_routing;
  users: typeof users;
  voiceAssistant: typeof voiceAssistant;
}>;

/**
 * A utility for referencing Convex functions in your app's public API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = api.myModule.myFunction;
 * ```
 */
export declare const api: FilterApi<
  typeof fullApi,
  FunctionReference<any, "public">
>;

/**
 * A utility for referencing Convex functions in your app's internal API.
 *
 * Usage:
 * ```js
 * const myFunctionReference = internal.myModule.myFunction;
 * ```
 */
export declare const internal: FilterApi<
  typeof fullApi,
  FunctionReference<any, "internal">
>;

export declare const components: {};
