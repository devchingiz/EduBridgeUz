"use client";

import { usePathname } from "next/navigation";
import { useEffect } from "react";

/** Scrolls to a URL hash after client-side navigation renders the target. */
export function HashScroll() {
  const pathname = usePathname();

  useEffect(() => {
    const scrollToHash = () => {
      const id = decodeURIComponent(window.location.hash.slice(1));
      if (!id) return;
      document
        .getElementById(id)
        ?.scrollIntoView({ behavior: "instant", block: "start" });
    };

    scrollToHash();
    const fallback = window.setTimeout(scrollToHash, 100);
    window.addEventListener("hashchange", scrollToHash);
    window.addEventListener("popstate", scrollToHash);

    return () => {
      window.clearTimeout(fallback);
      window.removeEventListener("hashchange", scrollToHash);
      window.removeEventListener("popstate", scrollToHash);
    };
  }, [pathname]);

  return null;
}
