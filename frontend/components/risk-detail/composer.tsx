"use client";

import { useRef, useState } from "react";
import { Bold, CircleCheck, CirclePlay, Italic, Link2, List, LoaderCircle, Paperclip, X } from "lucide-react";
import { toast } from "sonner";
import { Spinner } from "@/components/auth/auth-ui";
import { Markdown } from "@/components/risk-detail/markdown";
import { uploadAttachment, useAddComment } from "@/hooks/queries/use-risk-detail";
import type { Attachment, RiskDetail } from "@/lib/risk-detail";
import { cn } from "@/lib/utils";

const MAX_BYTES = 10 * 1024 * 1024;

export function Composer({ risk, onClose, onReopen }: { risk: RiskDetail; onClose: () => void; onReopen: () => void }) {
  const [tab, setTab] = useState<"write" | "preview">("write");
  const [text, setText] = useState("");
  const [files, setFiles] = useState<Attachment[]>([]);
  const [uploading, setUploading] = useState(0);
  const area = useRef<HTMLTextAreaElement>(null);
  const picker = useRef<HTMLInputElement>(null);
  const add = useAddComment(risk.id);

  /** Wraps the selection (or inserts the markers) and puts the caret back. */
  const wrap = (before: string, after = before, placeholder = "text") => {
    const el = area.current;
    if (!el) return;
    const { selectionStart: s, selectionEnd: e } = el;
    const picked = text.slice(s, e) || placeholder;
    setText(text.slice(0, s) + before + picked + after + text.slice(e));
    requestAnimationFrame(() => { el.focus(); el.setSelectionRange(s + before.length, s + before.length + picked.length); });
  };
  const bullet = () => {
    const el = area.current;
    const s = el?.selectionStart ?? text.length;
    const lineStart = text.lastIndexOf("\n", s - 1) + 1;
    setText(text.slice(0, lineStart) + "- " + text.slice(lineStart));
  };

  const upload = async (list: FileList | File[]) => {
    for (const f of Array.from(list)) {
      if (f.size > MAX_BYTES) { toast.error(`${f.name} is over 10 MB.`); continue; }
      setUploading((n) => n + 1);
      try {
        const a = await uploadAttachment(risk.id, f);
        setFiles((prev) => [...prev, a]);
      } catch (e) {
        toast.error(e instanceof Error ? e.message : "Upload failed");
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };

  const submit = () =>
    add.mutate({ body: text.trim(), attachmentIds: files.map((f) => f.id) }, {
      onSuccess: () => { setText(""); setFiles([]); setTab("write"); toast.success("Comment added"); },
      onError: (e) => toast.error(e.message),
    });

  const tool = "flex size-7 cursor-pointer items-center justify-center rounded hover:bg-line";
  return (
    <section className="flex flex-col gap-3 pt-6" aria-label="Add a comment">
      <h2 className="text-[17px] font-semibold leading-tight">Add a comment</h2>
      <div className="rounded-md bg-subtle" onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); upload(e.dataTransfer.files); }}>
        <div className="flex items-center px-2">
          {(["write", "preview"] as const).map((t) => (
            <button key={t} type="button" onClick={() => setTab(t)} className={cn("-mb-px cursor-pointer border-b-2 px-3 py-2.5 text-[14px] font-medium capitalize", tab === t ? "border-brand text-ink" : "border-transparent text-ink-muted hover:text-ink")}>{t}</button>
          ))}
          <div className="ml-auto flex items-center gap-1 pr-1">
            <button type="button" aria-label="Bold" className={tool} onClick={() => wrap("**")}><Bold className="size-4" /></button>
            <button type="button" aria-label="Italic" className={tool} onClick={() => wrap("*")}><Italic className="size-4" /></button>
            <button type="button" aria-label="Bulleted list" className={tool} onClick={bullet}><List className="size-4" /></button>
            <button type="button" aria-label="Link" className={tool} onClick={() => wrap("[", "](https://)", "link text")}><Link2 className="size-4" /></button>
            <button type="button" aria-label="Attach files" className={tool} onClick={() => picker.current?.click()}><Paperclip className="size-4" /></button>
          </div>
        </div>
        <div className="p-3">
          {tab === "write" ? (
            <label className="flex min-h-[120px] flex-col rounded-t-sm bg-field px-3.5 py-2 focus-within:shadow-[inset_0_-2px_0_var(--color-brand)]">
              <span className="text-[13px] leading-normal text-ink-muted">Comment</span>
              <textarea
                ref={area}
                value={text}
                onChange={(e) => setText(e.target.value)}
                onPaste={(e) => e.clipboardData.files.length && (e.preventDefault(), upload(e.clipboardData.files))}
                maxLength={10000}
                placeholder="Use Markdown to format your comment"
                className="min-h-[88px] flex-1 resize-y bg-transparent text-[15px] leading-[1.6] outline-none placeholder:text-placeholder"
              />
            </label>
          ) : (
            <div className="min-h-[120px] rounded-t-sm bg-field px-3.5 py-3">
              {text.trim() ? <Markdown text={text} /> : <p className="text-[15px] text-ink-muted">Nothing to preview yet.</p>}
            </div>
          )}
        </div>
        {(files.length > 0 || uploading > 0) && (
          <ul className="flex flex-wrap gap-2 px-3 pb-2">
            {files.map((f) => (
              <li key={f.id} className="flex items-center gap-1.5 rounded-full border border-line bg-surface py-1 pl-3 pr-1.5 text-[13px]">
                {f.name}
                <button type="button" aria-label={`Remove ${f.name}`} onClick={() => setFiles(files.filter((x) => x.id !== f.id))} className="flex size-5 cursor-pointer items-center justify-center rounded-full hover:bg-field"><X className="size-3" /></button>
              </li>
            ))}
            {uploading > 0 && <li className="flex items-center gap-1.5 px-2 py-1 text-[13px] text-ink-muted"><LoaderCircle className="size-3.5 animate-spin" />Uploading…</li>}
          </ul>
        )}
        <button type="button" onClick={() => picker.current?.click()} className="flex w-full cursor-pointer items-center gap-2 px-4 pb-3 text-left text-[13px] text-ink-muted hover:text-ink">
          <Paperclip className="size-3.5" aria-hidden />
          Paste, drop, or click to add files
        </button>
        <input ref={picker} type="file" multiple hidden onChange={(e) => { if (e.target.files) upload(e.target.files); e.target.value = ""; }} />
      </div>
      <div className="flex justify-end gap-3">
        {risk.can.edit && (
          <button type="button" className="btn-secondary btn-auto" onClick={risk.status === "closed" ? onReopen : onClose}>
            {risk.status === "closed" ? <CirclePlay className="size-4" /> : <CircleCheck className="size-4" />}
            {risk.status === "closed" ? "Open risk" : "Close risk"}
          </button>
        )}
        <button type="button" className="btn-primary btn-auto" disabled={!text.trim() || add.isPending || uploading > 0} onClick={submit}>
          {add.isPending && <Spinner />}
          Comment
        </button>
      </div>
    </section>
  );
}
