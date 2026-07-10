"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function SeoPage() {
  return (
    <AppShell section="SEO">
      <PlaceholderPage
        eyebrow="Search optimization"
        title="SEO"
        description="Manage meta tags, Open Graph settings, redirects, and sitemaps for every page in your storefront."
      />
    </AppShell>
  );
}
