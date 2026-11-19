import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: async () => ({ get: () => undefined }),
}));

vi.mock("next/navigation", () => ({
  redirect: (path: string) => {
    throw new Error(`NEXT_REDIRECT:${path}`);
  },
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND");
  },
}));

import ExploreUniversitiesPage from "@/app/dashboard/universities/page";
import UniversityDiscoveryDetailPage from "@/app/dashboard/universities/[slug]/page";

describe("university discovery route authorization", () => {
  it("redirects unauthenticated visitors from the list to login", async () => {
    await expect(
      ExploreUniversitiesPage({ searchParams: Promise.resolve({}) }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });

  it("redirects unauthenticated visitors from details to login", async () => {
    await expect(
      UniversityDiscoveryDetailPage({
        params: Promise.resolve({ slug: "example-university" }),
        searchParams: Promise.resolve({}),
      }),
    ).rejects.toThrow("NEXT_REDIRECT:/login");
  });
});
