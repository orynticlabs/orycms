"use client";

import { use } from "react";
import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSCollectionContentPage } from "@/components/content/OryCMSCollectionContentPage";

export default function NewContentEntryPage({
  params,
}: {
  params: Promise<{ collection: string }>;
}) {
  const { collection } = use(params);
  return (
    <AppShell section="Collections">
      <OryCMSCollectionContentPage collectionSlug={collection} mode="create" />
    </AppShell>
  );
}
