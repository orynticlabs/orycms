"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function PluginsPage() {
  return (
    <AppShell section="Plugins">
      <PlaceholderPage
        eyebrow="Platform extensibility"
        title="Plugins"
        description="Browse, install, and configure plugins to extend OryCMS with third-party integrations and custom features."
      />
    </AppShell>
  );
}
