/** Extract the target element id from an in-page section link. */
export function getSectionIdFromHref(href: string): string | null {
  if (href.startsWith("#")) {
    const id = href.slice(1).split("?")[0];
    return id || null;
  }

  const match = href.match(/^\/#([^?]+)/);
  return match ? match[1] : null;
}
