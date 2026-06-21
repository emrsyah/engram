import { auth } from "@alphonse/auth";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { protectedProcedure, router } from "../index";

// Read-only access is all the calendar view needs. Requested incrementally on
// the client via authClient.linkSocial — kept in sync with this string.
export const GOOGLE_CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar.readonly";

/** Fetch a fresh Google access token for the user (Better Auth refreshes it), or null. */
async function googleToken(userId: string, headers: Headers): Promise<string | null> {
  try {
    const result = await auth.api.getAccessToken({
      body: { providerId: "google", userId },
      headers,
    });
    return result?.accessToken ?? null;
  } catch (error) {
    // Most common: no refresh token (connected before offline access was enabled)
    // or the grant was revoked — both require the user to reconnect.
    console.error("[calendar] getAccessToken failed:", error);
    return null;
  }
}

async function gcal(path: string, token: string, params: Record<string, string> = {}) {
  const url = new URL(`https://www.googleapis.com/calendar/v3${path}`);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, value);
  const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
  if (!response.ok) {
    const body = await response.text().catch(() => "");
    console.error(`[calendar] ${path} -> ${response.status}: ${body.slice(0, 300)}`);
    throw new TRPCError({
      code: response.status === 401 || response.status === 403 ? "UNAUTHORIZED" : "BAD_GATEWAY",
      message: `Google Calendar request failed (${response.status})`,
    });
  }
  return response.json() as Promise<{ items?: unknown[] }>;
}

export const calendarRouter = router({
  /** Whether we can actually read the user's calendars. Drives the Connect button. */
  status: protectedProcedure.query(async ({ ctx }) => {
    const token = await googleToken(ctx.session.user.id, ctx.headers);
    if (!token) return { connected: false };
    try {
      // Authoritative check: a real (tiny) call. Avoids guessing from scope strings.
      await gcal("/users/me/calendarList", token, { maxResults: "1" });
      return { connected: true };
    } catch {
      return { connected: false };
    }
  }),

  /** The user's calendar list — what they can choose to show. */
  calendars: protectedProcedure.query(async ({ ctx }) => {
    const token = await googleToken(ctx.session.user.id, ctx.headers);
    if (!token) return [];
    const data = await gcal("/users/me/calendarList", token, {
      maxResults: "250",
      minAccessRole: "reader",
    });
    return (data.items ?? []).map((raw) => {
      const item = raw as {
        id: string;
        summary?: string;
        summaryOverride?: string;
        primary?: boolean;
        backgroundColor?: string;
        selected?: boolean;
      };
      return {
        id: item.id,
        summary: item.summaryOverride ?? item.summary ?? item.id,
        primary: !!item.primary,
        color: item.backgroundColor ?? null,
        selectedByDefault: !!item.selected,
      };
    });
  }),

  /** Events across the chosen calendars within [timeMin, timeMax). */
  events: protectedProcedure
    .input(
      z.object({
        timeMin: z.string(),
        timeMax: z.string(),
        calendarIds: z.array(z.string()),
      }),
    )
    .query(async ({ ctx, input }) => {
      if (input.calendarIds.length === 0) return [];
      const token = await googleToken(ctx.session.user.id, ctx.headers);
      if (!token) return [];

      const perCalendar = await Promise.all(
        input.calendarIds.map(async (calendarId) => {
          try {
            const data = await gcal(
              `/calendars/${encodeURIComponent(calendarId)}/events`,
              token,
              {
                timeMin: input.timeMin,
                timeMax: input.timeMax,
                singleEvents: "true",
                orderBy: "startTime",
                maxResults: "2500",
              },
            );
            return (data.items ?? []).map((raw) => {
              const event = raw as {
                id: string;
                summary?: string;
                htmlLink?: string;
                start?: { dateTime?: string; date?: string };
                end?: { dateTime?: string; date?: string };
              };
              return {
                id: `${calendarId}:${event.id}`,
                calendarId,
                title: event.summary ?? "(no title)",
                start: event.start?.dateTime ?? event.start?.date ?? null,
                end: event.end?.dateTime ?? event.end?.date ?? null,
                allDay: !event.start?.dateTime,
                htmlLink: event.htmlLink ?? null,
              };
            });
          } catch {
            // A single failing calendar shouldn't blank the whole month.
            return [];
          }
        }),
      );
      return perCalendar.flat();
    }),
});
