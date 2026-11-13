"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { Alert, AuthField, AuthShell, Spinner } from "@/components/auth/auth-ui";
import { useAuth, type LoginResult } from "@/contexts/auth-context";
import { api } from "@/lib/api-client";

const schema = z.object({
  email: z.string().email("Enter a valid email address"),
  password: z.string().min(1, "Enter your password"),
});
type Values = z.infer<typeof schema>;

const SSO_URL = process.env.NEXT_PUBLIC_MICROSOFT_SSO_URL;

export function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const { isAuthenticated, isLoading, login } = useAuth();
  const [redirecting, setRedirecting] = useState(false);
  const [ssoUnavailable, setSsoUnavailable] = useState(false);

  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const signIn = useMutation({
    mutationFn: (v: Values) => api<LoginResult>("/login", { method: "POST", body: v }),
    onSuccess: (result) => {
      login(result);
      router.replace("/");
    },
  });

  useEffect(() => {
    if (!isLoading && isAuthenticated) router.replace("/");
  }, [isLoading, isAuthenticated, router]);

  // The backend SSO callback sends users here with ?error=microsoft_not_set_up when the
  // Microsoft account has no Risk Register user.
  const microsoftNotSetUp = params.get("error") === "microsoft_not_set_up" || ssoUnavailable;
  const sessionExpired = params.get("reason") === "expired";

  function continueWithMicrosoft() {
    if (!SSO_URL) {
      // shortcut: the backend has no Microsoft endpoint yet; set NEXT_PUBLIC_MICROSOFT_SSO_URL once it does.
      setSsoUnavailable(true);
      return;
    }
    setRedirecting(true);
    window.location.href = SSO_URL;
  }

  const busy = signIn.isPending || redirecting;
  // 400 = wrong password, 404 = unknown email; both read the same so accounts are not revealed.
  const credentialsRejected = signIn.error && [400, 404].includes((signIn.error as { status?: number }).status ?? 0);

  return (
    <AuthShell title="Welcome back" subtitle="Log in to the Enterprise Risk Register.">
      <form onSubmit={handleSubmit((v) => signIn.mutate(v))} noValidate className="flex flex-col gap-5">
        {microsoftNotSetUp && (
          <Alert variant="error" title="No Risk Register account for this login">
            {params.get("email")
              ? `Your Microsoft account ${params.get("email")} is not set up here. Ask your system administrator for access.`
              : "Your Microsoft account is not set up here. Ask your system administrator for access."}
          </Alert>
        )}
        {credentialsRejected && <Alert variant="error" title="Incorrect email or password" />}
        {signIn.error && !credentialsRejected && <Alert variant="error" title={signIn.error.message} />}
        {sessionExpired && !signIn.error && !microsoftNotSetUp && (
          <Alert variant="info" title="Your session has ended">
            Log in again to continue.
          </Alert>
        )}

        {/* <button type="button" className="btn-secondary" onClick={continueWithMicrosoft} disabled={busy}>
          {redirecting ? (
            <>
              <Spinner /> Redirecting to Microsoft…
            </>
          ) : (
            <>
              <Image src="/microsoft.svg" alt="" width={18} height={18} /> Continue with Microsoft
            </>
          )}
        </button>

        <div className="flex h-5 items-center gap-3 text-[13px] text-ink-muted">
          <div className="h-px flex-1 bg-line" />
          or
          <div className="h-px flex-1 bg-line" />
        </div> */}

        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@organisation.co.ke"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        <AuthField
          label="Password"
          type="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          error={formState.errors.password?.message}
         
          {...register("password")}
        />

        <button type="submit" className="btn-primary" disabled={busy}>
          {signIn.isPending ? <Spinner /> : "Log in"}
        </button>
      </form>

      {/* <p className="text-center text-[14px] leading-normal text-ink-muted">
        Accounts are set up by your system administrator.
      </p> */}
      <Link href="/forgot-password" className="text-[14px] text-center font-medium text-brand hover:underline">
              Forgot password?
            </Link>
    </AuthShell>
  );
}
