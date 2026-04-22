import { type Conversation, type ConversationFlavor } from "@grammyjs/conversations";
import { Context } from "grammy";
import { t, type Language } from "./translate.js";
import { db } from "../db.js";
import { users, customerProfile, orders, payments, orderDriverOffers, driverProfile, driverLocations } from "../schema.js";
import { eq, and } from "drizzle-orm";

export type MyContext = Context & ConversationFlavor<Context> & {
  session: {
    language?: Language;
    isLoggedIn?: boolean;
    dbUserId?: string;
    user?: {
      name?: string;
      email?: string;
      address?: string;
      phone?: string;
    };
    /** Ordered business `user_id`s after last food "near you" list (for reply 1, 2, …). */
    foodPartnerIds?: string[];
  };
};

// Helpers from order.controller
function toRad(deg: number): number { return (deg * Math.PI) / 180; }
function haversineDistanceKm(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) + Math.cos(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
const computeDeliveryFee = (dist: number) => 50 + Math.max(0, Math.ceil(dist - 1)) * 15;

export async function packageDeliveryConversation(conversation: Conversation<MyContext, MyContext>, ctx: MyContext) {
  const lang = ctx.session.language || 'en';
  if (!ctx.session.isLoggedIn || !ctx.session.dbUserId) {
    return await ctx.reply(await t("Please login first to use this service.", lang));
  }

  await ctx.reply(await t("Where should we pick up the package? (Address)", lang));
  const { message: pickupMsg } = await conversation.wait();
  
  await ctx.reply(await t("Where is the destination? (Address)", lang));
  const { message: destMsg } = await conversation.wait();

  await ctx.reply(await t("What is inside the package?", lang));
  const { message: infoMsg } = await conversation.wait();

  // For package delivery, we usually need coordinates. 
  // In a bot, we might use placeholders or ask for location.
  // For simplicity here, we use fixed dummy coordinates if they don't share location.
  const pickupCoords = { lat: 9.03, lng: 38.74 }; // Addis Ababa center
  const dropoffCoords = { lat: 9.05, lng: 38.76 };
  
  const routeDistanceKm = haversineDistanceKm(pickupCoords, dropoffCoords);
  const deliveryFee = computeDeliveryFee(routeDistanceKm);
  const basePrice = 100;
  const serviceCharge = 50;
  const total = basePrice + deliveryFee + serviceCharge;

  await ctx.reply(await t("Calculating delivery fee...", lang));
  await conversation.external(() => new Promise(resolve => setTimeout(resolve, 1000)));

  const confirmationMsg = await t(`Package Summary:\nDistance: ${routeDistanceKm.toFixed(2)}km\nDelivery Fee: ${deliveryFee} ETB\nTotal: ${total} ETB\n\nRegistering order...`, lang);
  await ctx.reply(confirmationMsg);

  try {
    const result = await conversation.external(async () => {
      return await db.transaction(async (tx) => {
        const [createdOrder] = await tx.insert(orders).values({
          customerId: ctx.session.dbUserId!,
          orderType: "package",
          status: "pending",
          totalPrice: basePrice.toString(),
          deliveryFee: deliveryFee.toString(),
          serviceCharge: serviceCharge.toString(),
          routeDistanceKm: routeDistanceKm.toFixed(2),
          packageNote: infoMsg?.text || null,
          pickupAddress: pickupMsg?.text,
          pickupLat: pickupCoords.lat.toString(),
          pickupLng: pickupCoords.lng.toString(),
          dropoffAddress: destMsg?.text,
          dropoffLat: dropoffCoords.lat.toString(),
          dropoffLng: dropoffCoords.lng.toString(),
        }).returning();

        await tx.insert(payments).values({
          orderId: createdOrder.id,
          amount: total.toString(),
          method: "cash",
          status: "pending",
        });

        // Find drivers (Copy logic)
        const candidates = await tx.select({ id: users.id, location: driverLocations.location })
          .from(users)
          .innerJoin(driverProfile, eq(driverProfile.userId, users.id))
          .innerJoin(driverLocations, eq(driverLocations.driverId, users.id))
          .where(and(eq(users.role, "driver"), eq(users.status, "active"), eq(driverProfile.isAvailable, true)));

        if (candidates.length > 0) {
          await tx.insert(orderDriverOffers).values(candidates.map((d, i) => ({
            orderId: createdOrder.id,
            driverId: d.id,
            rank: i + 1,
            status: i === 0 ? "pending" : "queued",
            distanceToBusinessKm: "1.0", // Dummy
            offeredAt: i === 0 ? new Date() : null,
          })));
        }

        return createdOrder.id;
      });
    });

    await ctx.reply(await t(`Order #${result.slice(0, 8)} created! A driver will be assigned soon.`, lang));
  } catch (error) {
    console.error("Order creation failed:", error);
    await ctx.reply(await t("Sorry, something went wrong while creating your order.", lang));
  }
}
