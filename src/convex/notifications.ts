import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";

/**
 * Notifications Backend for MauriCare
 * 
 * Provides authenticated, user-isolated notification querying, counting, and state management.
 */

export const getForUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const notifications = await ctx.db
      .query("notifications")
      .withIndex("by_user", (q) => q.eq("userId", userId))
      .order("desc")
      .take(30);

    return notifications;
  },
});

export const getUnreadCount = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return 0;

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();

    return unread.length;
  },
});

export const markRead = mutation({
  args: {
    notificationId: v.id("notifications"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const notification = await ctx.db.get(args.notificationId);
    if (!notification) {
      throw new Error("Notification introuvable");
    }

    if (notification.userId !== userId) {
      throw new Error("Action non autorisée : cette notification ne vous appartient pas");
    }

    if (!notification.read) {
      await ctx.db.patch(args.notificationId, { read: true });
    }

    return { success: true };
  },
});

export const markAllRead = mutation({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const unread = await ctx.db
      .query("notifications")
      .withIndex("by_user_read", (q) => q.eq("userId", userId).eq("read", false))
      .collect();

    for (const notif of unread) {
      await ctx.db.patch(notif._id, { read: true });
    }

    return { success: true, markedCount: unread.length };
  },
});

/**
 * Server-only internal helper to dispatch persistent notifications from authoritative mutations.
 */
export async function createServerNotification(
  ctx: { db: any },
  args: {
    userId: Id<"users">;
    title: string;
    titleAr?: string;
    message: string;
    messageAr?: string;
    type: "info" | "alert" | "reminder";
    link?: string;
  }
) {
  return await ctx.db.insert("notifications", {
    userId: args.userId,
    title: args.title,
    titleAr: args.titleAr,
    message: args.message,
    messageAr: args.messageAr,
    type: args.type,
    read: false,
    link: args.link || "/dashboard",
  });
}
