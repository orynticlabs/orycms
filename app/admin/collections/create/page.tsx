"use client";

import { AppShell } from "@/components/dashboard/AppShell";
import { OryCMSCollectionSchemaEditor } from "@/components/collections/OryCMSCollectionSchemaEditor";

export default function AdminCreateCollectionPage() {
  return (
    <AppShell section="Collections">
      <OryCMSCollectionSchemaEditor mode="create" />
    </AppShell>
  );
}
