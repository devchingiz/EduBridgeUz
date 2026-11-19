"use client";

import Link from "next/link";
import type { ComponentProps, MouseEvent } from "react";

import { getSectionIdFromHref } from "@/lib/section-links";

type SectionLinkProps = Omit<ComponentProps<typeof Link>, "href"> & {
  href: string;
};

/**
 * A Link that scrolls to the matching section when that section is already
 * mounted. When it is not mounted, normal navigation takes over and the
 * destination layout scrolls after the route renders.
 */
export function SectionLink({ href, onClick, ...props }: SectionLinkProps) {
  const sectionId = getSectionIdFromHref(href);

  function handleClick(event: MouseEvent<HTMLAnchorElement>) {
    onClick?.(event);

    if (
      event.defaultPrevented ||
      !sectionId ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    const target = document.getElementById(sectionId);
    if (!target) return;

    event.preventDefault();
    window.history.pushState(null, "", href);
    target.scrollIntoView({ behavior: "instant", block: "start" });
  }

  return <Link {...props} href={href} onClick={handleClick} />;
}
