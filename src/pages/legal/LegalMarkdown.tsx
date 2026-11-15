import { Fragment, type ReactNode } from "react";

export function safeLegalHref(value: string): string | undefined {
  const href = value.trim();
  if (/^mailto:[^\s<>]+$/i.test(href)) return href;
  try {
    const url = new URL(href);
    return url.protocol === "https:" ? url.href : undefined;
  } catch { return undefined; }
}

function inline(text: string): ReactNode[] {
  const parts: ReactNode[] = [];
  const pattern = /\*\*([^*]+)\*\*|`([^`]+)`|\[([^\]]+)\]\(([^)]+)\)|(https:\/\/[^\s<>]+|mailto:[^\s<>]+)|\n/g;
  let last = 0;
  for (const match of text.matchAll(pattern)) {
    const index = match.index;
    if (index > last) parts.push(text.slice(last, index));
    const key = `${index}-${parts.length}`;
    if (match[1]) parts.push(<strong key={key}>{match[1]}</strong>);
    else if (match[2]) parts.push(<code key={key}>{match[2]}</code>);
    else if (match[3]) {
      const href = safeLegalHref(match[4]);
      parts.push(href ? <a key={key} href={href}>{match[3]}</a> : <Fragment key={key}>{match[3]}</Fragment>);
    } else if (match[5]) {
      const value = match[5].replace(/[.,;]+$/, "");
      const href = safeLegalHref(value);
      parts.push(href ? <a key={key} href={href}>{value}</a> : value, match[5].slice(value.length));
    } else parts.push(<br key={key} />);
    last = index + match[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

/** A small text-only renderer. Source HTML is always escaped by React. */
export default function LegalMarkdown({ content, embedded = false, omitTitle = false }: { content: string; embedded?: boolean; omitTitle?: boolean }) {
  const lines = content.replace(/\r\n?/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let index = 0;
  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) { index++; continue; }
    const heading = /^(#{1,6})\s+(.+)$/.exec(line);
    if (heading) {
      if (!(omitTitle && index === 0 && heading[1].length === 1)) {
        const level = Math.min(6, heading[1].length + (embedded ? 2 : 0));
        const Tag = `h${level}` as "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
        blocks.push(<Tag key={index}>{inline(heading[2])}</Tag>);
      }
      index++; continue;
    }
    const bullet = /^[-*]\s+/.test(line);
    const ordered = /^\d+\.\s+/.test(line);
    if (bullet || ordered) {
      const start = index;
      const items: ReactNode[] = [];
      const pattern = bullet ? /^[-*]\s+/ : /^\d+\.\s+/;
      while (index < lines.length && pattern.test(lines[index].trim())) {
        items.push(<li key={index}>{inline(lines[index].trim().replace(pattern, ""))}</li>); index++;
      }
      blocks.push(bullet ? <ul key={start}>{items}</ul> : <ol key={start} start={Number.parseInt(line, 10)}>{items}</ol>);
      continue;
    }
    if (/^---+$/.test(line)) { blocks.push(<hr key={index} />); index++; continue; }
    const start = index;
    const paragraph: string[] = [];
    while (index < lines.length && lines[index].trim() && !/^(#{1,6}\s|[-*]\s|\d+\.\s|---+$)/.test(lines[index].trim())) {
      paragraph.push(lines[index].trimEnd()); index++;
    }
    blocks.push(<p key={start}>{inline(paragraph.join("\n"))}</p>);
  }
  return <div className="legal-prose">{blocks}</div>;
}
