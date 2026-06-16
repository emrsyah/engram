import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  client: {
    // Deprecated: API now lives in this app at a relative /api path. Kept
    // optional so any lingering reference doesn't fail validation.
    NEXT_PUBLIC_SERVER_URL: z.url().optional(),
  },
  runtimeEnv: {
    NEXT_PUBLIC_SERVER_URL: process.env.NEXT_PUBLIC_SERVER_URL,
  },
  emptyStringAsUndefined: true,
});
