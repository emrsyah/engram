import { createDb } from "@alphonse/db";
import * as schema from "@alphonse/db/schema/auth";
import { env } from "@alphonse/env/server";
import { betterAuth } from "better-auth";
import { APIError } from "better-auth/api";
import { drizzleAdapter } from "better-auth/adapters/drizzle";

// Emails permitted to sign in, normalized to lowercase. Access is invite-only:
// anyone whose Google email isn't listed is blocked at account creation.
const allowedEmails = new Set(
  env.ALLOWED_EMAILS.split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

export function createAuth() {
  const db = createDb();

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg",

      schema: schema,
    }),
    trustedOrigins: [env.CORS_ORIGIN],
    // Google-only auth: no email/password UI ships, so the email/password
    // endpoints are disabled to avoid leaving an open account-creation surface.
    emailAndPassword: {
      enabled: false,
    },
    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        // Offline access so Google issues a refresh token — required to keep
        // calling the Calendar API after the short-lived access token expires.
        // The read-only calendar scope is requested incrementally (via
        // authClient.linkSocial) only when the user connects their calendar,
        // so normal sign-in still asks for just profile + email.
        accessType: "offline",
      },
    },
    // Encrypt stored OAuth access/refresh tokens at rest (AES-256-GCM).
    account: {
      encryptOAuthTokens: true,
    },
    // Protect auth endpoints from brute-force/abuse. Enabled in production by
    // default; turned on explicitly here so it's never silently off.
    rateLimit: {
      enabled: true,
      // Persist counters in Postgres so limits survive restarts and hold across
      // multiple server instances (the in-memory default does neither).
      storage: "database",
      window: 10,
      max: 100,
    },
    // Invite-only gate: reject sign-ins from any email not on the allowlist.
    // This fires the first time a Google account would be created.
    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            if (!allowedEmails.has(user.email.toLowerCase())) {
              throw new APIError("FORBIDDEN", {
                message: "This email is not allowed to access Engram.",
              });
            }
          },
        },
      },
    },
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    advanced: {
      // Web and auth share one origin now, so cookies can use the stricter
      // `lax` policy. `secure` is gated on production so http://localhost dev
      // still stores the session.
      defaultCookieAttributes: {
        sameSite: "lax",
        secure: env.NODE_ENV === "production",
        httpOnly: true,
      },
    },
    plugins: [],
  });
}

export const auth = createAuth();
