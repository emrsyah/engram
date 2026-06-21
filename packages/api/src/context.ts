import { auth } from "@alphonse/auth";
import type { Context as HonoContext } from "hono";

export type CreateContextOptions = {
  context: HonoContext;
};

export async function createContext({ context }: CreateContextOptions) {
  const headers = context.req.raw.headers;
  const session = await auth.api.getSession({ headers });
  return {
    auth: null,
    session,
    headers,
  };
}

export type Context = Awaited<ReturnType<typeof createContext>>;
