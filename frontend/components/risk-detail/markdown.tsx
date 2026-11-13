import { Fragment } from "react";

// Just enough Markdown for comments: **bold**, *italic*, [links](https://…), "- " lists, line breaks.
// Built as React elements, never as HTML, so a comment cannot inject markup.
const INLINE = /(\*\*[^*]+\*\*|\*[^*]+\*|_[^_]+_|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)\s]+\))/g;

function inline(text: string) {
  return text.split(INLINE).map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**") && part.length > 4) return <strong key={i} className="font-semibold">{part.slice(2, -2)}</strong>;
    if ((part.startsWith("*") && part.endsWith("*") && part.length > 2) || (part.startsWith("_") && part.endsWith("_") && part.length > 2)) return <em key={i}>{part.slice(1, -1)}</em>;
    const link = /^\[([^\]]+)\]\(([^)]+)\)$/.exec(part);
    if (link) return <a key={i} href={link[2]} target="_blank" rel="noopener noreferrer" className="text-brand underline">{link[1]}</a>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

export function Markdown({ text }: { text: string }) {
  const blocks: { list: boolean; lines: string[] }[] = [];
  for (const line of text.split("\n")) {
    const item = /^\s*[-*]\s+(.*)$/.exec(line);
    const last = blocks.at(-1);
    if (item) {
      if (last?.list) last.lines.push(item[1]!);
      else blocks.push({ list: true, lines: [item[1]!] });
    } else if (last && !last.list) last.lines.push(line);
    else blocks.push({ list: false, lines: [line] });
  }
  return (
    <div className="flex flex-col gap-2 text-[15px] leading-[1.6] [overflow-wrap:anywhere]">
      {blocks.map((b, i) =>
        b.list ? (
          <ul key={i} className="list-disc pl-5">{b.lines.map((l, j) => <li key={j}>{inline(l)}</li>)}</ul>
        ) : (
          <p key={i}>{b.lines.map((l, j) => <Fragment key={j}>{j > 0 && <br />}{inline(l)}</Fragment>)}</p>
        ),
      )}
    </div>
  );
}
