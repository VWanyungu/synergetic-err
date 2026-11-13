"use client";

import { useRef } from "react";
import { Camera, LoaderCircle } from "lucide-react";
import { toast } from "sonner";
import { Alert } from "@/components/auth/auth-ui";
import { Skeleton } from "@/components/risk-detail/ui";
import { MAX_IMAGE_BYTES, useMe, useUploadProfileImage } from "@/hooks/queries/use-me";
import { fmtDate } from "@/lib/risk-detail";

const HEAD = "text-[11px] font-medium uppercase leading-[1.3] tracking-[0.66px] text-placeholder";
// Admin and Risk Officer work across every department; a Risk Champion within their own.
const WHOLE_ORG = ["Admin", "Risk Officer"];

/** Hidden file picker plus the upload; returns the opener and whether an upload is running. */
function useImagePicker(kind: "avatar" | "banner") {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadProfileImage(kind);
  const onFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) return void toast.error("Choose an image file.");
    if (file.size > MAX_IMAGE_BYTES) return void toast.error("Images must be 5 MB or smaller.");
    upload.mutate(file, { onSuccess: () => toast.success(kind === "avatar" ? "Profile picture updated" : "Banner updated"), onError: (e) => toast.error(e.message) });
  };
  const picker = <input ref={input} type="file" accept="image/*" hidden onChange={(e) => { onFile(e.target.files?.[0]); e.target.value = ""; }} />;
  return { open: () => input.current?.click(), busy: upload.isPending, picker };
}

export default function ProfilePage() {
  const me = useMe();
  const avatar = useImagePicker("avatar");
  const banner = useImagePicker("banner");

  if (me.isError)
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert variant="error" title="Could not load your profile">{me.error.message}</Alert>
        <button type="button" className="btn-secondary btn-auto" onClick={() => me.refetch()}>Try again</button>
      </div>
    );
  if (!me.data) return <Skeleton className="h-[480px] rounded-[28px]" />;

  const u = me.data;
  const name = `${u.firstName} ${u.lastName}`.trim() || u.email;
  const initials = (`${u.firstName[0] ?? ""}${u.lastName[0] ?? ""}` || u.email.slice(0, 2)).toUpperCase();
  const scope = (role: string) => (WHOLE_ORG.includes(role) ? "All departments" : (u.department ?? "No department set"));

  return (
    // The page gutter is 24px a side; at full width the card runs the whole 1200px.
    <div className="rounded-[28px] border border-line bg-surface p-3 min-[1248px]:-mx-6">
      <div
        className="relative h-[120px] w-full rounded-[20px] bg-gradient-to-r from-brand-bg via-brand-line to-brand-bg bg-cover bg-center sm:h-[200px]"
        style={u.bannerUrl ? { backgroundImage: `url(${u.bannerUrl})` } : undefined}
      >
        <button type="button" onClick={banner.open} disabled={banner.busy} className="absolute bottom-3 right-3 flex h-8 cursor-pointer items-center gap-1.5 rounded-full bg-surface/90 px-3 text-[13px] font-medium hover:bg-surface disabled:opacity-60 sm:bottom-4 sm:right-4">
          {banner.busy ? <LoaderCircle className="size-3.5 animate-spin" /> : <Camera className="size-3.5" />}
          {u.bannerUrl ? "Change banner" : "Add banner"}
        </button>
        {banner.picker}
      </div>
      <div className="relative flex flex-col gap-10 px-4 pb-8 pt-6 sm:px-10 sm:pb-10 lg:flex-row lg:gap-16">
        <div className="absolute left-4 top-[-44px] size-[88px] sm:left-10 sm:top-[-64px] sm:size-[128px]">
          <div
            className="flex size-full items-center justify-center rounded-[26px] border-[5px] border-surface bg-brand-bg bg-cover bg-center sm:rounded-[38px]"
            style={u.avatarUrl ? { backgroundImage: `url(${u.avatarUrl})` } : undefined}
          >
            {!u.avatarUrl && <span className="text-[28px] font-semibold tracking-[-1px] text-brand sm:text-[40px]">{initials}</span>}
          </div>
          <button type="button" onClick={avatar.open} disabled={avatar.busy} aria-label="Change profile picture" className="absolute -bottom-1.5 -right-1.5 flex size-[34px] cursor-pointer items-center justify-center rounded-full bg-brand text-white hover:bg-brand-hover disabled:opacity-60">
            {avatar.busy ? <LoaderCircle className="size-4 animate-spin" /> : <Camera className="size-4" />}
          </button>
          {avatar.picker}
        </div>

        <div className="flex w-full shrink-0 flex-col gap-4 pt-14 sm:pt-[76px] lg:w-[300px]">
          <div className="flex flex-col gap-1">
            <h1 className="text-[22px] font-semibold leading-[1.3] tracking-[-0.33px]">{name}</h1>
            <p className="text-[14px] leading-normal text-ink-muted">{u.roles[0]?.role ?? "No role assigned"}</p>
          </div>
          <p className="break-all text-[14px] leading-normal">{u.email}</p>
          <div className="h-px w-full bg-line" />
          <dl className="flex flex-col gap-3 text-[13px] leading-normal">
            <div>
              <dt className={HEAD}>Department</dt>
              <dd className="mt-1">{u.department ?? "None"}</dd>
            </div>
            <div>
              <dt className={HEAD}>Member since</dt>
              <dd className="mt-1">{fmtDate(u.createdAt)}</dd>
            </div>
          </dl>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-5 lg:pt-[76px]">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-semibold leading-[1.3] tracking-[-0.27px]">My access</h2>
            <p className="text-[13px] leading-normal text-ink-muted">Only an Admin can change this.</p>
          </div>
          <div className="overflow-x-auto">
            <div className="min-w-[520px]">
              <div className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-4 py-2">
                {["Role", "Scope", "Granted by", "Since"].map((h) => <span key={h} className={HEAD}>{h}</span>)}
              </div>
              {u.roles.length === 0 && <p className="border-t border-line py-3 text-[13px] text-ink-muted">No roles assigned.</p>}
              {u.roles.map((r) => (
                <div key={r.role} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr] gap-4 border-t border-line py-3 text-[13px] leading-normal">
                  <span className="font-medium">{r.role}</span>
                  <span>{scope(r.role)}</span>
                  <span className="text-ink-muted">{r.grantedBy ?? "—"}</span>
                  <span className="text-ink-muted">{fmtDate(r.since)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
