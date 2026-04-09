import "dotenv/config";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { serve } from "@hono/node-server";
import { db } from "./db.js";
import { users } from "./schema.js";
import { authRoutes } from "./routes/auth.routes.js";

const app = new Hono();
app.use("*", cors());

app.get("/", (c) => c.json({ message: "FlashGo backend is running" }));
app.route("/auth", authRoutes);

app.get("/health", async (c) => {
  const result = await db.select().from(users).limit(1);
  return c.json({ ok: true, usersPreview: result });
});

const port = Number(process.env.PORT ?? 3001);

serve(
  {
    fetch: app.fetch,
    port,
  },
  () => {
    console.log(`Backend running on http://localhost:${port}`);
  }
);
