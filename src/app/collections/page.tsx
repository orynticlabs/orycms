"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CollectionsPage() {
  return (
    <AppShell section="Collections">
      <PlaceholderPage
        eyebrow="Content architecture"
        title="Collections"
        description="Define and manage content schemas — the structural backbone of every content type in OryCMS."
      />
    </AppShell>
  );
}
