"use client";

import { Button } from "@alphonse/ui/components/button";
import { useState } from "react";
import { toast } from "sonner";

import { authClient } from "@/lib/auth-client";

function GoogleIcon() {
  return (
    <svg viewBox="0 0 24 24" className="size-[18px]" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.27-4.74 3.27-8.1Z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.65l-3.57-2.77c-.99.66-2.26 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84A11 11 0 0 0 12 23Z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.1a6.6 6.6 0 0 1 0-4.2V7.06H2.18a11 11 0 0 0 0 9.88l3.66-2.84Z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84C6.71 7.3 9.14 5.38 12 5.38Z"
      />
    </svg>
  );
}

export default function LoginPage() {
  const [isLoading, setIsLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setIsLoading(true);
    await authClient.signIn.social(
      {
        provider: "google",
        callbackURL: "/",
      },
      {
        onError: (error) => {
          setIsLoading(false);
          toast.error(error.error.message || error.error.statusText);
        },
      },
    );
  };

  return (
    <main className="flex min-h-svh items-center justify-center bg-base px-6">
      <div className="fade-up w-full max-w-sm">
        {/* Brand mark */}
        <div className="mb-10 flex flex-col items-center text-center">
          <div className="mb-6 flex size-11 items-center justify-center rounded-[12px] bg-brand-surface">
            <span className="font-serif text-xl text-brand-soft">E</span>
          </div>
          <h1 className="font-serif text-3xl font-medium tracking-tight text-ink-bright">
            Welcome to Engram
          </h1>
          <p className="mt-2 text-sm text-ink-muted">
            Sign in to pick up where your thinking left off.
          </p>
        </div>

        {/* Auth card */}
        <div className="rounded-[12px] border border-line bg-surface p-6">
          <Button
            type="button"
            variant="outline"
            onClick={handleGoogleSignIn}
            disabled={isLoading}
            className="h-11 w-full gap-3 rounded-[8px] border-line-2 bg-fill text-sm font-medium text-ink hover:border-line-strong hover:bg-raise"
          >
            {isLoading ? (
              <span className="text-ink-muted">Connecting…</span>
            ) : (
              <>
                <GoogleIcon />
                Continue with Google
              </>
            )}
          </Button>

          <p className="mt-5 text-center text-xs leading-relaxed text-ink-dim">
            By continuing you agree to the Terms of Service and acknowledge the
            Privacy Policy.
          </p>
        </div>
      </div>
    </main>
  );
}
