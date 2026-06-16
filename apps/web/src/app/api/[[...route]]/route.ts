import { createContext } from "@alphonse/api/context";
import { appRouter } from "@alphonse/api/routers/index";
import { auth } from "@alphonse/auth";
import { trpcServer } from "@hono/trpc-server";
import { Hono } from "hono";
import { handle } from "hono/vercel";

// pg/drizzle and Better Auth need the Node.js runtime (not Edge), and auth
// responses must never be cached.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// Single-origin API: the Hono app is mounted under Next's `/api` segment, so
// internal routes are declared relative to it (`/auth/*` → `/api/auth/*`).
const app = new Hono().basePath("/api");

app.on(["POST", "GET"], "/auth/*", (c) => auth.handler(c.req.raw));

app.use(
  "/trpc/*",
  trpcServer({
    router: appRouter,
    endpoint: "/api/trpc",
    createContext: (_opts, context) => createContext({ context }),
  }),
);

export const GET = handle(app);
export const POST = handle(app);
