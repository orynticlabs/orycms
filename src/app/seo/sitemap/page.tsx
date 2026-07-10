"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function SitemapPage() {
  return (
    <AppShell section="SEO">
      <PlaceholderPage
        eyebrow="SEO · Sitemap"
        title="Sitemap"
        description="Configure sitemap generation rules, excluded paths, and priority settings for search engine crawlers."
      />
    </AppShell>
  );
}
