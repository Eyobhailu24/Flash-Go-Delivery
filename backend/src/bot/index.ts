import { Bot, session, Keyboard, InlineKeyboard } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { t, type Language } from "./translate.js";
import { packageDeliveryConversation, type MyContext } from "./conversations.js";
import { normalizePhone } from "../lib/ethiopia-phone.js";
import { db } from "../db.js";
import { users, businessProfile, orders } from "../schema.js";
import { and, desc, eq, isNotNull } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

function webOrigin(): string {
  return (
    process.env.FRONTEND_URL ??
    process.env.FRONTEND_ORIGIN ??
    "http://localhost:3000"
  ).replace(/\/$/, "");
}

function webSignupUrl(): string {
  return `${webOrigin()}/signup`;
}

function webMenuUrl(businessUserId: string): string {
  return `${webOrigin()}/menu?businessId=${encodeURIComponent(businessUserId)}`;
}

function webCheckoutUrl(): string {
  return `${webOrigin()}/checkout`;
}

function webHomeUrl(): string {
  return `${webOrigin()}/`;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

function haversineDistanceKm(
  from: { lat: number; lng: number },
  to: { lat: number; lng: number },
): number {
  const dLat = toRad(to.lat - from.lat);
  const dLon = toRad(to.lng - from.lng);
  const lat1 = toRad(from.lat);
  const lat2 = toRad(to.lat);
  const earthRadiusKm = 6371;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadiusKm * c;
}

function formatAddress(
  raw: string | null | undefined,
  fallback: string,
): string {
  const s = raw?.trim();
  return s && s.toLowerCase() !== "null" ? s : fallback;
}

/**
 * Telegram rejects many `http://` URLs for inline keyboard buttons, including
 * `http://localhost` (400: Wrong HTTP URL). Use HTTPS + a public host in
 * FRONTEND_URL for tappable buttons, or the bot falls back to plain links.
 */
function telegramAllowsInlineWebUrl(url: string): boolean {
  try {
    const u = new URL(url);
    if (u.protocol !== "https:") return false;
    const h = u.hostname.toLowerCase();
    if (h === "localhost" || h === "127.0.0.1" || h === "[::1]") return false;
    return true;
  } catch {
    return false;
  }
}

function telegramAllowsInlineWebOrigin(): boolean {
  return telegramAllowsInlineWebUrl(`${webOrigin()}/`);
}

/** Reply with inline URL buttons when Telegram allows it; otherwise same URLs as plain text. */
async function replyWithWebLinks(
  ctx: MyContext,
  lang: Language,
  body: string,
  pairs: Array<{ label: string; url: string }>,
): Promise<void> {
  const allAllowed =
    pairs.length > 0 && pairs.every((p) => telegramAllowsInlineWebUrl(p.url));
  if (allAllowed) {
    const keyboard = new InlineKeyboard();
    pairs.forEach((pair, i) => {
      if (i > 0) keyboard.row();
      keyboard.url(pair.label, pair.url);
    });
    await ctx.reply(body, { reply_markup: keyboard });
    return;
  }
  let text = body;
  if (pairs.length > 0) {
    text +=
      "\n\n" +
      (await t(
        "Open these in your browser. For tappable buttons in Telegram, set FRONTEND_URL to an HTTPS URL (e.g. your live site or ngrok).",
        lang,
      ));
    for (const pair of pairs) {
      text += `\n\n${pair.label}\n${pair.url}`;
    }
  }
  await ctx.reply(text);
}

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined in .env");
}

export const bot = new Bot<MyContext>(token);

// Session middleware
bot.use(session({ initial: () => ({ isLoggedIn: false } as MyContext["session"]) }));

// Conversation middleware
bot.use(conversations());
bot.use(createConversation(packageDeliveryConversation));

// Start command
bot.command("start", async (ctx) => {
  const keyboard = new Keyboard()
    .text("English 🇺🇸").row()
    .text("አማርኛ 🇪🇹")
    .resized();

  await ctx.reply("Welcome to FlashGo Delivery! Please select your language.\nእንኳን ወደ FlashGo Delivery በሰላም መጡ! እባክዎ ቋንቋ ይምረጡ።", {
    reply_markup: keyboard,
  });
});

// Language selection handler
bot.hears(["English 🇺🇸", "አማርኛ 🇪🇹"], async (ctx) => {
  const text = ctx.message?.text || "";
  const lang: Language = text.includes("English") ? "en" : "am";
  ctx.session.language = lang;

  const keyboard = new Keyboard()
    .text(await t("Login", lang)).row()
    .text(await t("Register", lang))
    .resized();

  await ctx.reply(
    await t("Choose Log in or Register to continue.", lang),
    { reply_markup: keyboard },
  );
});

// Dynamic Handler for translated buttons
bot.on("message:text", async (ctx, next) => {
  const lang = ctx.session.language || 'en';
  const text = ctx.message?.text || "";

  // Check Login
  if (text === await t("Login", lang)) {
    const keyboard = new Keyboard().requestContact(await t("Share Phone Number", lang)).resized();
    return await ctx.reply(await t("Share Phone Number", lang), { reply_markup: keyboard });
  }

  // Register: complete account on the website (Option A — no bot-only signup)
  if (text === await t("Register", lang)) {
    await replyWithWebLinks(
      ctx,
      lang,
      await t(
        "Create your account on our website. Use the same phone number you will share here when you tap Log in.",
        lang,
      ),
      [
        {
          label: await t("Open sign-up page", lang),
          url: webSignupUrl(),
        },
      ],
    );
    return await ctx.reply(
      await t("When you are done, tap Log in and share your phone contact.", lang),
    );
  }

  // Check Package Delivery
  if (text === "📦 " + await t("Package Delivery", lang)) {
    return await ctx.conversation.enter("packageDeliveryConversation");
  }

  // Check Food Delivery
  if (text === "🍕 " + await t("Food Delivery", lang)) {
    if (!ctx.session.dbUserId) {
      return await ctx.reply(await t("Please login first.", lang));
    }
    ctx.session.foodPartnerIds = undefined;
    const keyboard = new Keyboard()
      .requestLocation("📍 " + await t("Share Location", lang))
      .resized();
    return await ctx.reply(
      await t("Please share your location to see nearby partners.", lang),
      { reply_markup: keyboard },
    );
  }

  // Reply with a number to open that restaurant's menu (same order as last list)
  const partnerIds = ctx.session.foodPartnerIds;
  if (partnerIds?.length) {
    const trimmed = text.trim();
    const num = parseInt(trimmed, 10);
    if (String(num) === trimmed && num >= 1 && num <= partnerIds.length) {
      const businessUserId = partnerIds[num - 1]!;
      const menuUrl = webMenuUrl(businessUserId);
      return await replyWithWebLinks(
        ctx,
        lang,
        await t(
          "Open the menu to add dishes, then checkout on the website (same account as this bot). You can also use the numbered buttons on the list above.",
          lang,
        ),
        [
          { label: await t("Open menu", lang), url: menuUrl },
          { label: await t("Go to checkout", lang), url: webCheckoutUrl() },
        ],
      );
    }
  }

  // Check My Cart
  if (text === "🛒 " + await t("My Cart", lang)) {
    if (!ctx.session.dbUserId) {
      return await ctx.reply(await t("Please login first.", lang));
    }
    return await replyWithWebLinks(
      ctx,
      lang,
      await t(
        "Manage your cart and pay on the website (use the same phone login as here).",
        lang,
      ),
      [
        { label: await t("Open checkout", lang), url: webCheckoutUrl() },
        { label: await t("Open home & menus", lang), url: webHomeUrl() },
      ],
    );
  }

  // Check My Orders (Fetch from DB)
  if (text === "📋 " + await t("My Orders", lang)) {
    if (!ctx.session.dbUserId) return await ctx.reply(await t("Please login first.", lang));
    
    const userOrders = await db.select()
      .from(orders)
      .where(eq(orders.customerId, ctx.session.dbUserId))
      .orderBy(desc(orders.createdAt))
      .limit(5);

    if (userOrders.length === 0) {
      return await ctx.reply(await t("You have no active orders.", lang));
    }

    let msg = `📋 *${await t("My Orders", lang)}*\n\n`;
    for (const order of userOrders) {
      const status = await t(order.status.charAt(0).toUpperCase() + order.status.slice(1), lang);
      const type = await t(order.orderType === "food" ? "Food Delivery" : "Package", lang);
      msg += `🔹 ${type} - *${status}*\n`;
      msg += `💰 ${order.totalPrice} ETB\n`;
      msg += `📅 ${order.createdAt.toLocaleDateString()}\n\n`;
    }
    
    return await ctx.reply(msg, { parse_mode: "Markdown" });
  }

  // Check Profile (Fetch fresh from DB)
  if (text === "👤 " + await t("Profile", lang)) {
    if (!ctx.session.dbUserId) return await ctx.reply(await t("Please login first.", lang));
    
    const [dbUser] = await db.select().from(users).where(eq(users.id, ctx.session.dbUserId)).limit(1);
    if (!dbUser) return await ctx.reply(await t("User not found.", lang));

    const translatedHeader = await t("Profile", lang);
    const translatedName = await t("Name", lang);
    const translatedPhone = await t("Phone", lang);
    const translatedEmail = await t("Email", lang);
    
    let msg = `👤 *${translatedHeader}*\n\n`;
    msg += `📍 ${translatedName}: ${dbUser.fullName}\n`;
    msg += `📞 ${translatedPhone}: ${dbUser.phoneNumber || 'N/A'}\n`;
    msg += `📧 ${translatedEmail}: ${dbUser.email || 'N/A'}\n`;
    
    return await ctx.reply(msg, { parse_mode: "Markdown" });
  }

  await next();
});

// Contact/Phone sharing handler (Login/Registration)
bot.on("message:contact", async (ctx) => {
  const lang = ctx.session.language || 'en';
  const rawPhone = ctx.message.contact.phone_number.replace(/\s+/g, "");
  const phoneNumber = normalizePhone(rawPhone);

  // Search for user in DB (same normalized form as web signup)
  let dbUser = await db
    .select()
    .from(users)
    .where(eq(users.phoneNumber, phoneNumber))
    .limit(1);
  if (dbUser.length === 0 && phoneNumber !== rawPhone) {
    dbUser = await db
      .select()
      .from(users)
      .where(eq(users.phoneNumber, rawPhone))
      .limit(1);
  }
  
  if (dbUser.length === 0) {
    return await replyWithWebLinks(
      ctx,
      lang,
      await t(
        "No account found for this phone. Register on the website first, then tap Log in here.",
        lang,
      ),
      [
        {
          label: await t("Open sign-up page", lang),
          url: webSignupUrl(),
        },
      ],
    );
  } else {
    const row = dbUser[0];
    ctx.session.dbUserId = row.id;
    ctx.session.user = {
      name: row.fullName,
      phone: row.phoneNumber ?? phoneNumber,
      email: row.email,
      address: ctx.session.user?.address,
    };
  }

  ctx.session.isLoggedIn = true;
  await ctx.reply(await t("Login successfully!", lang));
  
  const keyboard = new Keyboard()
    .text("📦 " + await t("Package Delivery", lang))
    .text("🍕 " + await t("Food Delivery", lang)).row()
    .text("🛒 " + await t("My Cart", lang))
    .text("📋 " + await t("My Orders", lang)).row()
    .text("👤 " + await t("Profile", lang))
    .resized();

  await ctx.reply(await t("Please select a service:", lang), { reply_markup: keyboard });
});

// Location handler for Food Delivery (and general "near me" browse)
bot.on("message:location", async (ctx) => {
  const lang = ctx.session.language || "en";
  if (!ctx.session.dbUserId) {
    return await ctx.reply(await t("Please login first.", lang));
  }

  const { latitude: lat, longitude: lng } = ctx.message.location;
  const userPoint = { lat, lng };

  const approved = await db
    .select({
      userId: businessProfile.userId,
      businessName: businessProfile.businessName,
      address: businessProfile.address,
      latitude: businessProfile.latitude,
      longitude: businessProfile.longitude,
    })
    .from(businessProfile)
    .where(
      and(
        eq(businessProfile.status, "approved"),
        isNotNull(businessProfile.latitude),
        isNotNull(businessProfile.longitude),
      ),
    );

  const addrFallback = await t("Address not listed", lang);

  type Row = (typeof approved)[number];
  const withDistance: Array<Row & { distanceKm: number }> = approved.map(
    (p) => ({
      ...p,
      distanceKm: haversineDistanceKm(userPoint, {
        lat: p.latitude as number,
        lng: p.longitude as number,
      }),
    }),
  );
  withDistance.sort((a, b) => a.distanceKm - b.distanceKm);

  type PartnerRow = Row & { distanceKm?: number };
  let partners: PartnerRow[] =
    withDistance.length > 0 ? withDistance.slice(0, 8) : [];
  if (partners.length === 0) {
    const fallback = await db
      .select({
        userId: businessProfile.userId,
        businessName: businessProfile.businessName,
        address: businessProfile.address,
        latitude: businessProfile.latitude,
        longitude: businessProfile.longitude,
      })
      .from(businessProfile)
      .where(eq(businessProfile.status, "approved"))
      .limit(8);
    partners = fallback;
  }

  ctx.session.foodPartnerIds = partners.map((p) => p.userId);

  if (partners.length === 0) {
    ctx.session.foodPartnerIds = undefined;
    return await ctx.reply(
      await t("No partners found in your area yet. We are expanding soon!", lang),
    );
  }

  let msg =
    (await t("Here are our food delivery partners near you:", lang)) + "\n\n";
  const keyboard = new InlineKeyboard();

  partners.forEach((p, i) => {
    const addr = formatAddress(p.address, addrFallback);
    const distPart =
      p.distanceKm != null
        ? ` (~${p.distanceKm.toFixed(1)} km)`
        : "";
    msg += `${i + 1}. ${p.businessName} 🍕${distPart}\n📍 ${addr}\n\n`;
    keyboard.url(`${i + 1}. ${p.businessName}`.slice(0, 64), webMenuUrl(p.userId));
    if (i < partners.length - 1) {
      keyboard.row();
    }
  });

  msg += telegramAllowsInlineWebOrigin()
    ? await t(
        "Tap a button below or reply with the restaurant number (1, 2, …) to open the menu on the website.",
        lang,
      )
    : await t(
        "Reply with the restaurant number (1, 2, …). Menu links are in the next message.",
        lang,
      );

  if (telegramAllowsInlineWebOrigin()) {
    await ctx.reply(msg, { reply_markup: keyboard });
  } else {
    await ctx.reply(msg);
    let links =
      (await t("Menu links (open in browser):", lang)) + "\n\n";
    partners.forEach((p, i) => {
      links += `${i + 1}. ${p.businessName}\n${webMenuUrl(p.userId)}\n\n`;
    });
    await ctx.reply(links.trimEnd());
  }
});

// Error handling
bot.catch((err) => {
  console.error(`Error while handling update ${err.ctx.update.update_id}:`, err.error);
});

// Start the bot
if (process.env.NODE_ENV !== "production") {
  console.log("Bot is starting...");
  bot.start();
}
