"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LoginForm, SignupForm } from "./auth-forms";
import { Modal } from "./ui";

export type AuthDrawerMode = "login" | "signup";

/** Floating auth panel for the locked dashboard. /login and /signup pages stay available. */
export function AuthDrawer ({
  open,
  mode,
  onClose,
  onModeChange,
  next = "/dashboard",
}: {
  open: boolean
  mode: AuthDrawerMode
  onClose: () => void
  onModeChange: (mode: AuthDrawerMode) => void
  next?: string
}) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  useEffect(() => {
    if (!open) setPending(false);
  }, [open]);

  useEffect(() => {
    if (mode === "login") setPending(false);
  }, [mode]);

  const title = pending ? "Check your email" : mode === "login" ? "Sign in" : "Create your account";

  return (
    <Modal variant="drawer" open={open} onClose={onClose} title={title}>
      <Suspense fallback={<div className="px-4 pb-5 text-sm text-muted">Loading…</div>}>
        {mode === "login" ? (
          <LoginForm
            embedded
            next={next}
            onSwitch={() => onModeChange("signup")}
            onDone={() => {
              onClose();
              router.refresh();
            }}
          />
        ) : (
          <SignupForm
            embedded
            next={next}
            onSwitch={() => onModeChange("login")}
            onPendingEmail={() => setPending(true)}
          />
        )}
      </Suspense>
    </Modal>
  );
}
