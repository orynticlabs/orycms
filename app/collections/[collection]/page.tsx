"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { PlaceholderPage } from "@/components/dashboard/PlaceholderPage";

export default function CollectionDetailPage({
  params: paramsPromise,
}: {
  params: Promise<{ collection: string }>;
}) {
  const params = use(paramsPromise);
  return (
    <AppShell section="Collections">
      <PlaceholderPage
        eyebrow="Collection schema"
        title={params.collection}
        description="View and edit the field schema for this collection type."
      />
    </AppShell>
  );
}
