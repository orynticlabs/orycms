"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function MediaPage() {
  return (
    <AppShell section="Media">
      <PlaceholderPage
        eyebrow="Asset management"
        title="Media library"
        description="Upload, organize, and reference images, videos, documents, and other assets across your content."
      />
    </AppShell>
  );
}
