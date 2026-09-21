import type { Metadata } from "next";

import "./globals.css";

// Render every page per request. The Content-Security-Policy in
// src/middleware.ts carries a fresh nonce for each request, and a page that
// was built ahead of time could not have that nonce on its scripts.
export const dynamic = "force-dynamic";

function siteUrl(): URL {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000");
  } catch {
    // A malformed NEXT_PUBLIC_SITE_URL (e.g. missing "https://") must not break the build.
    return new URL("http://localhost:3000");
  }
}

const DESCRIPTION =
  "A private password archive for securely organizing your account credentials.";

export const metadata: Metadata = {
  metadataBase: siteUrl(),

  title: {
    default: "Pass-Shensya — Private Password Archive",
    template: "%s — Pass-Shensya",
  },

  description: DESCRIPTION,

  applicationName: "Pass-Shensya",

  keywords: [
    "password manager",
    "password vault",
    "private password archive",
    "Pass-Shensya",
  ],

  openGraph: {
    type: "website",
    siteName: "Pass-Shensya",
    title: "Pass-Shensya — Private Password Archive",
    description: DESCRIPTION,
  },

  twitter: {
    card: "summary",
    title: "Pass-Shensya — Private Password Archive",
    description: DESCRIPTION,
  },

  // The public front page may be indexed. The sign-in, sign-up, recovery and
  // dashboard routes opt out in their own layout.tsx.
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}