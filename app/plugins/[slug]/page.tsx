"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function PluginDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ slug: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Plugins">
      <PlaceholderPage
        eyebrow="Plugin detail"
        title={params.slug}
        description="View plugin details, configure settings, and manage installation status."
      />
    </AppShell>
  );
}
