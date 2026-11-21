import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { auth } from "./auth";
import { Id } from "./_generated/dataModel";
import { getCareRelationship } from "./careRelationship";
import { createServerNotification } from "./notifications";
import { APPOINTMENT_STATUS, ROLES } from "./schema";

/**
 * Messages Backend for MauriCare
 * 
 * Implements real-time messaging between Patients and Healthcare Professionals.
 * - getConversations: Aggregates threads by counterpart, unread counts, latest message snippet.
 * - getConversation: Returns chronological messages between caller and counterpart.
 *   Authorized if valid relationship exists OR historical messages exist.
 * - send: Sends message with relationship verification and transactional generic notification.
 * - markRead: Securely marks unread messages from otherUser directed to caller.
 * - getAllowedRecipients: Lists eligible contacts from appointments (even without message history).
 */

export const getConversations = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    // Fetch messages where user is sender or receiver
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_sender", (q) => q.eq("senderId", userId))
      .collect();

    const received = await ctx.db
      .query("messages")
      .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
      .collect();

    const all = [...sent, ...received].sort((a, b) => b._creationTime - a._creationTime);

    // Group by counterpart
    const threadMap = new Map<
      string,
      {
        counterpartId: Id<"users">;
        lastMessage: string;
        lastMessageTime: number;
        unreadCount: number;
      }
    >();

    for (const msg of all) {
      const isSender = msg.senderId === userId;
      const counterpartId = isSender ? msg.receiverId : msg.senderId;
      const key = counterpartId.toString();

      if (!threadMap.has(key)) {
        threadMap.set(key, {
          counterpartId,
          lastMessage: msg.content,
          lastMessageTime: msg._creationTime,
          unreadCount: 0,
        });
      }

      // Count unread received messages
      if (!isSender && !msg.read) {
        const thread = threadMap.get(key)!;
        thread.unreadCount += 1;
      }
    }

    // Enrich counterpart details
    const conversations = [];
    for (const thread of threadMap.values()) {
      const counterpart = await ctx.db.get(thread.counterpartId);
      if (!counterpart) continue;

      let specialty = counterpart.specialty;
      if (!specialty && counterpart.role === ROLES.PROFESSIONNEL) {
        const provider = await ctx.db
          .query("providers")
          .withIndex("by_userId", (q) => q.eq("userId", counterpart._id))
          .first();
        if (provider) {
          specialty = provider.specialty;
        }
      }

      conversations.push({
        counterpartId: thread.counterpartId,
        counterpartName: counterpart.name || "Utilisateur",
        counterpartRole: counterpart.role || "patient",
        counterpartSpecialty: specialty,
        lastMessage: thread.lastMessage,
        lastMessageTime: thread.lastMessageTime,
        unreadCount: thread.unreadCount,
      });
    }

    return conversations.sort((a, b) => b.lastMessageTime - a.lastMessageTime);
  },
});

export const getConversation = query({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    if (userId === args.otherUserId) {
      return [];
    }

    // Check care relationship
    const relationship = await getCareRelationship(ctx.db, userId, args.otherUserId);

    // Check if historical messages already exist between caller and counterpart
    const sentSample = await ctx.db
      .query("messages")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", userId).eq("receiverId", args.otherUserId)
      )
      .first();

    const receivedSample = await ctx.db
      .query("messages")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", args.otherUserId).eq("receiverId", userId)
      )
      .first();

    const hasHistory = !!(sentSample || receivedSample);

    // Rule: Access allowed if active messaging relationship OR historical messages exist
    if (!relationship.hasMessagingAccess && !hasHistory) {
      throw new Error(
        "Accès refusé : aucune relation de soin valide ni historique de messages avec cet utilisateur"
      );
    }

    // Retrieve all messages between both users
    const sent = await ctx.db
      .query("messages")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", userId).eq("receiverId", args.otherUserId)
      )
      .collect();

    const received = await ctx.db
      .query("messages")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", args.otherUserId).eq("receiverId", userId)
      )
      .collect();

    const all = [...sent, ...received].sort((a, b) => a._creationTime - b._creationTime);

    return all.map((msg) => ({
      _id: msg._id,
      senderId: msg.senderId,
      receiverId: msg.receiverId,
      content: msg.content,
      read: msg.read,
      _creationTime: msg._creationTime,
      isSelf: msg.senderId === userId,
    }));
  },
});

export const send = mutation({
  args: {
    receiverId: v.id("users"),
    content: v.string(),
    appointmentId: v.optional(v.id("appointments")),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    const trimmed = args.content.trim();
    if (!trimmed) {
      throw new Error("Le message ne peut pas être vide");
    }

    if (userId === args.receiverId) {
      throw new Error("Impossible de s'envoyer un message à soi-même");
    }

    // Verify messaging care relationship
    const relationship = await getCareRelationship(ctx.db, userId, args.receiverId);
    if (!relationship.hasMessagingAccess) {
      throw new Error(
        "Envoi impossible : destinataire non autorisé pour la messagerie"
      );
    }

    // Insert message
    const messageId = await ctx.db.insert("messages", {
      senderId: userId,
      receiverId: args.receiverId,
      appointmentId: args.appointmentId,
      content: trimmed,
      read: false,
    });

    // Create privacy-safe notification for receiver
    // IMPORTANT: Never copy raw message body to notification
    const sender = await ctx.db.get(userId);
    const senderName = sender?.name || "Un utilisateur";

    await createServerNotification(ctx, {
      userId: args.receiverId,
      title: "Nouveau message",
      titleAr: "رسالة جديدة",
      message: `Vous avez reçu un nouveau message de ${senderName}`,
      messageAr: `لقد تلقيت رسالة جديدة من ${senderName}`,
      type: "info",
      link: "/dashboard",
    });

    return { success: true, messageId };
  },
});

export const markRead = mutation({
  args: {
    otherUserId: v.id("users"),
  },
  handler: async (ctx, args) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) {
      throw new Error("Authentification requise");
    }

    // Fetch unread messages where receiverId === userId and senderId === otherUserId
    const unread = await ctx.db
      .query("messages")
      .withIndex("by_sender_receiver", (q) =>
        q.eq("senderId", args.otherUserId).eq("receiverId", userId)
      )
      .filter((q) => q.eq(q.field("read"), false))
      .collect();

    for (const msg of unread) {
      await ctx.db.patch(msg._id, { read: true });
    }

    return { success: true, markedCount: unread.length };
  },
});

export const getAllowedRecipients = query({
  args: {},
  handler: async (ctx) => {
    const userId = await auth.getUserId(ctx);
    if (!userId) return [];

    const user = await ctx.db.get(userId);
    if (!user) return [];

    const recipientsMap = new Map<
      string,
      {
        _id: Id<"users">;
        name: string;
        role: string;
        specialty?: string;
        city?: string;
      }
    >();

    if (user.role === ROLES.PATIENT) {
      // Patients may message any verified healthcare provider in the MauriCare network
      const verifiedProviders = await ctx.db
        .query("providers")
        .withIndex("by_verified", (q) => q.eq("verified", true))
        .collect();

      for (const provider of verifiedProviders) {
        const profUser = await ctx.db.get(provider.userId);
        if (!profUser) continue;

        const key = profUser._id.toString();
        if (!recipientsMap.has(key)) {
          recipientsMap.set(key, {
            _id: profUser._id,
            name: profUser.name || "Professionnel de santé",
            role: profUser.role || ROLES.PROFESSIONNEL,
            specialty: provider.specialty,
            city: provider.city,
          });
        }
      }
    } else if (user.role === ROLES.PROFESSIONNEL) {
      // Find caller's provider record
      const provider = await ctx.db
        .query("providers")
        .withIndex("by_userId", (q) => q.eq("userId", userId))
        .first();

      if (provider) {
        // A. Patients linked through appointments (en_attente, confirme, termine)
        const appointments = await ctx.db
          .query("appointments")
          .withIndex("by_provider", (q) => q.eq("providerId", provider._id))
          .collect();

        const eligible = appointments.filter(
          (a) =>
            a.status === APPOINTMENT_STATUS.PENDING ||
            a.status === APPOINTMENT_STATUS.CONFIRMED ||
            a.status === APPOINTMENT_STATUS.COMPLETED
        );

        for (const apt of eligible) {
          const patientUser = await ctx.db.get(apt.patientId);
          if (!patientUser) continue;

          const key = patientUser._id.toString();
          if (!recipientsMap.has(key)) {
            recipientsMap.set(key, {
              _id: patientUser._id,
              name: patientUser.name || "Patient",
              role: patientUser.role || ROLES.PATIENT,
              city: patientUser.city,
            });
          }
        }
      }

      // B. Patients who have initiated a conversation with this professional
      const receivedMessages = await ctx.db
        .query("messages")
        .withIndex("by_receiver", (q) => q.eq("receiverId", userId))
        .collect();

      for (const msg of receivedMessages) {
        const patientUser = await ctx.db.get(msg.senderId);
        if (!patientUser || patientUser.role !== ROLES.PATIENT) continue;

        const key = patientUser._id.toString();
        if (!recipientsMap.has(key)) {
          recipientsMap.set(key, {
            _id: patientUser._id,
            name: patientUser.name || "Patient",
            role: patientUser.role || ROLES.PATIENT,
            city: patientUser.city,
          });
        }
      }
    }

    return Array.from(recipientsMap.values());
  },
});
