"use client";

import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { isSafeHref } from "@/lib/advisor/links";
import { cn } from "@/lib/utils";

/**
 * Markdown-only rendering. Raw HTML is not enabled, and every link is checked
 * again on the client against the same allowlist used during server sanitizing.
 */
export function AdvisorMarkdown({
  content,
  className,
}: {
  content: string;
  className?: string;
}) {
  return (
    <div
      className={cn(
        "[&_blockquote]:border-border [&_blockquote]:text-muted-foreground text-[13.5px] leading-6 [&_blockquote]:border-l-2 [&_blockquote]:pl-3",
        "[&_code]:bg-muted [&_code]:rounded [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[12px]",
        "[&_h1]:mt-3 [&_h1]:mb-1.5 [&_h1]:text-base [&_h1]:font-semibold [&_h2]:mt-3 [&_h2]:mb-1.5 [&_h2]:text-[15px] [&_h2]:font-semibold [&_h3]:mt-3 [&_h3]:mb-1.5 [&_h3]:text-sm [&_h3]:font-semibold",
        "[&_li]:my-0.5 [&_ol]:my-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_ul]:my-2 [&_ul]:list-disc [&_ul]:pl-5",
        "[&_pre]:bg-muted/70 [&_p+p]:mt-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:p-3 [&_pre_code]:bg-transparent [&_pre_code]:p-0",
        "[&_td]:border-border [&_th]:border-border [&_th]:bg-muted/50 [&_table]:my-3 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_td]:border [&_td]:px-2 [&_td]:py-1.5 [&_th]:border [&_th]:px-2 [&_th]:py-1.5 [&_th]:text-left [&_th]:font-medium",
        "[&_a]:text-primary [&_a]:font-medium [&_a]:underline [&_a]:underline-offset-2",
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a({ href, children }) {
            if (!isSafeHref(href)) return <span>{children}</span>;
            const external = /^https?:\/\//i.test(href);
            return (
              <a
                href={href}
                {...(external
                  ? { target: "_blank", rel: "noopener noreferrer" }
                  : {})}
              >
                {children}
              </a>
            );
          },
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
