import { describe, expect, it } from "vitest";

import { getSectionIdFromHref } from "@/lib/section-links";
import { siteConfig } from "@/lib/site";

describe("landing page navigation", () => {
  it("scrolls university and scholarship links to home sections", () => {
    const navHrefs = siteConfig.nav.map((item) => item.href);
    const footerHrefs = siteConfig.footer.product.map((item) => item.href);

    expect(navHrefs).toContain("/#universities");
    expect(navHrefs).toContain("/#scholarships");
    expect(navHrefs).toContain("/#how-it-works");
    expect(navHrefs).toContain("/#advisor");
    expect(footerHrefs).toContain("/#universities");
    expect(footerHrefs).toContain("/#scholarships");

    expect(navHrefs).not.toContain("/universities");
    expect(navHrefs).not.toContain("/scholarships");
    expect(footerHrefs).not.toContain("/universities");
    expect(footerHrefs).not.toContain("/scholarships");
  });

  it("extracts section ids from hash links", () => {
    expect(getSectionIdFromHref("/#universities")).toBe("universities");
    expect(getSectionIdFromHref("#scholarships")).toBe("scholarships");
    expect(getSectionIdFromHref("/#faq?tab=1")).toBe("faq");
    expect(getSectionIdFromHref("/dashboard")).toBeNull();
  });
});
