import { createAuthClient } from "better-auth/react";

// Auth lives in this same Next.js app (under /api/auth), so no baseURL is
// needed — the client targets the current origin by default.
export const authClient = createAuthClient();
