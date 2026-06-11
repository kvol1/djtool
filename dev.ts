import localtunnel from "localtunnel";

const BOT_TOKEN = process.env.BOT_TOKEN;
const FRONTEND_PORT = Number(process.env.FRONTEND_PORT ?? 5173);
const BACKEND_PORT = Number(process.env.BACKEND_PORT ?? 8787);
const BOT_USERNAME = process.env.BOT_USERNAME ?? "dj_tool_bot";
const BOT_APP_NAME = process.env.BOT_APP_NAME ?? "djtool";

type Child = ReturnType<typeof Bun.spawn>;

const children: Child[] = [];
let tunnel: Awaited<ReturnType<typeof localtunnel>> | undefined;

function spawnProcess(name: string, args: string[], env: Record<string, string>) {
  const child = Bun.spawn(args, {
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env, ...env },
  });

  children.push(child);
  pipeProcess(name, child.stdout);
  pipeProcess(name, child.stderr);
  return child;
}

async function pipeProcess(name: string, stream: ReadableStream<Uint8Array>) {
  const reader = stream.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    const text = decoder.decode(value);
    if (text.trim()) {
      for (const line of text.trimEnd().split("\n")) {
        console.log(`[${name}] ${line}`);
      }
    }
  }
}

function printReady(webAppUrl: string) {
  console.clear();
  const directLink = `https://t.me/${BOT_USERNAME}/${BOT_APP_NAME}`;
  const line = "═".repeat(72);

  console.log(`
╔${line}╗
║ 🤖 Bot is running!${" ".repeat(52)}║
║ 🌐 Your WebApp URL for BotFather: ${webAppUrl.padEnd(32)}║
║ 🚀 Direct Telegram Link: ${directLink} (Make sure to update URL in BotFather!) ║
╚${line}╝
`);
}

async function waitForUrl(url: string, label: string) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 30_000) {
    try {
      const response = await fetch(url);
      if (response.ok) return;
    } catch {
      // Retry until the local services finish their warm-up.
    }

    await Bun.sleep(350);
  }

  throw new Error(`${label} did not become ready in time`);
}

async function shutdown() {
  for (const child of children) {
    child.kill();
  }

  if (tunnel) {
    tunnel.close();
  }

  process.exit(0);
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

if (!BOT_TOKEN) {
  throw new Error("BOT_TOKEN is required. Run with BOT_TOKEN=... bun run dev or add it in your hosting provider.");
}

tunnel = await localtunnel({
  port: FRONTEND_PORT,
  local_host: "127.0.0.1",
});

const publicWebAppUrl = tunnel.url;
const backendUrl = `http://127.0.0.1:${BACKEND_PORT}`;

spawnProcess("backend", ["bun", "run", "--cwd", "backend", "dev"], {
  BOT_TOKEN,
  BOT_USERNAME,
  BOT_APP_NAME,
  PUBLIC_WEBAPP_URL: publicWebAppUrl,
  BACKEND_PORT: String(BACKEND_PORT),
  FRONTEND_ORIGIN: publicWebAppUrl,
});

spawnProcess("frontend", ["bun", "run", "--cwd", "frontend", "dev", "--host", "0.0.0.0", "--port", String(FRONTEND_PORT)], {
  VITE_API_URL: "",
  VITE_BACKEND_TARGET: backendUrl,
  VITE_PUBLIC_WEBAPP_URL: publicWebAppUrl,
});

await Promise.all([
  waitForUrl(`${backendUrl}/api/health`, "Backend"),
  waitForUrl(`http://127.0.0.1:${FRONTEND_PORT}`, "Frontend"),
]);

printReady(publicWebAppUrl);

await new Promise(() => {});
