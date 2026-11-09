"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
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

// Only same-site paths, so a crafted link can't bounce someone elsewhere after sign-in.
const safeNext = (next: string | null) => (next && /^\/(?![/\\])/.test(next) ? next : "/dashboard");

function authErrorMessage (err: { message?: string; code?: string; status?: number } | null | undefined, fallback: string) {
  if (!err) return fallback;
  if (err.code === "USER_ALREADY_EXISTS" || /already exists|already registered/i.test(err.message ?? "")) {
    return "An account with that email already exists.";
  }
  if (err.status === 403 || /verif/i.test(err.message ?? "")) {
    return err.message || "Confirm your email before signing in.";
  }
  return err.message || fallback;
}

export function LoginForm () {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [problem, setProblem] = useState(params.get("error") ? "That sign-in didn't complete. Please try again." : "");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <AuthFrame title="Sign in" footer={<>New here? <Link className="underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}>
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        setProblem("");
        const { error } = await authClient.signIn.email({ email: v.email, password: v.password, callbackURL: next });
        if (error) {
          if (/email|password/i.test(error.message ?? "")) setError("email", { message: "That email and password don't match." });
          setProblem(authErrorMessage(error, "That email and password don't match."));
          return;
        }
        router.push(next);
        router.refresh();
      })}>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Sign in</Button>
        <Link href="/forgot-password" className="block text-sm text-muted underline">Forgot your password?</Link>
      </form>
    </AuthFrame>
  );
}

export function SignupForm () {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [problem, setProblem] = useState("");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema) });
  return (
    <AuthFrame title="Create your account" footer={<>Have an account? <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}>
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        setProblem("");
        // Better Auth requires `name`; use the email local-part until they set a display name in Settings.
        const { error } = await authClient.signUp.email({
          email: v.email,
          password: v.password,
          name: v.email.split("@")[0] || "User",
          callbackURL: next,
        });
        if (error) {
          if (/already|exists/i.test(error.message ?? "") || error.code === "USER_ALREADY_EXISTS") {
            setError("email", { message: "Already registered. Try signing in." });
          }
          setProblem(authErrorMessage(error, "Couldn't create your account."));
          return;
        }
        router.push(next);
        router.refresh();
      })}>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Create account</Button>
        <p className="text-xs text-muted">Everything you add is private until you choose otherwise.</p>
      </form>
    </AuthFrame>
  );
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
