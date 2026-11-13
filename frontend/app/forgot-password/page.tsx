"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api-client";
import { Alert, AuthField, AuthShell, BackToLogin, Spinner } from "@/components/auth/auth-ui";
import Link from "next/link";

const schema = z.object({ email: z.string().email("Enter a valid email address") });
type Values = z.infer<typeof schema>;

export default function ForgotPasswordPage() {
  const [sentTo, setSentTo] = useState<string | null>(null);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const send = useMutation({
    mutationFn: async ({ email }: Values) => {
      try {
        await api("/forgot-password", { method: "POST", body: { email } });
      } catch (err) {
        // 404 = no such account. The screen says "if X has an account", so don't reveal it.
        if (!(err instanceof ApiError && err.status === 404)) throw err;
      }
      return email;
    },
    onSuccess: setSentTo,
  });

  if (sentTo) {
    return (
      <AuthShell
        title="Check your email"
        subtitle={`If ${sentTo} has an account, a reset link is on its way. It expires in 15 minutes.`}
      >
        <Link href="/login" className="btn-secondary">
          Back to log in
        </Link>
        <p className="flex items-center justify-center gap-1 text-[14px] text-ink-muted">
          Didn’t get it?
          <button
            type="button"
            disabled={send.isPending}
            onClick={() => send.mutate({ email: sentTo })}
            className="cursor-pointer font-medium text-brand hover:underline disabled:opacity-60"
          >
            Resend link
          </button>
        </p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Reset your password" subtitle="Enter your work email and we will send you a link to set a new one.">
      <form onSubmit={handleSubmit((v) => send.mutate(v))} noValidate className="flex flex-col gap-5">
        {send.error && <Alert variant="error" title={send.error.message} />}
        <AuthField
          label="Email"
          type="email"
          autoComplete="email"
          placeholder="name@organisation.co.ke"
          error={formState.errors.email?.message}
          {...register("email")}
        />
        <button type="submit" className="btn-primary" disabled={send.isPending}>
          {send.isPending ? <Spinner /> : "Send reset link"}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
}
