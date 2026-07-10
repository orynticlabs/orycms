"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function RedirectsPage() {
  return (
    <AppShell section="SEO">
      <PlaceholderPage
        eyebrow="SEO · Redirects"
        title="Redirects"
        description="Create and manage 301, 302, and other HTTP redirects for URL changes and site restructuring."
      />
    </AppShell>
  );
}
