import type { MetadataRoute } from "next";

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://pass-shensya.example.com";

// Only indexable pages belong here. Sign-in, sign-up, recovery and the
// dashboard are marked noindex, so listing them would send mixed signals.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: `${SITE_URL}/`, changeFrequency: "monthly", priority: 1 }];
}