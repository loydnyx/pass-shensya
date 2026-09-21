import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pass-shensya.example.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Private routes. Sign-in / sign-up / recovery are allowed to be
        // crawled so their "noindex" tag can be seen; they are not indexed.
        disallow: ["/dashboard", "/api"],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}