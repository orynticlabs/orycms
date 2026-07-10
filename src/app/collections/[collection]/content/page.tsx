"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CollectionContentPage({
  params: paramsPromise,
}: {
  params: Promise<{ collection: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Collections">
      <PlaceholderPage
        eyebrow={`Collection · ${params.collection}`}
        title="Content entries"
        description="Browse, filter, and manage all content entries for this collection."
      />
    </AppShell>
  );
}
