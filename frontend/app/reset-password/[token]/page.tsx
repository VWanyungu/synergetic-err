"use client";

import { use, useState } from "react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { ApiError, api } from "@/lib/api-client";
import { Alert, AuthField, AuthShell, BackToLogin, Spinner } from "@/components/auth/auth-ui";

const schema = z
  .object({
    password: z.string().min(8, "Use at least 8 characters."),
    confirm: z.string(),
  })
  .refine((v) => v.password === v.confirm, { path: ["confirm"], message: "Passwords do not match." });
type Values = z.infer<typeof schema>;

export default function ResetPasswordPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = use(params);
  const [done, setDone] = useState(false);
  const { register, handleSubmit, formState } = useForm<Values>({ resolver: zodResolver(schema) });

  const reset = useMutation({
    mutationFn: ({ password }: Values) => api(`/reset-password/${token}`, { method: "POST", body: { password } }),
    onSuccess: () => setDone(true),
  });

  if (done) {
    return (
      <AuthShell title="Password updated" subtitle="You can now log in with your new password.">
        <Link href="/login" className="btn-primary">
          Go to log in
        </Link>
      </AuthShell>
    );
  }

  // The backend answers 401 for a bad or expired token.
  if (reset.error instanceof ApiError && reset.error.status === 401) {
    return (
      <AuthShell title="This link has expired" subtitle="Reset links work once and expire after 15 minutes. Request a new one to continue.">
        <Link href="/forgot-password" className="btn-primary">
          Request a new link
        </Link>
        <BackToLogin />
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Set a new password" subtitle="Choose one you have not used here before.">
      <form onSubmit={handleSubmit((v) => reset.mutate(v))} noValidate className="flex flex-col gap-5">
        {reset.error && <Alert variant="error" title={reset.error.message} />}
        <AuthField
          label="New password"
          type="password"
          autoComplete="new-password"
          placeholder="Enter a new password"
          helper="Use at least 8 characters."
          error={formState.errors.password?.message}
          {...register("password")}
        />
        <AuthField
          label="Confirm new password"
          type="password"
          autoComplete="new-password"
          placeholder="Re-enter the new password"
          error={formState.errors.confirm?.message}
          {...register("confirm")}
        />
        <button type="submit" className="btn-primary" disabled={reset.isPending}>
          {reset.isPending ? <Spinner /> : "Update password"}
        </button>
      </form>
      <BackToLogin />
    </AuthShell>
  );
}
