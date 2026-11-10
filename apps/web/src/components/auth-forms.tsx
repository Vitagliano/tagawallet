"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, passwordSchema, emailSchema } from "@tagawallet/shared";
import { z } from "zod";
import { authClient } from "@/lib/auth-client";
import { Button, ErrorNote, Field, Input, Logo } from "./ui";

export function AuthFrame ({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-sm flex-col justify-center px-4 py-10">
      <Link href="/" className="mb-8"><Logo className="text-lg" /></Link>
      <h1 className="mb-5 text-2xl font-semibold tracking-tight">{title}</h1>
      {children}
      {footer && <p className="mt-5 text-sm text-muted">{footer}</p>}
    </main>
  );
}

function AuthPanel ({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <div className="overflow-y-auto px-4 pb-5">
      {children}
      {footer && <p className="mt-5 text-sm text-muted">{footer}</p>}
    </div>
  );
}

// Only same-site paths, so a crafted link can't bounce someone elsewhere after sign-in.
const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/dashboard");

function isEmailVerificationRequired (err: { message?: string; code?: string; status?: number } | null | undefined) {
  if (!err) return false;
  // Don't treat every 403 (e.g. invalid origin) as "confirm your email".
  return err.code === "EMAIL_NOT_VERIFIED" || /email not verified/i.test(err.message ?? "");
}

function authErrorMessage (err: { message?: string; code?: string; status?: number } | null | undefined, fallback: string) {
  if (!err) return fallback;
  if (err.code === "USER_ALREADY_EXISTS" || /already exists|already registered/i.test(err.message ?? "")) {
    return "An account with that email already exists.";
  }
  if (err.code === "INVALID_ORIGIN" || /invalid origin/i.test(err.message ?? "")) {
    return "Sign-in isn't available from this site address. Try again from the main TagAWallet URL.";
  }
  if (isEmailVerificationRequired(err)) {
    return err.message || "Confirm your email before signing in.";
  }
  return err.message || fallback;
}

type AuthShell = {
  next?: string
  embedded?: boolean
  onSwitch?: () => void
  onDone?: () => void
  onPendingEmail?: (email: string) => void
};

function useAuthNext (override?: string) {
  const params = useSearchParams();
  return override ?? safeNext(params.get("next"));
}

function useAfterAuth (next: string, onDone?: () => void) {
  const router = useRouter();
  const path = usePathname();
  return () => {
    if (onDone) {
      onDone();
      return;
    }
    if (path === next) router.refresh();
    else {
      router.push(next);
      router.refresh();
    }
  };
}

export function LoginForm ({ next: nextProp, embedded, onSwitch, onDone }: AuthShell = {}) {
  const next = useAuthNext(nextProp);
  const finish = useAfterAuth(next, onDone);
  const params = useSearchParams();
  const [problem, setProblem] = useState(!embedded && params.get("error") ? "That sign-in didn't complete. Please try again." : "");
  const [unverifiedEmail, setUnverifiedEmail] = useState("");
  const [resent, setResent] = useState(false);
  const { register, handleSubmit, setError, getValues, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });

  const footer = embedded
    ? <>New here? <button type="button" className="underline" onClick={onSwitch}>Create an account</button></>
    : <>New here? <Link className="underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>;

  const body = (
    <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
      setProblem("");
      setUnverifiedEmail("");
      setResent(false);
      const { error } = await authClient.signIn.email({ email: v.email, password: v.password, callbackURL: next });
      if (error) {
        if (isEmailVerificationRequired(error)) {
          setUnverifiedEmail(v.email);
          setProblem("Confirm your email before signing in. Check your inbox for the link.");
          return;
        }
        if (/email|password/i.test(error.message ?? "")) setError("email", { message: "That email and password don't match." });
        setProblem(authErrorMessage(error, "That email and password don't match."));
        return;
      }
      finish();
    })}>
      <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
      <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
      <ErrorNote>{problem}</ErrorNote>
      {unverifiedEmail && (
        <Button
          type="button"
          variant="secondary"
          className="w-full"
          disabled={resent}
          onClick={async () => {
            const email = unverifiedEmail || getValues("email");
            const { error } = await authClient.sendVerificationEmail({ email, callbackURL: next });
            if (error) { setProblem(error.message || "Couldn't send another link."); return; }
            setResent(true);
            setProblem(`Sent. Check ${email} for the link.`);
          }}
        >
          {resent ? "Link sent" : "Resend confirmation link"}
        </Button>
      )}
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Sign in</Button>
      <Link href="/forgot-password" className="block text-sm text-muted underline">Forgot your password?</Link>
    </form>
  );

  if (embedded) return <AuthPanel footer={footer}>{body}</AuthPanel>;
  return <AuthFrame title="Sign in" footer={footer}>{body}</AuthFrame>;
}

export function SignupForm ({ next: nextProp, embedded, onSwitch, onPendingEmail }: AuthShell = {}) {
  const next = useAuthNext(nextProp);
  const [problem, setProblem] = useState("");
  const [pendingEmail, setPendingEmail] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema) });

  if (pendingEmail) {
    const footer = embedded
      ? <button type="button" className="underline" onClick={onSwitch}>Back to sign in</button>
      : <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Back to sign in</Link>;
    const body = (
      <>
        <p role="status" className="text-sm text-muted">
          We sent a confirmation link to <span className="font-medium text-ink">{pendingEmail}</span>. Confirm it to finish creating your account, then sign in.
        </p>
        <p className="mt-4 text-sm text-muted">Nothing lands in your inbox? Check spam, or try signing in — we&apos;ll send another link if the address still needs confirming.</p>
      </>
    );
    if (embedded) return <AuthPanel footer={footer}>{body}</AuthPanel>;
    return <AuthFrame title="Check your email" footer={footer}>{body}</AuthFrame>;
  }

  const footer = embedded
    ? <>Have an account? <button type="button" className="underline" onClick={onSwitch}>Sign in</button></>
    : <>Have an account? <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>;

  const body = (
    <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
      setProblem("");
      // Better Auth requires `name`; use the email local-part until they set a display name in Settings.
      // With requireEmailVerification, a successful response has no session — existing emails also get 200.
      const { error } = await authClient.signUp.email({
        email: v.email,
        password: v.password,
        name: v.email.split("@")[0] || "User",
        callbackURL: next,
      });
      if (error) {
        setProblem(authErrorMessage(error, "Couldn't create your account."));
        return;
      }
      setPendingEmail(v.email);
      onPendingEmail?.(v.email);
    })}>
      <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
      <Field label="Password" error={errors.password?.message} hint="At least 10 characters"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
      <ErrorNote>{problem}</ErrorNote>
      <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Create account</Button>
      <p className="text-xs text-muted">We&apos;ll email you a link to confirm the address before you can sign in.</p>
    </form>
  );

  if (embedded) return <AuthPanel footer={footer}>{body}</AuthPanel>;
  return <AuthFrame title="Create your account" footer={footer}>{body}</AuthFrame>;
}

export function ForgotForm () {
  const [sent, setSent] = useState(false);
  const [problem, setProblem] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ email: emailSchema })) });
  return (
    <AuthFrame title="Reset your password" footer={<Link className="underline" href="/login">Back to sign in</Link>}>
      {sent ? <p role="status" className="text-sm">If that email has an account, a reset link is on its way. It works for one hour.</p> : (
        <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
          setProblem("");
          const { error } = await authClient.requestPasswordReset({
            email: v.email,
            redirectTo: `${window.location.origin}/reset-password`,
          });
          if (error) { setProblem(error.message || "Couldn't send a reset link."); return; }
          setSent(true);
        })}>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
          <ErrorNote>{problem}</ErrorNote>
          <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Send reset link</Button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetForm () {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(z.object({ password: passwordSchema })) });
  return (
    <AuthFrame title="Choose a new password">
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        setProblem("");
        if (!token) { setProblem("This reset link is missing its token."); return; }
        const { error } = await authClient.resetPassword({ newPassword: v.password, token });
        if (error) { setProblem(error.message || "This link has expired or was already used."); return; }
        router.push("/login");
      })}>
        <Field label="New password" error={errors.password?.message} hint="At least 10 characters"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Save password</Button>
      </form>
    </AuthFrame>
  );
}
