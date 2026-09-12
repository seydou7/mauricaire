import { v } from "convex/values";
import { query } from "./_generated/server";
import { specialtyValidator } from "./schema";

// Helper function to calculate distance using Haversine formula
function getDistanceFromLatLonInKm(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371; // Radius of the earth in km
  const dLat = deg2rad(lat2 - lat1);
  const dLon = deg2rad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(deg2rad(lat1)) * Math.cos(deg2rad(lat2)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const d = R * c; // Distance in km
  return d;
}

function deg2rad(deg: number) {
  return deg * (Math.PI / 180);
}

export const getNearbyProviders = query({
  args: {
    latitude: v.number(),
    longitude: v.number(),
    specialty: v.optional(specialtyValidator),
  },
  handler: async (ctx, args) => {
    let providers;
    if (args.specialty) {
      providers = await ctx.db
        .query("providers")
        .withIndex("by_specialty", (q) => q.eq("specialty", args.specialty!))
        .filter((q) => q.eq(q.field("available"), true))
        .collect();
    } else {
      providers = await ctx.db
        .query("providers")
        .withIndex("by_available", (q) => q.eq("available", true))
        .collect();
    }

    const providersWithDistance = [];

    for (const provider of providers) {
      const user = await ctx.db.get(provider.userId);
      if (user && user.latitude !== undefined && user.longitude !== undefined) {
        const distance = getDistanceFromLatLonInKm(
          args.latitude,
          args.longitude,
          user.latitude,
          user.longitude
        );
        providersWithDistance.push({
          ...provider,
          user,
          distance,
        });
      }
    }

    // Sort by distance ascending
    providersWithDistance.sort((a, b) => a.distance - b.distance);

    return providersWithDistance;
  },
});
