"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { loginSchema, registerSchema, passwordSchema, emailSchema } from "@tagawallet/shared";
import { z } from "zod";
import { api, ClientError } from "@/lib/client";
import { Button, ErrorNote, Field, Input, Logo } from "./ui";

export function AuthFrame({ title, children, footer }: { title: string; children: React.ReactNode; footer?: React.ReactNode }) {
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

function ExternalSignIn({ next }: { next: string }) {
  const [providers, setProviders] = useState<{ google: boolean; x: boolean } | null>(null);
  const [error, setError] = useState("");
  useEffect(() => { api("/api/auth/providers").then(setProviders); }, []);
  async function wallet() {
    setError("");
    try {
      const eth = (window as any).ethereum;
      if (!eth) throw new Error("No browser wallet found.");
      const [address] = await eth.request({ method: "eth_requestAccounts" });
      const { message, nonce } = await api("/api/auth/wallet");
      const signature = await eth.request({ method: "personal_sign", params: [message, address] });
      await api("/api/auth/wallet", { body: { address, signature, nonce } });
      window.location.assign(next);
    } catch (e) { setError((e as Error).message); }
  }
  const a = "inline-flex min-h-9 w-full items-center justify-center rounded-md border border-line bg-card px-3 text-sm font-medium hover:bg-wash";
  return (
    <div className="mt-5 space-y-2 border-t border-line pt-5">
      {providers?.google && <a className={a} href="/api/auth/oauth/google/start">Continue with Google</a>}
      {providers?.x && <a className={a} href="/api/auth/oauth/x/start">Continue with X</a>}
      <Button className="w-full" onClick={wallet}>Sign in with a wallet signature</Button>
      <p className="text-xs text-muted">A signature proves control of an address. We never ask for a seed phrase, private key or transaction.</p>
      <ErrorNote>{error}</ErrorNote>
    </div>
  );
}

function applyError(err: unknown, setError: (name: never, e: { message: string }) => void, setProblem: (s: string) => void) {
  if (!(err instanceof ClientError)) throw err;
  const fields = err.data.fields as Record<string, string> | undefined;
  if (fields) for (const [k, v] of Object.entries(fields)) setError(k as never, { message: v });
  else setProblem(err.message);
}

export function LoginForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [problem, setProblem] = useState(params.get("error") ? "That sign-in didn't complete. Please try again." : "");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(loginSchema) });
  return (
    <AuthFrame title="Sign in" footer={<>New here? <Link className="underline" href={`/signup?next=${encodeURIComponent(next)}`}>Create an account</Link></>}>
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        setProblem("");
        try { await api("/api/auth/login", { body: v }); router.push(next); router.refresh(); }
        catch (e) { applyError(e, setError as never, setProblem); }
      })}>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message}><Input type="password" autoComplete="current-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Sign in</Button>
        <Link href="/forgot-password" className="block text-sm text-muted underline">Forgot your password?</Link>
      </form>
      <ExternalSignIn next={next} />
    </AuthFrame>
  );
}

export function SignupForm() {
  const params = useSearchParams();
  const router = useRouter();
  const next = safeNext(params.get("next"));
  const [problem, setProblem] = useState("");
  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({ resolver: zodResolver(registerSchema) });
  return (
    <AuthFrame title="Create your account" footer={<>Have an account? <Link className="underline" href={`/login?next=${encodeURIComponent(next)}`}>Sign in</Link></>}>
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        setProblem("");
        try { await api("/api/auth/register", { body: v }); router.push(next); router.refresh(); }
        catch (e) { applyError(e, setError as never, setProblem); }
      })}>
        <Field label="Name" error={errors.displayName?.message}><Input autoComplete="name" {...register("displayName")} /></Field>
        <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
        <Field label="Password" error={errors.password?.message} hint="At least 10 characters"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full" disabled={isSubmitting}>Create account</Button>
        <p className="text-xs text-muted">Everything you add is private until you choose otherwise.</p>
      </form>
      <ExternalSignIn next={next} />
    </AuthFrame>
  );
}

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(z.object({ email: emailSchema })) });
  return (
    <AuthFrame title="Reset your password" footer={<Link className="underline" href="/login">Back to sign in</Link>}>
      {sent ? <p role="status" className="text-sm">If that email has an account, a reset link is on its way. It works for one hour.</p> : (
        <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => { await api("/api/auth/reset-password", { body: v }); setSent(true); })}>
          <Field label="Email" error={errors.email?.message}><Input type="email" autoComplete="email" {...register("email")} /></Field>
          <Button type="submit" variant="primary" className="w-full">Send reset link</Button>
        </form>
      )}
    </AuthFrame>
  );
}

export function ResetForm() {
  const token = useSearchParams().get("token") ?? "";
  const router = useRouter();
  const [problem, setProblem] = useState("");
  const { register, handleSubmit, formState: { errors } } = useForm({ resolver: zodResolver(z.object({ password: passwordSchema })) });
  return (
    <AuthFrame title="Choose a new password">
      <form className="space-y-3" noValidate onSubmit={handleSubmit(async (v) => {
        try { await api("/api/auth/reset-password/confirm", { body: { token, password: v.password } }); router.push("/login"); }
        catch (e) { setProblem((e as Error).message); }
      })}>
        <Field label="New password" error={errors.password?.message} hint="At least 10 characters"><Input type="password" autoComplete="new-password" {...register("password")} /></Field>
        <ErrorNote>{problem}</ErrorNote>
        <Button type="submit" variant="primary" className="w-full">Save password</Button>
      </form>
    </AuthFrame>
  );
}
