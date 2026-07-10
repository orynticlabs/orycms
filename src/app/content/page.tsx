"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function ContentPage() {
  return (
    <AppShell section="Content">
      <PlaceholderPage
        eyebrow="Content management"
        title="Content"
        description="Browse and manage all content entries across every collection from one unified view."
      />
    </AppShell>
  );
}
