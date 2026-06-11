import { serve } from "@hono/node-server";
import { Bot, webhookCallback } from "grammy";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { HTTPException } from "hono/http-exception";
import { validateTelegramInitData } from "./auth";
import { findHarmonicMatches } from "./matchingEngine";
import { MusicApiError, MusicApiService } from "./MusicApiService";

const BOT_TOKEN = process.env.BOT_TOKEN;
const PUBLIC_WEBAPP_URL = process.env.PUBLIC_WEBAPP_URL ?? process.env.RENDER_EXTERNAL_URL ?? "";
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN ?? PUBLIC_WEBAPP_URL;
const BACKEND_PORT = Number(process.env.PORT ?? process.env.BACKEND_PORT ?? 8787);
const STATIC_ROOT = new URL("../../frontend/dist/", import.meta.url);
const WEBHOOK_PATH = "/api/telegram/webhook";
const IS_PRODUCTION = process.env.NODE_ENV === "production";
const DEFAULT_SEARCH_LIMIT = 30;
const MATCH_CANDIDATE_LIMIT = 100;
const MAX_SEARCH_LIMIT = 100;

const contentTypes: Record<string, string> = {
  ".css": "text/css; charset=utf-8",
  ".html": "text/html; charset=utf-8",
  ".ico": "image/x-icon",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
};

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN не задан");
}

if (!PUBLIC_WEBAPP_URL) {
  throw new Error("PUBLIC_WEBAPP_URL или RENDER_EXTERNAL_URL не задан");
}

const bot = new Bot(BOT_TOKEN);
const app = new Hono();
const musicApi = new MusicApiService();
const webhookUrl = new URL(WEBHOOK_PATH, PUBLIC_WEBAPP_URL).toString();

function getSearchLimit(value: string | undefined, fallback = DEFAULT_SEARCH_LIMIT) {
  const limit = Number(value);
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(Math.round(limit), MAX_SEARCH_LIMIT);
}

app.use(
  "*",
  cors({
    origin: FRONTEND_ORIGIN ? [FRONTEND_ORIGIN, "http://localhost:5173", "http://127.0.0.1:5173"] : "*",
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "OPTIONS"],
  }),
);

app.get("/api/health", (c) => c.json({ ok: true }));

app.get("/api/config", (c) =>
  c.json({
    webAppUrl: PUBLIC_WEBAPP_URL,
  }),
);

app.post("/api/auth", async (c) => {
  const body = await c.req.json<{ initData?: string }>().catch(() => ({ initData: "" }));
  const valid = validateTelegramInitData(body.initData ?? "", BOT_TOKEN);

  if (!valid) {
    throw new HTTPException(401, { message: "Не удалось проверить данные Telegram" });
  }

  return c.json({ ok: true });
});

app.post(WEBHOOK_PATH, webhookCallback(bot, "hono"));

app.get("/api/tracks", async (c) => {
  const query = c.req.query("query") ?? "";
  const tracks = await musicApi.searchTracks(query, getSearchLimit(c.req.query("limit")));

  return c.json({ tracks });
});

app.get("/api/matches/:id", async (c) => {
  const query = c.req.query("query") ?? "";
  const tracks = await musicApi.searchTracks(query, getSearchLimit(c.req.query("limit"), MATCH_CANDIDATE_LIMIT));
  const sourceTrack = tracks.find((track) => track.id === c.req.param("id")) ?? (await musicApi.getTrackById(c.req.param("id")));

  if (!sourceTrack) {
    throw new HTTPException(404, { message: "Трек не найден" });
  }

  return c.json({
    sourceTrack,
    matches: findHarmonicMatches(sourceTrack, tracks),
  });
});

app.onError((err, c) => {
  if (err instanceof HTTPException) {
    return c.json({ message: err.message }, err.status);
  }

  if (err instanceof MusicApiError) {
    return c.json({ message: err.message }, err.status as 502);
  }

  console.error("Ошибка сервера:", err);
  return c.json({ message: "Внутренняя ошибка сервера" }, 500);
});

app.get("*", async (c) => {
  const requestPath = c.req.path === "/" ? "/index.html" : c.req.path;
  const safePath = requestPath.replace(/^\/+/, "").replace(/\.\./g, "");
  const file = Bun.file(new URL(safePath, STATIC_ROOT));
  const exists = await file.exists();
  const targetPath = exists ? safePath : "index.html";
  const target = exists ? file : Bun.file(new URL(targetPath, STATIC_ROOT));
  const extension = targetPath.slice(targetPath.lastIndexOf("."));

  return new Response(target, {
    headers: {
      "Cache-Control": safePath.startsWith("assets/") ? "public, max-age=31536000, immutable" : "no-cache",
      "Content-Type": contentTypes[extension] ?? "application/octet-stream",
    },
  });
});

bot.command("start", async (ctx) => {
  await ctx.reply("Откройте DJ Tool, чтобы найти гармоничные сочетания для мэшапа.", {
    reply_markup: {
      inline_keyboard: [[{ text: "Открыть DJ Tool", web_app: { url: PUBLIC_WEBAPP_URL } }]],
    },
  });
});

bot.catch((err) => {
  console.error("Ошибка бота:", err.error);
});

async function configureBot() {
  await bot.api.setChatMenuButton({
    menu_button: {
      type: "web_app",
      text: "DJ Tool",
      web_app: { url: PUBLIC_WEBAPP_URL },
    },
  });

  if (IS_PRODUCTION) {
    await bot.api.setWebhook(webhookUrl, {
      allowed_updates: ["message"],
    });

    const info = await bot.api.getMe();
    console.log(`Бот запущен через webhook: @${info.username}`);
    console.log(`Webhook Telegram: ${webhookUrl}`);
    return;
  }

  await bot.api.deleteWebhook();
  void bot.start({
    onStart: (info) => {
      console.log(`Бот запущен локально: @${info.username}`);
    },
  });
}

await configureBot();

serve({
  fetch: app.fetch,
  port: BACKEND_PORT,
});

console.log(`API запущен на http://127.0.0.1:${BACKEND_PORT}`);
