import "server-only";

import {
  isInternalLink,
  isSafeExternalLink,
  normalizeUrl,
} from "@/lib/advisor/links";
import type { AdvisorCitation, AdvisorSource } from "@/lib/advisor/types";

const MAX_CONTENT_CHARS = 20_000;
const MAX_CITATIONS = 6;

function cleanTitle(value: string): string {
  const cleaned = value
    .replace(/[[\]\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return cleaned || "Source";
}

function citationFrom(source: AdvisorSource): AdvisorCitation {
  return {
    url: source.url.trim(),
    title: cleanTitle(source.title),
    verifiedAt: source.verifiedAt,
  };
}

/**
 * Removes raw HTML that could be dangerous if a future renderer enables it.
 * React Markdown escapes HTML by default; this is defence in depth.
 */
export function stripDangerousHtml(value: string): string {
  return value
    .replace(
      /<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*>[\s\S]*?<\s*\/\s*\1\s*>/gi,
      "",
    )
    .replace(
      /<\s*(script|iframe|object|embed|style|link|meta)\b[^>]*\/?>/gi,
      "",
    );
}

/**
 * Validates model output before it is stored or rendered.
 *
 * - Only links to real tool sources or known internal EduBridge pages survive.
 * - Fabricated external URLs are replaced with plain text.
 * - A server-generated source list is appended so the student can verify facts.
 */
export function finalizeAssistantContent(
  raw: string,
  sources: AdvisorSource[],
): { content: string; citations: AdvisorCitation[] } {
  const sourceMap = new Map<string, AdvisorSource>();
  for (const source of sources) {
    if (!source.url || !isSafeExternalLink(source.url)) continue;
    const key = normalizeUrl(source.url);
    if (!sourceMap.has(key)) sourceMap.set(key, source);
  }

  const referenced = new Set<string>();
  let content = stripDangerousHtml(raw.replace(/\r\n/g, "\n").trim());

  // Markdown links: keep only internal links or URLs returned by tools.
  content = content.replace(
    /\[([^\]\n]{1,200})\]\(([^)\s]{1,1000})\)/g,
    (_match, text: string, rawUrl: string) => {
      const url = rawUrl.trim();
      if (isInternalLink(url)) return `[${text}](${url})`;
      if (!isSafeExternalLink(url)) return text;
      const key = normalizeUrl(url);
      if (!sourceMap.has(key)) return text;
      referenced.add(key);
      return `[${text}](${url})`;
    },
  );

  // Bare URLs: allow only known tool sources. This also catches GFM autolinks.
  content = content.replace(
    /(?<!\]\()https?:\/\/[^\s<>)\]]+/g,
    (url: string) => {
      const key = normalizeUrl(url);
      return sourceMap.has(key) ? url : "[unverified link removed]";
    },
  );

  content = content.trim().slice(0, MAX_CONTENT_CHARS);
  if (!content) {
    content =
      "I could not produce a safe answer from the available data. Please try rephrasing your question.";
  }

  const ordered: AdvisorSource[] = [];
  const seen = new Set<string>();
  for (const source of sourceMap.values()) {
    const key = normalizeUrl(source.url);
    if (referenced.has(key) && !seen.has(key)) {
      ordered.push(source);
      seen.add(key);
    }
  }
  for (const source of sourceMap.values()) {
    const key = normalizeUrl(source.url);
    if (!seen.has(key)) {
      ordered.push(source);
      seen.add(key);
    }
  }

  const citations = ordered
    .slice(0, MAX_CITATIONS)
    .map((source) => citationFrom(source));

  if (citations.length > 0) {
    const lines = citations.map((citation) => {
      const verified = citation.verifiedAt
        ? ` — verified ${citation.verifiedAt}`
        : "";
      return `- [${citation.title}](${citation.url})${verified}`;
    });
    content += `\n\n---\n**Sources from EduBridge catalog**\n${lines.join("\n")}`;
  }

  return {
    content: content.slice(0, MAX_CONTENT_CHARS + 2_000),
    citations,
  };
}
