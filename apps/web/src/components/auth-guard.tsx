"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

import { authClient } from "@/lib/auth-client";

import Loader from "./loader";

/**
 * Client-side route guard for the authenticated `(app)` route group.
 *
 * The Better Auth server runs on a separate origin from the web app, so its
 * session cookie is not readable by Next.js middleware/server components here —
 * the session can only be resolved on the client. This guard blocks rendering
 * of protected UI until a session is confirmed, and redirects to `/login`
 * otherwise.
 */
export function AuthGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { data: session, isPending } = authClient.useSession();

  useEffect(() => {
    if (!isPending && !session) {
      router.replace("/login");
    }
  }, [isPending, session, router]);

  // Resolving the session, or redirecting an unauthenticated visitor: render a
  // neutral loader rather than flashing protected content.
  if (isPending || !session) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-base">
        <Loader />
      </div>
    );
  }

  return <>{children}</>;
}
