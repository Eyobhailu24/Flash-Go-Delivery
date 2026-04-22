import { Bot, Context, session, Keyboard } from "grammy";
import { conversations, createConversation } from "@grammyjs/conversations";
import { t, type Language } from "./translate.js";
import { signUpConversation, packageDeliveryConversation, type MyContext } from "./conversations.js";
import { db } from "../db.js";
import { users, customerProfile, businessProfile, orders } from "../schema.js";
import { eq, desc } from "drizzle-orm";
import dotenv from "dotenv";

dotenv.config();

const token = process.env.TELEGRAM_BOT_TOKEN;
if (!token) {
  throw new Error("TELEGRAM_BOT_TOKEN is not defined in .env");
}

export const bot = new Bot<MyContext>(token);

// Session middleware
bot.use(session({ initial: () => ({ isLoggedIn: false } as MyContext["session"]) }));

// Conversation middleware
bot.use(conversations());
bot.use(createConversation(signUpConversation));
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

  await ctx.reply(await t("Select Language", lang), { reply_markup: keyboard });
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

  // Check Register
  if (text === await t("Register", lang)) {
    return await ctx.conversation.enter("signUpConversation");
  }

  // Check Package Delivery
  if (text === "📦 " + await t("Package Delivery", lang)) {
    return await ctx.conversation.enter("packageDeliveryConversation");
  }

  // Check Food Delivery
  if (text === "🍕 " + await t("Food Delivery", lang)) {
    const keyboard = new Keyboard().requestLocation("📍 " + await t("Share Location", lang)).resized();
    return await ctx.reply(await t("Please share your location to see nearby partners.", lang), { reply_markup: keyboard });
  }

  // Check My Cart
  if (text === "🛒 " + await t("My Cart", lang)) {
    return await ctx.reply(await t("Your cart is empty. Start shopping by selecting Food Delivery!", lang));
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
  const phoneNumber = ctx.message.contact.phone_number.replace(/\s+/g, '');
  
  // Search for user in DB
  let dbUser = await db.select().from(users).where(eq(users.phoneNumber, phoneNumber)).limit(1);
  
  if (dbUser.length === 0) {
    // If not found, check if they were registering
    if (ctx.session.user && ctx.session.user.name) {
      const { name, email, address } = ctx.session.user;
      const [newUser] = await db.insert(users).values({
        fullName: name,
        email: email || `bot_${phoneNumber}@flashgo.com`,
        phoneNumber,
        passwordHash: "TELEGRAM_USER_NO_PASSWORD", // Required by schema
        role: "customer",
        isVerified: true,
        verifiedAt: new Date(),
      }).returning();
      
      await db.insert(customerProfile).values({
        userId: newUser.id,
        addresses: address ? [{ address, isDefault: true }] : [],
      });
      
      ctx.session.dbUserId = newUser.id;
      await ctx.reply(await t("Register successfully in our system!", lang));
    } else {
      return await ctx.reply(await t("Phone number not found. Please click 'Register' first to create an account.", lang));
    }
  } else {
    ctx.session.dbUserId = dbUser[0].id;
    ctx.session.user = { 
      name: dbUser[0].fullName, 
      phone: phoneNumber, 
      email: dbUser[0].email,
      address: ctx.session.user?.address // Keep if exists
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

// Location handler for Food Delivery
bot.on("message:location", async (ctx) => {
  const lang = ctx.session.language || 'en';
  
  // Fetch real partners from DB
  const partners = await db.select().from(businessProfile).limit(5);
  
  let msg = await t("Here are our food delivery partners near you:", lang) + "\n\n";
  partners.forEach((p, i) => {
    msg += `${i + 1}. ${p.businessName} 🍕\n📍 ${p.address}\n\n`;
  });
  
  if (partners.length === 0) {
    msg = await t("No partners found in your area yet. We are expanding soon!", lang);
  }

  await ctx.reply(msg);
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
