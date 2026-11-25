export const siteConfig = {
  name: "EduBridge",
  tagline: "Your Bridge to Global Education.",
  description:
    "Discover international universities, find scholarships, and manage your entire application journey in one place.",
  url: process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000",
  nav: [
    { label: "Universities", href: "/#universities" },
    { label: "Scholarships", href: "/#scholarships" },
    { label: "How it works", href: "/#how-it-works" },
    { label: "AI Advisor", href: "/#advisor" },
  ],
  footer: {
    product: [
      { label: "Get started", href: "/register" },
      { label: "Explore dashboard", href: "/dashboard" },
      { label: "University catalog", href: "/#universities" },
      { label: "Scholarships", href: "/#scholarships" },
      { label: "AI advisor", href: "/#advisor" },
      { label: "Application tracker", href: "/#features" },
    ],
    platform: [
      { label: "Sign up", href: "/register" },
      { label: "Log in", href: "/login" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Data verification", href: "/data-sources" },
      { label: "Platform status", href: "/#verification" },
      { label: "FAQ", href: "/#faq" },
    ],
    trust: [
      { label: "Privacy notice", href: "/privacy" },
      { label: "Terms of use", href: "/terms" },
      { label: "Security & disclosure", href: "/security" },
      { label: "Data sources", href: "/data-sources" },
    ],
  },
} as const;
