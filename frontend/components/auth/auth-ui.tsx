import Image from "next/image";
import Link from "next/link";
import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { LoaderCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page frame shared by every auth screen: a centred column. */
export function AuthShell({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-canvas p-6">
      <main className="flex w-full flex-1 flex-col items-center justify-center py-8">
        <div className="flex w-full max-w-[380px] flex-col gap-8">
          <header className="flex flex-col items-center gap-2 text-center">
            <Image src="/synergetic-logo.png" alt="Synergetic" width={106} height={45} priority />
            <div className="h-3" />
            <h1 className="text-[32px] font-semibold leading-[1.15] tracking-[-0.96px] text-ink">{title}</h1>
            <p className="text-[15px] leading-[1.6] text-ink-muted">{subtitle}</p>
          </header>
          {children}
        </div>
      </main>
    </div>
  );
}

export function Alert({
  variant,
  title,
  children,
}: {
  variant: "error" | "info";
  title: string;
  children?: React.ReactNode;
}) {
  const error = variant === "error";
  return (
    <div
      role={error ? "alert" : "status"}
      className={cn(
        "flex items-start gap-2 rounded-md p-3 text-[14px]",
        error ? "bg-danger-bg text-danger-fg" : "bg-info-bg text-info-fg",
      )}
    >
      <Image src={error ? "/alert-error.svg" : "/alert-info.svg"} alt="" width={18} height={18} />
      <div className="flex flex-col gap-0.5">
        <p className="font-medium leading-[1.4]">{title}</p>
        {children && <p className="leading-normal opacity-85">{children}</p>}
      </div>
    </div>
  );
}

interface AuthFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  helper?: string;
  error?: string;
  action?: React.ReactNode;
}

/** Filled field: label above the value, optional inline action, reveal toggle for passwords. */
export const AuthField = forwardRef<HTMLInputElement, AuthFieldProps>(function AuthField(
  { label, helper, error, action, type, id, className, ...props },
  ref,
) {
  const [revealed, setRevealed] = useState(false);
  const isPassword = type === "password";
  const fieldId = id ?? props.name;
  return (
    <div className="flex flex-col gap-1.5">
      <div
        className={cn(
          "flex min-h-14 items-center gap-2 rounded-t-sm border-b-2 bg-field px-3.5 py-2 transition-colors",
          error ? "border-danger-fg" : "border-transparent focus-within:border-brand",
          className,
        )}
      >
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center justify-between">
            <label htmlFor={fieldId} className="text-[13px] leading-normal text-ink-muted">
              {label}
            </label>
            {action}
          </div>
          <input
            id={fieldId}
            ref={ref}
            type={isPassword && revealed ? "text" : type}
            aria-invalid={!!error}
            className="w-full bg-transparent text-[15px] leading-[1.6] text-ink outline-none placeholder:text-placeholder"
            {...props}
          />
        </div>
        {isPassword && (
          <button
            type="button"
            onClick={() => setRevealed((v) => !v)}
            aria-label={revealed ? "Hide password" : "Show password"}
            className="shrink-0 cursor-pointer"
          >
            <Image src="/eye.svg" alt="" width={18} height={18} className={revealed ? "opacity-50" : ""} />
          </button>
        )}
      </div>
      {(error || helper) && (
        <p className={cn("text-[13px] leading-normal", error ? "text-danger-fg" : "text-ink-muted")}>
          {error ?? helper}
        </p>
      )}
    </div>
  );
});

export function Spinner() {
  return <LoaderCircle className="size-[18px] animate-spin" aria-hidden="true" />;
}

export function BackToLogin() {
  return (
    <Link href="/login" className="flex items-center justify-center gap-2 text-[14px] font-medium text-brand hover:underline">
      <Image src="/arrow-left.svg" alt="" width={18} height={18} />
      Back to log in
    </Link>
  );
}
